import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  aiPromptStream,
  getResolvedGlobalAiConfig,
  isAiConfigReady,
  type AiCallerConfig
} from '@/utils/ai'
import {
  attachSelectionMetaToDrafts,
  composeAssistantChatPrompt,
  composeSkillPrompt,
  type AiAssistantContext,
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { useToastStore } from '@/stores/toast-store'
import type { AiChapterDraft, InlineAiDraft } from '@/stores/ui-store'
import {
  resolveAssistantIntent,
  resolveAssistantSkillSelection,
  type AssistantIntent
} from './conversation-mode'
import {
  appendAssistantStreamToken,
  completeAssistantStreamMessage,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  getAssistantStreamEmptyError
} from './streaming-message'
import { toAiChapterDraft, toInlineAiDraft } from './inline-draft'
import { draftTitle, normalizeAssistantDrafts, withLocalRagChip } from './ai-assistant-helpers'

/**
 * SPLIT-006 phase 4 — AI request orchestration hook.
 *
 * Owns the 200-LOC `send` flow that was previously inlined in
 * AiAssistantPanel:
 *   1. preflight  — intent resolve → skill resolve → validation
 *   2. stream     — aiPromptStream + token chunk queue + abort wiring
 *   3. post       — handle stopped / error / empty / success branches +
 *                   parse drafts + write to local SQLite + refresh conversation
 *
 * The hook accepts an explicit deps object so dependency drift is
 * type-checked rather than relying on React's exhaustive-deps lint.
 * Returns `{ send, validateSkillBeforeSend }`; the panel calls send()
 * from the composer + from its sendCommandRef effect.
 */

const DEFAULT_ASSISTANT_MAX_TOKENS = 1400
const CHAPTER_DRAFT_MAX_TOKENS = 4200

export function resolveAssistantRequestMaxTokens(input: {
  skillKey?: string | null
  userInput?: string | null
}): number {
  const text = input.userInput || ''
  if (input.skillKey === 'create_chapter') return CHAPTER_DRAFT_MAX_TOKENS
  if (
    input.skillKey === 'continue_writing' &&
    /起草(?:第.{1,12}章|本章)正文|开始写(?:第.{1,12}章|本章)/.test(text)
  ) {
    return CHAPTER_DRAFT_MAX_TOKENS
  }
  return DEFAULT_ASSISTANT_MAX_TOKENS
}

export interface AiAssistantMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

export interface AiDraftRow {
  id: number
  conversation_id?: number | null
  kind: string
  title: string
  payload: Record<string, unknown>
  status: 'pending' | 'applied' | 'dismissed'
  target_ref?: string
}

export interface UseAiAssistantRequestDeps {
  // state values
  input: string
  loading: boolean
  conversationId: number | null
  bookId: number | null
  context: AiAssistantContext
  profile: AiWorkProfile | null
  skills: AiSkillTemplate[]
  overrides: AiSkillOverride[]
  assistantIntent: AssistantIntent
  currentChapter: { id: number } | null
  volumes: Array<{ id: number }>
  aiAssistantSelectionChapterId: number | null
  aiAssistantSelectionText: string
  aiAssistantSelectionFrom: number | null
  aiAssistantSelectionTo: number | null

  // setters
  setMessages: Dispatch<SetStateAction<AiAssistantMessage[]>>
  setError: Dispatch<SetStateAction<string | null>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setInput: Dispatch<SetStateAction<string>>
  setInlineAiDraft: (draft: InlineAiDraft) => void
  setAiChapterDraft: (draft: AiChapterDraft) => void

  // ref + callbacks
  activeRequestAbortRef: MutableRefObject<AbortController | null>
  refreshConversation: (conversationId?: number | null) => Promise<void>
}

export interface UseAiAssistantRequestReturn {
  send: (explicitSkill?: AiSkillTemplate, explicitInput?: string) => Promise<void>
  validateSkillBeforeSend: (skill: AiSkillTemplate | null) => string | null
}

export function useAiAssistantRequest(deps: UseAiAssistantRequestDeps): UseAiAssistantRequestReturn {
  const validateSkillBeforeSend = (skill: AiSkillTemplate | null): string | null => {
    if (!skill) return null
    if (
      skill.key === 'polish_text' &&
      !(
        deps.aiAssistantSelectionChapterId === deps.currentChapter?.id &&
        deps.aiAssistantSelectionText.trim()
      )
    ) {
      return '请先在编辑器中选中要润色的正文，再使用“润色改写”。'
    }
    if (skill.key === 'continue_writing' && !deps.currentChapter) {
      return '请先打开目标章节，再使用“续写正文”。'
    }
    if (skill.key === 'review_chapter' && !deps.currentChapter) {
      return '请先打开目标章节，再使用“审核本章”。'
    }
    return null
  }

  const send = async (
    explicitSkill?: AiSkillTemplate,
    explicitInput?: string
  ): Promise<void> => {
    const text = (explicitInput ?? deps.input).trim()
    if (!text || deps.loading || !deps.conversationId || !deps.bookId) return
    const requestIntent = explicitSkill
      ? deps.assistantIntent
      : resolveAssistantIntent({
          skills: deps.skills,
          userInput: text,
          selectedText:
            deps.aiAssistantSelectionChapterId === deps.currentChapter?.id
              ? deps.aiAssistantSelectionText
              : '',
          hasCurrentChapter: Boolean(deps.currentChapter),
          hasVolumes: deps.volumes.length > 0
        })
    const skill =
      explicitSkill ||
      resolveAssistantSkillSelection(deps.skills, deps.overrides, requestIntent.skillKey)
    const skillPreflightError = validateSkillBeforeSend(skill)
    if (skillPreflightError) {
      deps.setError(skillPreflightError)
      return
    }
    deps.setError(null)
    deps.setLoading(true)
    deps.setInput('')

    try {
      const config = await getResolvedGlobalAiConfig()
      const aiConfig = config
        ? { ...(config as AiCallerConfig), bookId: deps.bookId, ragMode: 'auto' as const }
        : null
      if (!isAiConfigReady(aiConfig)) {
        deps.setError(
          '请先在应用设置 / AI 与模型中完成全局 AI 配置，或完成 Gemini CLI / Ollama 设置'
        )
        deps.setLoading(false)
        return
      }

      const requestAbortController = new AbortController()
      deps.activeRequestAbortRef.current = requestAbortController
      const requestContext =
        aiConfig.ai_provider === 'zhengdao_official' ? withLocalRagChip(deps.context) : deps.context

      const prompt = skill
        ? composeSkillPrompt({
            skill,
            profile: deps.profile,
            context: requestContext,
            userInput: text
          })
        : composeAssistantChatPrompt({
            profile: deps.profile,
            context: requestContext,
            skills: deps.skills,
            userInput: text
          })
      const userMessage = (await window.api.aiAddMessage(deps.conversationId, 'user', text, {
        skill_key: skill?.key ?? null,
        mode: skill ? 'skill' : 'chat',
        intent_reason: requestIntent.reason,
        intent_confidence: requestIntent.confidence,
        context_chips: requestContext.chips
      })) as AiAssistantMessage
      const pendingMessageId = -Date.now()
      const streamingLabel =
        aiConfig.ai_provider === 'gemini_cli'
          ? 'Gemini 3 Pro 正在生成...'
          : aiConfig.ai_provider === 'zhengdao_official'
            ? '证道官方 AI 正在结合本地片段生成...'
            : 'AI 正在生成...'
      const pendingMessage = createPendingAssistantStreamMessage(pendingMessageId, streamingLabel)
      deps.setMessages((current) => [...current, userMessage, pendingMessage])

      let streamedContent = ''
      let streamError = ''
      const streamChunkQueue = createAssistantStreamChunkQueue((token) => {
        deps.setMessages((current) => appendAssistantStreamToken(current, pendingMessageId, token))
      })
      await aiPromptStream(
        aiConfig,
        prompt.systemPrompt,
        prompt.userPrompt,
        {
          onToken: (token) => {
            streamedContent += token
            streamChunkQueue.push(token)
          },
          onComplete: (fullText) => {
            streamedContent = fullText || streamedContent
          },
          onError: (message) => {
            streamError = message
          }
        },
        resolveAssistantRequestMaxTokens({ skillKey: skill?.key, userInput: text }),
        0.72,
        { signal: requestAbortController.signal }
      )
      await streamChunkQueue.drain()

      const stopped = requestAbortController.signal.aborted

      if (stopped) {
        if (!streamedContent.trim()) {
          deps.setMessages((current) => current.filter((message) => message.id !== pendingMessageId))
          useToastStore.getState().addToast('info', '已停止生成')
          return
        }

        const assistantMessage = (await window.api.aiAddMessage(
          deps.conversationId,
          'assistant',
          streamedContent,
          {
            skill_key: skill?.key ?? null,
            mode: skill ? 'skill' : 'chat',
            stopped: true
          }
        )) as { id: number }
        deps.setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? {
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: streamedContent,
                  metadata: { stopped: true }
                }
              : message
          )
        )
        useToastStore.getState().addToast('info', '已停止生成，已保留当前内容')
        await deps.refreshConversation(deps.conversationId)
        return
      }

      if (streamError) {
        deps.setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? { ...message, streaming: false, content: message.content || '生成失败' }
              : message
          )
        )
        deps.setError(streamError)
        return
      }
      const emptyStreamError = getAssistantStreamEmptyError(streamedContent)
      if (emptyStreamError) {
        deps.setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? { ...message, streaming: false, content: '生成失败' }
              : message
          )
        )
        deps.setError(emptyStreamError)
        return
      }

      const assistantMessage = (await window.api.aiAddMessage(
        deps.conversationId,
        'assistant',
        streamedContent,
        {
          skill_key: skill?.key ?? null,
          mode: skill ? 'skill' : 'chat',
          intent_reason: requestIntent.reason,
          intent_confidence: requestIntent.confidence
        }
      )) as { id: number }
      deps.setMessages((current) =>
        completeAssistantStreamMessage(
          current,
          pendingMessageId,
          assistantMessage.id,
          streamedContent
        ).map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                metadata: {
                  skill_key: skill?.key ?? null,
                  mode: skill ? 'skill' : 'chat',
                  intent_reason: requestIntent.reason,
                  intent_confidence: requestIntent.confidence
                }
              }
            : message
        )
      )
      if (skill) {
        const parsed = normalizeAssistantDrafts(skill, streamedContent)
        const boundDrafts = attachSelectionMetaToDrafts(parsed.drafts, {
          chapterId: deps.aiAssistantSelectionChapterId,
          text: deps.aiAssistantSelectionText,
          from: deps.aiAssistantSelectionFrom,
          to: deps.aiAssistantSelectionTo
        })
        for (const draft of boundDrafts) {
          const payload =
            draft.kind === 'insert_text' || draft.kind === 'create_chapter'
              ? { ...draft, retry_input: text }
              : draft
          const createdDraft = (await window.api.aiCreateDraft({
            book_id: deps.bookId,
            conversation_id: deps.conversationId,
            message_id: assistantMessage.id,
            kind: payload.kind,
            title: draftTitle(payload),
            payload,
            target_ref: deps.currentChapter ? `chapter:${deps.currentChapter.id}` : ''
          })) as AiDraftRow
          const inlineDraft = toInlineAiDraft(createdDraft, deps.currentChapter?.id, text)
          if (inlineDraft) deps.setInlineAiDraft(inlineDraft)
          const chapterDraft = toAiChapterDraft(createdDraft, text)
          if (chapterDraft) deps.setAiChapterDraft(chapterDraft)
        }
        if (parsed.errors.length > 0) {
          deps.setError(parsed.errors.join('；'))
        }
      }
      await deps.refreshConversation(deps.conversationId)
    } catch (err) {
      deps.setError(err instanceof Error ? err.message : 'AI 请求失败')
    } finally {
      deps.setLoading(false)
    }
  }

  return { send, validateSkillBeforeSend }
}

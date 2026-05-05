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
  completeAssistantStreamMessage,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  getAssistantStreamEmptyError
} from './streaming-message'
import { replaceAssistantStreamContent } from './streaming-message'
import { toAiChapterDraft, toInlineAiDraft } from './inline-draft'
import { draftTitle, normalizeAssistantDrafts, withLocalRagChip } from './ai-assistant-helpers'
import { scanNarrativeQuality } from '@/utils/ai/workflow/quality-filter'
import { isRemoveAiToneQuickActionInput } from './chapter-quick-actions'
import {
  extractAssistantPresentation,
  stripAssistantPresentationFromPartial,
  type AssistantPresentationMetadata
} from '../../../../shared/assistant-presentation'
import type { AssistantInteractionMode } from './assistant-interaction-mode'

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

type RemoveAiToneSkillOutput = {
  issues?: unknown[]
  rewritten?: string
  protectedSpansApplied?: unknown[]
  secondPassAudit?: unknown[]
  metadata?: Record<string, unknown>
}

type RemoveAiToneSkillResult = {
  runId?: string
  output?: unknown
  modelUsed?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costUsd: number
  }
  error?: string
  code?: string
}

export interface AiAssistantMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

export interface RemoveAiToneQuickActionApi {
  aiAddMessage: (
    conversationId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: unknown
  ) => Promise<AiAssistantMessage | { id: number }>
  aiExecuteSkill: (
    skillId: string,
    input: Record<string, unknown>,
    options?: { modelHint?: 'fast' | 'balanced' | 'heavy' }
  ) => Promise<RemoveAiToneSkillResult>
  aiCreateDraft: (data: Record<string, unknown>) => Promise<AiDraftRow>
}

export interface RemoveAiToneQuickActionInput {
  text: string
  bookId: number
  conversationId: number
  currentChapter: { id: number; content?: string | null } | null
  selectionChapterId: number | null
  selectionText: string
  selectionFrom: number | null
  selectionTo: number | null
  profile: AiWorkProfile | null
  contextChips: AiAssistantContext['chips']
  intent: AssistantIntent
  api: RemoveAiToneQuickActionApi
}

export interface RemoveAiToneQuickActionResult {
  userMessage: AiAssistantMessage | { id: number }
  assistantMessage: AiAssistantMessage | { id: number }
  draft: AiDraftRow
  output: RemoveAiToneSkillOutput
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
  assistantMode: AssistantInteractionMode
  currentChapter: { id: number; content?: string | null } | null
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

export async function runRemoveAiToneQuickAction(
  input: RemoveAiToneQuickActionInput
): Promise<RemoveAiToneQuickActionResult> {
  const target = resolveRemoveAiToneTarget(input)
  const genre = coerceSkillGenre(input.profile?.genre)
  const metadataBase = {
    skill_key: 'remove_ai_tone',
    skill_id: 'layer2.deslop',
    mode: 'skill',
    intent_reason: input.intent.reason,
    intent_confidence: input.intent.confidence,
    context_chips: input.contextChips
  }
  const userMessage = await input.api.aiAddMessage(
    input.conversationId,
    'user',
    input.text,
    metadataBase
  )
  const skillResult = await input.api.aiExecuteSkill(
    'layer2.deslop',
    {
      text: target.text,
      genre,
      mode: 'rewrite',
      styleFingerprint: input.profile?.style_fingerprint || undefined
    },
    { modelHint: 'balanced' }
  )
  if (skillResult.error) throw new Error(skillResult.error)

  const output = (skillResult.output || {}) as RemoveAiToneSkillOutput
  const rewritten = String(output.rewritten || '').trim()
  if (!rewritten) throw new Error('layer2.deslop 未返回可替换文本')

  const qualityGate = {
    skill_id: 'layer2.deslop',
    decision: (output.secondPassAudit?.length || 0) > 0 ? 'needs_revision' : 'pass',
    issue_count: output.issues?.length || 0,
    second_pass_issue_count: output.secondPassAudit?.length || 0,
    metadata: output.metadata || {}
  }
  const assistantMetadata = {
    ...metadataBase,
    skill_run_id: skillResult.runId || null,
    model_used: skillResult.modelUsed || null,
    usage: skillResult.usage || null,
    quality_gate: qualityGate,
    quality_issues: output.issues || [],
    protected_spans_applied: output.protectedSpansApplied || [],
    second_pass_audit: output.secondPassAudit || []
  }
  const assistantMessage = await input.api.aiAddMessage(
    input.conversationId,
    'assistant',
    formatRemoveAiToneAssistantMessage(output, rewritten),
    assistantMetadata
  )
  const payload = {
    kind: 'replace_text',
    content: rewritten,
    original_text: target.text,
    selection_chapter_id: target.chapterId,
    selection_from: target.from,
    selection_to: target.to,
    retry_input: input.text,
    quality_gate: qualityGate,
    skill_run_id: skillResult.runId || null,
    quality_issues: output.issues || [],
    protected_spans_applied: output.protectedSpansApplied || [],
    second_pass_audit: output.secondPassAudit || []
  }
  const draft = await input.api.aiCreateDraft({
    book_id: input.bookId,
    conversation_id: input.conversationId,
    message_id: typeof assistantMessage.id === 'number' ? assistantMessage.id : undefined,
    kind: 'replace_text',
    title: target.scope === 'selection' ? '去 AI 味替换草稿（选区）' : '去 AI 味替换草稿（本章）',
    payload,
    target_ref: `chapter:${target.chapterId}`
  })

  return { userMessage, assistantMessage, draft, output }
}

function resolveRemoveAiToneTarget(input: RemoveAiToneQuickActionInput): {
  scope: 'selection' | 'chapter'
  chapterId: number
  text: string
  from: number
  to: number
} {
  const currentChapter = input.currentChapter
  const hasSelection =
    currentChapter &&
    input.selectionChapterId === currentChapter.id &&
    input.selectionText.trim().length > 0
  if (hasSelection && currentChapter) {
    if (input.selectionFrom == null || input.selectionTo == null) {
      throw new Error('当前选区缺少位置锚点，请重新选中文本后再去 AI 味。')
    }
    return {
      scope: 'selection',
      chapterId: currentChapter.id,
      text: input.selectionText.trim(),
      from: input.selectionFrom,
      to: input.selectionTo
    }
  }

  if (!currentChapter) {
    throw new Error('请先打开目标章节，再使用“去 AI 味”。')
  }
  const text = plainTextFromChapterContent(currentChapter.content || '').trim()
  if (!text) {
    throw new Error('当前章节正文为空，无法去 AI 味。')
  }
  return {
    scope: 'chapter',
    chapterId: currentChapter.id,
    text,
    from: 0,
    to: text.length
  }
}

function coerceSkillGenre(value: string | null | undefined): string {
  return ['webnovel', 'script', 'fiction', 'academic', 'professional'].includes(value || '')
    ? String(value)
    : 'webnovel'
}

function plainTextFromChapterContent(value: string): string {
  if (!/<[a-z][\s\S]*>/i.test(value)) return value
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
}

function formatRemoveAiToneAssistantMessage(output: RemoveAiToneSkillOutput, rewritten: string): string {
  const issueCount = output.issues?.length || 0
  const secondPassCount = output.secondPassAudit?.length || 0
  const protectedCount = output.protectedSpansApplied?.length || 0
  return [
    `已运行 layer2.deslop，发现 ${issueCount} 个问题，保护片段 ${protectedCount} 个。`,
    secondPassCount > 0 ? `二次回读仍提示 ${secondPassCount} 个残留，请应用前快速过一眼。` : '',
    '已生成 replace_text 草稿，应用前仍需在草稿篮确认。',
    '',
    rewritten.slice(0, 1200)
  ]
    .filter(Boolean)
    .join('\n')
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
    const requestIntent =
      deps.assistantMode === 'creation_planning'
        ? {
            mode: 'chat' as const,
            skillKey: null,
            confidence: 1,
            reason: '创作策划模式：仅输出策划建议'
          }
        : explicitSkill
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
      deps.assistantMode === 'creation_planning'
        ? null
        : explicitSkill ||
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
      if (deps.assistantMode === 'direct_writing' && isRemoveAiToneQuickActionInput(text)) {
        const result = await runRemoveAiToneQuickAction({
          text,
          bookId: deps.bookId,
          conversationId: deps.conversationId,
          currentChapter: deps.currentChapter,
          selectionChapterId: deps.aiAssistantSelectionChapterId,
          selectionText: deps.aiAssistantSelectionText,
          selectionFrom: deps.aiAssistantSelectionFrom,
          selectionTo: deps.aiAssistantSelectionTo,
          profile: deps.profile,
          contextChips: deps.context.chips,
          intent: {
            mode: 'skill',
            skillKey: 'remove_ai_tone',
            confidence: 1,
            reason: '章节快捷操作：去 AI 味'
          },
          api: window.api
        })
        deps.setMessages((current) => [
          ...current,
          result.userMessage as AiAssistantMessage,
          result.assistantMessage as AiAssistantMessage
        ])
        const inlineDraft = toInlineAiDraft(result.draft, deps.currentChapter?.id, text)
        if (inlineDraft) deps.setInlineAiDraft(inlineDraft)
        const chapterDraft = toAiChapterDraft(result.draft, text)
        if (chapterDraft) deps.setAiChapterDraft(chapterDraft)
        await deps.refreshConversation(deps.conversationId)
        return
      }

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
      const storyBible = await window.api.aiGetStoryBible(deps.bookId).catch(() => null)

      const prompt = skill
        ? composeSkillPrompt({
            skill,
            profile: deps.profile,
            context: requestContext,
            userInput: text,
            storyBible,
            presentationMode: 'author_thought_dual_channel'
          })
        : composeAssistantChatPrompt({
            profile: deps.profile,
            context: requestContext,
            skills: deps.skills,
            userInput: text,
            storyBible,
            assistantMode: deps.assistantMode,
            presentationMode: 'author_thought_dual_channel'
          })
      const userMessage = (await window.api.aiAddMessage(deps.conversationId, 'user', text, {
        skill_key: skill?.key ?? null,
        assistant_mode: deps.assistantMode,
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
      let streamedPresentation: AssistantPresentationMetadata | undefined
      let streamError = ''
      const streamChunkQueue = createAssistantStreamChunkQueue((token) => {
        deps.setMessages((current) => replaceAssistantStreamContent(current, pendingMessageId, token))
      })
      await aiPromptStream(
        aiConfig,
        prompt.systemPrompt,
        prompt.userPrompt,
        {
          onToken: (token) => {
            streamedContent += token
            // The backend stream should already hide presentation control
            // markers, but keep the local strip as a compatibility guard.
            streamChunkQueue.push(stripAssistantPresentationFromPartial(streamedContent))
          },
          onComplete: (fullText, metadata) => {
            streamedContent = fullText || streamedContent
            streamedPresentation = metadata
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
        const stoppedPresentation = extractAssistantPresentation(streamedContent)
        const stoppedContent = stoppedPresentation.content || stripAssistantPresentationFromPartial(streamedContent)
        if (!streamedContent.trim()) {
          deps.setMessages((current) => current.filter((message) => message.id !== pendingMessageId))
          useToastStore.getState().addToast('info', '已停止生成')
          return
        }

        const assistantMessage = (await window.api.aiAddMessage(
          deps.conversationId,
          'assistant',
          stoppedContent,
          {
            skill_key: skill?.key ?? null,
            assistant_mode: deps.assistantMode,
            mode: skill ? 'skill' : 'chat',
            stopped: true,
            ...(stoppedPresentation.authorThought ? { authorThought: stoppedPresentation.authorThought } : {})
          }
        )) as { id: number }
        deps.setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? {
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: stoppedContent,
                  metadata: {
                    stopped: true,
                    assistant_mode: deps.assistantMode,
                    ...(stoppedPresentation.authorThought ? { authorThought: stoppedPresentation.authorThought } : {})
                  }
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
      const extractedPresentation = extractAssistantPresentation(streamedContent)
      const finalContent = extractedPresentation.content
      const authorThought = streamedPresentation?.authorThought || extractedPresentation.authorThought
      const emptyStreamError = getAssistantStreamEmptyError(finalContent)
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

      const qualityIssues = scanNarrativeQuality(finalContent)
      const assistantMetadata = {
        skill_key: skill?.key ?? null,
        assistant_mode: deps.assistantMode,
        mode: skill ? 'skill' : 'chat',
        intent_reason: requestIntent.reason,
        intent_confidence: requestIntent.confidence,
        quality_issues: qualityIssues,
        ...(authorThought ? { authorThought } : {})
      }
      const assistantMessage = (await window.api.aiAddMessage(
        deps.conversationId,
        'assistant',
        finalContent,
        assistantMetadata
      )) as { id: number }
      await window.api.aiCaptureStoryFacts({
        bookId: deps.bookId,
        sourceType: 'assistant_message',
        sourceRef: String(assistantMessage.id),
        text: finalContent,
        chapterNumber: null
      }).catch(() => null)
      deps.setMessages((current) =>
        completeAssistantStreamMessage(
          current,
          pendingMessageId,
          assistantMessage.id,
          finalContent
        ).map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                metadata: assistantMetadata
              }
            : message
        )
      )
      if (skill) {
        const parsed = normalizeAssistantDrafts(skill, finalContent)
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

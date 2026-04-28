import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, ClipboardCheck, Loader2, MessageSquare, MessageSquarePlus, Send, Settings2, Sparkles, Trash2, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { useWikiStore } from '@/stores/wiki-store'
import { aiPromptStream, getResolvedAiConfigForBook, isAiConfigReady, type AiCallerConfig } from '@/utils/ai'
import {
  applyAssistantContextSelection,
  attachSelectionMetaToDrafts,
  buildAssistantContext,
  composeAssistantChatPrompt,
  composeSkillPrompt,
  parseAssistantDrafts,
  planTextDraftApplication,
  resolveAssistantContextPolicy,
  type AiAssistantContext,
  type AiDraftPayload,
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { stripHtmlToText } from '@/utils/html-to-text'
import { getActiveEditor } from '@/components/editor/active-editor'
import { applyProfessionalTemplate, getProfessionalTemplate } from '../../../../shared/professional-templates'
import { buildConversationListItems, pickConversationAfterDelete } from './conversation-list'
import {
  resolveAssistantIntent,
  resolveAssistantSkillSelection
} from './conversation-mode'
import { shouldSubmitAiAssistantInput } from './input-behavior'
import { buildDraftPreviewModel } from './draft-preview'
import { buildAssistantMessageDisplay } from './message-display'
import { translateAiAssistantLauncherPosition } from './panel-layout'
import {
  appendAssistantStreamToken,
  completeAssistantStreamMessage,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  getAssistantStreamEmptyError
} from './streaming-message'

type AiMessage = {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

type AiConversationRow = {
  id: number
  title: string
  updated_at: string
  message_count?: number
}

type AiDraftRow = {
  id: number
  kind: string
  title: string
  payload: Record<string, unknown>
  status: 'pending' | 'applied' | 'dismissed'
}

function plainToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function ensureHtmlContent(text: string): string {
  const value = text.trim()
  if (!value) return ''
  return /<\/?[a-z][^>]*>/i.test(value) ? value : plainToHtml(value)
}

function draftTitle(draft: AiDraftPayload): string {
  if (typeof draft.title === 'string' && draft.title.trim()) return draft.title
  if (typeof draft.name === 'string' && draft.name.trim()) return draft.name
  switch (draft.kind) {
    case 'insert_text':
      return '插入正文'
    case 'replace_text':
      return '替换正文'
    case 'create_chapter':
      return '创建章节'
    case 'update_chapter_summary':
      return '更新章节摘要'
    case 'create_character':
      return '创建角色'
    case 'create_wiki_entry':
      return '创建设定'
    case 'create_plot_node':
      return '创建剧情节点'
    case 'create_foreshadowing':
      return '创建伏笔'
    default:
      return 'AI 草稿'
  }
}

function normalizeAssistantDrafts(skill: AiSkillTemplate, content: string): { drafts: AiDraftPayload[]; errors: string[] } {
  if (skill.output_contract === 'plain_text') {
    if (skill.key === 'continue_writing') {
      return { drafts: [{ kind: 'insert_text', content }], errors: [] }
    }
    return { drafts: [], errors: [] }
  }
  return parseAssistantDrafts(content)
}

function withLocalRagChip(context: AiAssistantContext): AiAssistantContext {
  if (context.chips.some((chip) => chip.id === 'local_rag')) return context
  return {
    ...context,
    chips: [
      ...context.chips,
      {
        id: 'local_rag',
        kind: 'local_rag',
        label: '本地片段',
        enabled: true
      }
    ]
  }
}

export function AiAssistantPanel() {
  const bookId = useBookStore((s) => s.currentBookId)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const volumes = useChapterStore((s) => s.volumes)
  const createChapter = useChapterStore((s) => s.createChapter)
  const selectChapter = useChapterStore((s) => s.selectChapter)
  const updateChapterContent = useChapterStore((s) => s.updateChapterContent)
  const updateChapterSummary = useChapterStore((s) => s.updateChapterSummary)
  const characters = useCharacterStore((s) => s.characters)
  const createCharacter = useCharacterStore((s) => s.createCharacter)
  const foreshadowings = useForeshadowStore((s) => s.foreshadowings)
  const createForeshadowing = useForeshadowStore((s) => s.createForeshadowing)
  const plotNodes = usePlotStore((s) => s.plotNodes)
  const createPlotNode = usePlotStore((s) => s.createPlotNode)
  const createWikiEntry = useWikiStore((s) => s.createEntry)
  const {
    aiAssistantSelectionText,
    aiAssistantSelectionChapterId,
    aiAssistantSelectionFrom,
    aiAssistantSelectionTo,
    aiAssistantCommand,
    closeAiAssistant,
    consumeAiAssistantCommand,
    openModal
  } = useUIStore()

  const [conversationId, setConversationId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<AiConversationRow[]>([])
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [drafts, setDrafts] = useState<AiDraftRow[]>([])
  const [skills, setSkills] = useState<AiSkillTemplate[]>([])
  const [overrides, setOverrides] = useState<AiSkillOverride[]>([])
  const [profile, setProfile] = useState<AiWorkProfile | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationListOpen, setConversationListOpen] = useState(false)
  const [enabledContextChipIds, setEnabledContextChipIds] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRequestAbortRef = useRef<AbortController | null>(null)
  const sendCommandRef = useRef<(text: string) => void>(() => {})

  const assistantIntent = useMemo(
    () =>
      resolveAssistantIntent({
        skills,
        userInput: input,
        selectedText: aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
        hasCurrentChapter: Boolean(currentChapter),
        hasVolumes: volumes.length > 0
      }),
    [aiAssistantSelectionChapterId, aiAssistantSelectionText, currentChapter, input, skills, volumes.length]
  )
  const selectedSkill = useMemo(() => {
    return resolveAssistantSkillSelection(skills, overrides, assistantIntent.skillKey)
  }, [skills, overrides, assistantIntent.skillKey])
  const contextPolicy = useMemo(
    () => resolveAssistantContextPolicy(selectedSkill, profile),
    [profile, selectedSkill]
  )
  const conversationItems = useMemo(
    () => buildConversationListItems(conversations, conversationId),
    [conversations, conversationId]
  )
  const baseContext = useMemo<AiAssistantContext>(() => {
    const chapterPlain = currentChapter?.content ? stripHtmlToText(currentChapter.content) : ''
    return buildAssistantContext({
      policy: contextPolicy,
      currentChapter: currentChapter
        ? { id: currentChapter.id, title: currentChapter.title, plainText: chapterPlain }
        : null,
      selectedText: aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
      characters: characters.map((character) => ({
        id: character.id,
        name: character.name,
        description: character.description
      })),
      foreshadowings: foreshadowings.map((item) => ({
        id: item.id,
        text: item.text,
        status: item.status
      })),
      plotNodes: plotNodes.map((node) => ({
        id: node.id,
        title: node.title,
        description: node.description,
        chapter_number: node.chapter_number
      }))
    })
  }, [
    aiAssistantSelectionChapterId,
    aiAssistantSelectionText,
    characters,
    currentChapter,
    foreshadowings,
    plotNodes,
    contextPolicy
  ])
  const contextDefaultsKey = useMemo(
    () => baseContext.chips.map((chip) => `${chip.id}:${chip.enabled ? '1' : '0'}`).join('|'),
    [baseContext]
  )
  const context = useMemo(
    () => applyAssistantContextSelection(baseContext, enabledContextChipIds),
    [baseContext, enabledContextChipIds]
  )

  const refreshConversation = useCallback(async (targetConversationId?: number | null) => {
    if (!bookId) return
    const conversation = targetConversationId
      ? ({ id: targetConversationId } as { id: number })
      : ((await window.api.aiGetOrCreateConversation(bookId)) as { id: number })
    const [conversationRows, messageRows, draftRows] = await Promise.all([
      window.api.aiGetConversations(bookId),
      window.api.aiGetMessages(conversation.id),
      window.api.aiGetDrafts(bookId, 'pending', conversation.id)
    ])
    setMessages(messageRows as AiMessage[])
    setConversations(conversationRows as AiConversationRow[])
    setDrafts(draftRows as AiDraftRow[])
    setConversationId(conversation.id)
  }, [bookId])

  const refreshConfig = useCallback(async () => {
    if (!bookId) return
    const [skillRows, overrideRows, profileRow] = await Promise.all([
      window.api.aiGetSkillTemplates(),
      window.api.aiGetSkillOverrides(bookId),
      window.api.aiGetWorkProfile(bookId)
    ])
    setSkills(skillRows as AiSkillTemplate[])
    setOverrides(overrideRows as AiSkillOverride[])
    setProfile(profileRow as AiWorkProfile)
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    const loadAssistantState = async () => {
      const [skillRows, overrideRows, profileRow] = await Promise.all([
        window.api.aiGetSkillTemplates(),
        window.api.aiGetSkillOverrides(bookId),
        window.api.aiGetWorkProfile(bookId)
      ])
      const conversation = (await window.api.aiGetOrCreateConversation(bookId)) as { id: number }
      const [conversationRows, messageRows, draftRows] = await Promise.all([
        window.api.aiGetConversations(bookId),
        window.api.aiGetMessages(conversation.id),
        window.api.aiGetDrafts(bookId, 'pending', conversation.id)
      ])
      if (cancelled) return
      setSkills(skillRows as AiSkillTemplate[])
      setOverrides(overrideRows as AiSkillOverride[])
      setProfile(profileRow as AiWorkProfile)
      setConversations(conversationRows as AiConversationRow[])
      setMessages(messageRows as AiMessage[])
      setDrafts(draftRows as AiDraftRow[])
      setConversationId(conversation.id)
    }

    void loadAssistantState()
    return () => {
      cancelled = true
    }
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    void refreshConfig()
    void refreshConversation(conversationId)
  }, [bookId, conversationId, refreshConfig, refreshConversation])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, drafts.length, loading])

  useEffect(() => {
    setEnabledContextChipIds(
      baseContext.chips.filter((chip) => chip.enabled).map((chip) => chip.id)
    )
  }, [contextDefaultsKey, baseContext])

  useEffect(() => {
    return () => {
      activeRequestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!bookId || !aiAssistantCommand || !conversationId || loading || skills.length === 0) return
    const { id, input: commandInput, autoSend } = aiAssistantCommand
    setInput(commandInput)
    consumeAiAssistantCommand(id)
    if (autoSend) {
      window.setTimeout(() => sendCommandRef.current(commandInput), 0)
    }
  }, [aiAssistantCommand, bookId, consumeAiAssistantCommand, conversationId, loading, skills.length])

  if (!bookId) return null

  const validateSkillBeforeSend = (skill: AiSkillTemplate | null): string | null => {
    if (!skill) return null
    if (skill.key === 'polish_text' && !(aiAssistantSelectionChapterId === currentChapter?.id && aiAssistantSelectionText.trim())) {
      return '请先在编辑器中选中要润色的正文，再使用“润色改写”。'
    }
    if (skill.key === 'continue_writing' && !currentChapter) {
      return '请先打开目标章节，再使用“续写正文”。'
    }
    if (skill.key === 'review_chapter' && !currentChapter) {
      return '请先打开目标章节，再使用“审核本章”。'
    }
    if (skill.key === 'create_chapter' && volumes.length === 0) {
      return '请先创建卷，再使用“创建章节”。'
    }
    return null
  }

  const send = async (explicitSkill?: AiSkillTemplate, explicitInput?: string) => {
    const text = (explicitInput ?? input).trim()
    if (!text || loading || !conversationId) return
    const requestIntent =
      explicitSkill
        ? assistantIntent
        : resolveAssistantIntent({
            skills,
            userInput: text,
            selectedText: aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
            hasCurrentChapter: Boolean(currentChapter),
            hasVolumes: volumes.length > 0
          })
    const skill = explicitSkill || resolveAssistantSkillSelection(skills, overrides, requestIntent.skillKey)
    const skillPreflightError = validateSkillBeforeSend(skill)
    if (skillPreflightError) {
      setError(skillPreflightError)
      return
    }
    setError(null)
    setLoading(true)
    setInput('')

    try {
      const config = await getResolvedAiConfigForBook(bookId)
      const aiConfig = config ? ({ ...(config as AiCallerConfig), bookId, ragMode: 'auto' as const }) : null
      if (!isAiConfigReady(aiConfig)) {
        setError('请先在应用设置中配置 AI 全局账号，或完成 Gemini CLI / Ollama 设置')
        setLoading(false)
        return
      }

      const requestAbortController = new AbortController()
      activeRequestAbortRef.current = requestAbortController
      const requestContext = aiConfig.ai_provider === 'zhengdao_official' ? withLocalRagChip(context) : context

      const prompt = skill
        ? composeSkillPrompt({ skill, profile, context: requestContext, userInput: text })
        : composeAssistantChatPrompt({ profile, context: requestContext, skills, userInput: text })
      const userMessage = (await window.api.aiAddMessage(conversationId, 'user', text, {
        skill_key: skill?.key ?? null,
        mode: skill ? 'skill' : 'chat',
        intent_reason: requestIntent.reason,
        intent_confidence: requestIntent.confidence,
        context_chips: requestContext.chips
      })) as AiMessage
      const pendingMessageId = -Date.now()
      const streamingLabel =
        aiConfig.ai_provider === 'gemini_cli'
          ? 'Gemini 3 Pro 正在生成...'
          : aiConfig.ai_provider === 'zhengdao_official'
            ? '证道官方 AI 正在结合本地片段生成...'
          : 'AI 正在生成...'
      const pendingMessage = createPendingAssistantStreamMessage(pendingMessageId, streamingLabel)
      setMessages((current) => [...current, userMessage, pendingMessage])

      let streamedContent = ''
      let streamError = ''
      const streamChunkQueue = createAssistantStreamChunkQueue((token) => {
        setMessages((current) => appendAssistantStreamToken(current, pendingMessageId, token))
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
        1400,
        0.72,
        { signal: requestAbortController.signal }
      )
      await streamChunkQueue.drain()

      const stopped = requestAbortController.signal.aborted

      if (stopped) {
        if (!streamedContent.trim()) {
          setMessages((current) => current.filter((message) => message.id !== pendingMessageId))
          useToastStore.getState().addToast('info', '已停止生成')
          return
        }

        const assistantMessage = (await window.api.aiAddMessage(conversationId, 'assistant', streamedContent, {
          skill_key: skill?.key ?? null,
          mode: skill ? 'skill' : 'chat',
          stopped: true
        })) as { id: number }
        setMessages((current) =>
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
        await refreshConversation(conversationId)
        return
      }

      if (streamError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? { ...message, streaming: false, content: message.content || '生成失败' }
              : message
          )
        )
        setError(streamError)
        return
      }
      const emptyStreamError = getAssistantStreamEmptyError(streamedContent)
      if (emptyStreamError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? { ...message, streaming: false, content: '生成失败' }
              : message
          )
        )
        setError(emptyStreamError)
        return
      }

      const assistantMessage = (await window.api.aiAddMessage(conversationId, 'assistant', streamedContent, {
        skill_key: skill?.key ?? null,
        mode: skill ? 'skill' : 'chat',
        intent_reason: requestIntent.reason,
        intent_confidence: requestIntent.confidence
      })) as { id: number }
      setMessages((current) =>
        completeAssistantStreamMessage(current, pendingMessageId, assistantMessage.id, streamedContent)
      )
      if (skill) {
        const parsed = normalizeAssistantDrafts(skill, streamedContent)
        const boundDrafts = attachSelectionMetaToDrafts(parsed.drafts, {
          chapterId: aiAssistantSelectionChapterId,
          text: aiAssistantSelectionText,
          from: aiAssistantSelectionFrom,
          to: aiAssistantSelectionTo
        })
        for (const draft of boundDrafts) {
          await window.api.aiCreateDraft({
            book_id: bookId,
            conversation_id: conversationId,
            message_id: assistantMessage.id,
            kind: draft.kind,
            title: draftTitle(draft),
            payload: draft,
            target_ref: currentChapter ? `chapter:${currentChapter.id}` : ''
          })
        }
        if (parsed.errors.length > 0) {
          setError(parsed.errors.join('；'))
        }
      }
      await refreshConversation(conversationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 请求失败')
    } finally {
      setLoading(false)
    }
  }

  sendCommandRef.current = (text) => {
    void send(undefined, text)
  }

  const seedQuickAction = (skill: AiSkillTemplate) => {
    if (skill.key === 'continue_writing') {
      setInput('从当前光标或章节末尾自然续写，保持当前节奏。')
    } else if (skill.key === 'review_chapter') {
      setInput('审核当前章节的节奏、人物一致性、伏笔和毒点风险。')
    } else if (skill.key === 'polish_text') {
      setInput('润色选中文本，保留原意和人物口吻。')
    } else {
      setInput('')
    }
  }

  const markDraft = async (draftId: number, status: 'applied' | 'dismissed') => {
    await window.api.aiSetDraftStatus(draftId, status)
    await refreshConversation(conversationId)
  }

  const createConversation = async () => {
    if (!bookId || loading) return
    const conversation = (await window.api.aiCreateConversation(bookId)) as { id: number }
    await refreshConversation(conversation.id)
  }

  const clearConversation = async () => {
    if (!conversationId || loading) return
    const ok = window.confirm('确认清空当前 AI 会话的聊天记录和待确认草稿？已应用到小说的内容不会回滚。')
    if (!ok) return
    await window.api.aiClearConversation(conversationId)
    await refreshConversation(conversationId)
  }

  const deleteConversation = async (targetConversationId: number) => {
    if (!bookId || loading) return
    const ok = window.confirm('确认删除这个 AI 会话？会删除该会话的聊天记录和关联草稿，已应用到小说的内容不会回滚。')
    if (!ok) return
    const nextConversationId = pickConversationAfterDelete(conversations, targetConversationId, conversationId)
    await window.api.aiDeleteConversation(targetConversationId)
    if (nextConversationId != null) {
      await refreshConversation(nextConversationId)
      return
    }
    const conversation = (await window.api.aiCreateConversation(bookId)) as { id: number }
    await refreshConversation(conversation.id)
  }

  const applyDraft = async (draft: AiDraftRow) => {
    const payload = draft.payload
    try {
      switch (draft.kind) {
        case 'insert_text': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          const plan = planTextDraftApplication(payload as AiDraftPayload, currentChapter.id)
          if (!plan || plan.kind === 'invalid' || plan.kind !== 'insert_text') {
            throw new Error(plan?.kind === 'invalid' ? plan.error : '草稿正文为空')
          }
          const htmlFragment = ensureHtmlContent(plan.content)
          const activeEditor = getActiveEditor()
          if (activeEditor) {
            const beforeHtml = activeEditor.getHTML()
            const beforeWordCount = stripHtmlToText(beforeHtml).replace(/\s/g, '').length
            await window.api.createSnapshot({
              chapter_id: currentChapter.id,
              content: beforeHtml,
              word_count: beforeWordCount
            })
            const maxPos = activeEditor.state.doc.content.size
            const insertAt = Math.max(0, Math.min(plan.insertAt ?? maxPos, maxPos))
            const inserted = activeEditor.commands.insertContentAt(insertAt, htmlFragment)
            if (!inserted) throw new Error('无法将 AI 草稿插入当前正文。')
            const nextHtml = activeEditor.getHTML()
            await updateChapterContent(currentChapter.id, nextHtml, stripHtmlToText(nextHtml).replace(/\s/g, '').length)
          } else {
            const html = `${currentChapter.content || ''}${htmlFragment}`
            await window.api.createSnapshot({
              chapter_id: currentChapter.id,
              content: currentChapter.content || '',
              word_count: currentChapter.word_count || 0
            })
            await updateChapterContent(currentChapter.id, html, stripHtmlToText(html).replace(/\s/g, '').length)
          }
          break
        }
        case 'replace_text': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          const plan = planTextDraftApplication(payload as AiDraftPayload, currentChapter.id)
          if (!plan || plan.kind === 'invalid' || plan.kind !== 'replace_text') {
            throw new Error(plan?.kind === 'invalid' ? plan.error : '替换正文为空')
          }
          const activeEditor = getActiveEditor()
          if (!activeEditor) throw new Error('请返回编辑器后再应用润色草稿。')
          const maxPos = activeEditor.state.doc.content.size
          if (plan.from < 0 || plan.to > maxPos) {
            throw new Error('原选区已失效，请重新生成润色草稿。')
          }
          const liveText = activeEditor.state.doc.textBetween(plan.from, plan.to, '\n')
          if (liveText !== plan.expectedText) {
            throw new Error('原选区已变化，请重新生成润色草稿。')
          }
          const beforeHtml = activeEditor.getHTML()
          const beforeWordCount = stripHtmlToText(beforeHtml).replace(/\s/g, '').length
          await window.api.createSnapshot({
            chapter_id: currentChapter.id,
            content: beforeHtml,
            word_count: beforeWordCount
          })
          const replaced = activeEditor.commands.insertContentAt(
            { from: plan.from, to: plan.to },
            ensureHtmlContent(plan.content)
          )
          if (!replaced) throw new Error('无法将润色草稿应用到当前选区。')
          const nextHtml = activeEditor.getHTML()
          await updateChapterContent(currentChapter.id, nextHtml, stripHtmlToText(nextHtml).replace(/\s/g, '').length)
          break
        }
        case 'create_chapter': {
          const volumeId = volumes[volumes.length - 1]?.id
          if (!volumeId) throw new Error('请先创建卷')
          const chapter = await createChapter(
            volumeId,
            String(payload.title || draft.title || 'AI 新章节'),
            ensureHtmlContent(String(payload.content || '')),
            String(payload.summary || '').trim()
          )
          await selectChapter(chapter.id)
          break
        }
        case 'update_chapter_summary': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          if (currentChapter.summary?.trim()) {
            const ok = window.confirm('当前章节已有摘要。确定用这条 AI 摘要覆盖吗？')
            if (!ok) return
          }
          const summary = String(payload.summary || payload.content || '').trim()
          if (!summary) throw new Error('摘要内容为空')
          await updateChapterSummary(currentChapter.id, summary)
          break
        }
        case 'create_character': {
          await createCharacter({
            book_id: bookId,
            name: String(payload.name || draft.title || 'AI 角色'),
            faction: String(payload.faction || 'neutral'),
            status: String(payload.status || 'active'),
            description: String(payload.description || payload.content || ''),
            custom_fields: (payload.custom_fields || {}) as Record<string, string>
          })
          break
        }
        case 'create_wiki_entry': {
          await createWikiEntry({
            book_id: bookId,
            category: String(payload.category || 'AI 设定'),
            title: String(payload.title || draft.title || 'AI 设定'),
            content: String(payload.content || '')
          })
          break
        }
        case 'create_plot_node': {
          await createPlotNode({
            book_id: bookId,
            title: String(payload.title || draft.title || 'AI 剧情节点'),
            description: String(payload.description || payload.content || ''),
            chapter_number: Number(payload.chapter_number || 0),
            score: Math.max(-5, Math.min(5, Number(payload.score || 0))),
            node_type: payload.node_type === 'branch' ? 'branch' : 'main'
          })
          break
        }
        case 'create_foreshadowing': {
          await createForeshadowing({
            book_id: bookId,
            chapter_id: currentChapter?.id,
            text: String(payload.text || payload.content || draft.title || 'AI 伏笔'),
            expected_chapter: payload.expected_chapter == null ? null : Number(payload.expected_chapter),
            expected_word_count: payload.expected_word_count == null ? null : Number(payload.expected_word_count),
            status: 'pending'
          })
          break
        }
        // GP-05 v2: 5 个 academic / professional 题材专属 kind 的副作用。
        // 引用 / Reference / 政策对照统一落到 wiki_entries (复用 settings_wiki)
        // 用 category 区分；apply_format_template 用 DI-05 公文模板包装章节
        // 正文。create_section_outline 因为 chapters 表当前没有 outline 字段
        // 暂不支持，等 DI-02 引用管理 / DI-07 Canon Pack v2 给章节加上 outline
        // 列后再补。
        case 'create_citation': {
          const authors = Array.isArray(payload.authors)
            ? (payload.authors as unknown[]).map(String).filter(Boolean).join('，')
            : String(payload.authors || '')
          const formatted = String(
            payload.formatted ||
              `${authors}. ${String(payload.title || '')}. ${String(payload.source || '')}, ${String(payload.year || '')}.`
          ).trim()
          await createWikiEntry({
            book_id: bookId,
            category: 'citation',
            title: String(payload.title || draft.title || 'AI 引用'),
            content: JSON.stringify(
              {
                formatted,
                authors,
                year: payload.year ?? '',
                source: payload.source ?? '',
                doi: payload.doi ?? '',
                format: payload.format ?? 'GBT7714'
              },
              null,
              2
            )
          })
          break
        }
        case 'create_reference': {
          await createWikiEntry({
            book_id: bookId,
            category: 'reference',
            title: String(payload.title || draft.title || 'AI 文献'),
            content: String(payload.content || JSON.stringify(payload, null, 2))
          })
          break
        }
        case 'create_policy_anchor': {
          await createWikiEntry({
            book_id: bookId,
            category: 'policy',
            title: String(payload.title || payload.policyName || draft.title || 'AI 政策依据'),
            content: JSON.stringify(
              {
                policyNumber: payload.policyNumber ?? '',
                issuer: payload.issuer ?? '',
                date: payload.policyDate ?? payload.date ?? '',
                excerpt: payload.excerpt ?? payload.content ?? ''
              },
              null,
              2
            )
          })
          break
        }
        case 'apply_format_template': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          const templateId = String(payload.templateName || payload.templateId || '')
          if (!templateId || !getProfessionalTemplate(templateId)) {
            throw new Error('未指定有效的公文模板（如 red-header-notice / request 等）')
          }
          const original = stripHtmlToText(currentChapter.content || '')
          const rawContentToWrap = String(payload.contentToWrap || original).trim()
          if (!rawContentToWrap) throw new Error('章节内容为空，无法套用公文模板')
          const fields = (payload.fields as Record<string, string>) ?? {}
          const wrapped = applyProfessionalTemplate(templateId, rawContentToWrap, fields)
          await window.api.createSnapshot({
            chapter_id: currentChapter.id,
            content: currentChapter.content ?? '',
            word_count: stripHtmlToText(currentChapter.content || '').replace(/\s/g, '').length
          })
          const wrappedHtml = wrapped
            .split('\n\n')
            .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('')
          await updateChapterContent(
            currentChapter.id,
            wrappedHtml,
            stripHtmlToText(wrappedHtml).replace(/\s/g, '').length
          )
          break
        }
        case 'create_section_outline': {
          throw new Error('章节大纲草稿暂不支持，等待 DI-02 引用管理 / DI-07 Canon Pack v2 上线后启用。')
        }
        default:
          throw new Error('暂不支持应用该草稿')
      }
      await markDraft(draft.id, 'applied')
      useToastStore.getState().addToast('success', 'AI 草稿已应用')
    } catch (err) {
      useToastStore.getState().addToast('error', err instanceof Error ? err.message : '应用草稿失败')
    }
  }

  const quickActions = [
    {
      key: 'continue_writing',
      label: '续写当前章',
      description: '从当前章节末尾或光标位置继续推进正文。',
      disabled: !currentChapter
    },
    {
      key: 'polish_text',
      label: '润色选区',
      description: '改写当前选中文本，保留原意和人物口吻。',
      disabled: !(aiAssistantSelectionChapterId === currentChapter?.id && aiAssistantSelectionText.trim())
    },
    {
      key: 'review_chapter',
      label: '审核本章',
      description: '检查节奏、毒点、伏笔和人物一致性。',
      disabled: !currentChapter
    }
  ]
  return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-secondary)]">
          <div
            className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3"
          >
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Bot size={17} className="text-[var(--accent-primary)]" />
              <span className="shrink-0">AI 创作助手</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConversationListOpen((open) => !open)}
                title="会话列表"
                className={`rounded p-1.5 ${
                  conversationListOpen
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MessageSquare size={16} />
              </button>
              <button
                type="button"
                onClick={() => void createConversation()}
                title="新建 AI 会话"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <MessageSquarePlus size={16} />
              </button>
              <button
                type="button"
                onClick={() => void clearConversation()}
                title="清空当前会话"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-surface)] hover:text-[var(--danger-primary)]"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => openModal('aiSettings')}
                title="AI 能力与作品配置"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <Settings2 size={16} />
              </button>
              <button
                type="button"
                onClick={closeAiAssistant}
                title="收起 AI 助手"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {conversationListOpen && (
            <div
              className="absolute right-0 top-12 bottom-0 z-20 flex w-64 flex-col border-l border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border-primary)] px-3">
                <div className="text-xs font-bold text-[var(--text-primary)]">会话历史</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void createConversation()}
                    title="新建 AI 会话"
                    className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <MessageSquarePlus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConversationListOpen(false)}
                    title="关闭会话列表"
                    className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                {conversationItems.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group flex items-start gap-2 rounded-lg border p-2 ${
                      conversation.selected
                        ? 'border-[var(--accent-border)] bg-[var(--accent-surface)]'
                        : 'border-transparent hover:border-[var(--border-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void refreshConversation(conversation.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                        {conversation.label}
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {conversation.messageCount} 条消息
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                        {conversation.updatedAt}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conversation.id)}
                      title="删除会话"
                      className="rounded p-1 text-[var(--text-muted)] opacity-70 hover:bg-[var(--danger-surface)] hover:text-[var(--danger-primary)] group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
                  直接输入你的写作意图即可。AI 会自动选择续写、润色、审稿或资产生成；涉及正文和资产的结果会先进入草稿篮。
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {quickActions.map((action) => {
                    const skill = skills.find((item) => item.key === action.key)
                    return (
                    <button
                      key={action.key}
                      type="button"
                      disabled={!skill || action.disabled}
                      onClick={() => {
                        if (skill) seedQuickAction(skill)
                      }}
                      className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-left transition hover:border-[var(--accent-border)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Sparkles size={13} className="text-[var(--accent-primary)]" /> {action.label}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] text-[var(--text-muted)]">{action.description}</div>
                    </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {context.chips.map((chip) => (
                <span
                  key={chip.id}
                  className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                >
                  {chip.label}
                </span>
              ))}
            </div>

            {messages.map((message) => {
              const display = buildAssistantMessageDisplay(message)

              return (
                <div
                  key={message.id}
                  className={`rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'ml-8 border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]'
                      : 'mr-8 border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
                  }`}
                >
                  {display.kind === 'drafts' ? (
                    <div className="space-y-2 whitespace-normal">
                      <div className="text-xs text-[var(--text-secondary)]">{display.intro}</div>
                      <div className="space-y-2">
                        {display.drafts.map((draft, index) => (
                          <div
                            key={`${draft.title}-${index}`}
                            className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2"
                          >
                            <div className="font-medium text-[var(--text-primary)]">{draft.title}</div>
                            {draft.summary && (
                              <div className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                                {draft.summary}
                              </div>
                            )}
                            {draft.fields.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {draft.fields.map((field) => (
                                  <span
                                    key={`${draft.title}-${field.label}`}
                                    className="rounded border border-[var(--border-primary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                                  >
                                    {field.label}: {field.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    display.text ||
                    (message.streaming && message.streamingLabel ? (
                      <span className="text-xs text-[var(--text-muted)]">{message.streamingLabel}</span>
                    ) : (
                      ''
                    ))
                  )}
                  {message.streaming && (
                    <span className="ml-1 inline-flex translate-y-0.5">
                      <Loader2 size={12} className="animate-spin text-[var(--accent-primary)]" />
                    </span>
                  )}
                </div>
              )
            })}

            {drafts.length > 0 && (
              <div className="space-y-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--warning-primary)]">
                  <ClipboardCheck size={14} /> 草稿篮
                </div>
                {drafts.map((draft) => {
                  const preview = buildDraftPreviewModel(draft)
                  return (
                    <div key={draft.id} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {preview.title || draft.title || draft.kind}
                          </div>
                          {preview.summary && (
                            <div className="mt-1 max-h-24 overflow-y-auto text-[11px] leading-relaxed text-[var(--text-muted)] whitespace-pre-wrap">
                              {preview.summary}
                            </div>
                          )}
                          {preview.fields.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {preview.fields.map((field) => (
                                <div
                                  key={`${draft.id}-${field.label}`}
                                  className="rounded border border-[var(--border-primary)] px-2 py-1"
                                >
                                  <div className="text-[10px] text-[var(--text-muted)]">{field.label}</div>
                                  <div className="truncate text-[11px] text-[var(--text-secondary)]">{field.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => void applyDraft(draft)}
                            title="确认应用"
                            className="rounded bg-[var(--accent-primary)] p-1.5 text-[var(--accent-contrast)] hover:bg-[var(--accent-secondary)]"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void markDraft(draft.id, 'dismissed')}
                            title="丢弃草稿"
                            className="rounded border border-[var(--border-secondary)] p-1.5 text-[var(--text-muted)] hover:text-[var(--danger-primary)]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-muted)]">
                <Loader2 size={14} className="animate-spin" /> {selectedSkill ? 'AI 正在生成草稿...' : 'AI 正在回复...'}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-surface)] p-2 text-xs text-[var(--danger-primary)]">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (shouldSubmitAiAssistantInput(event)) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="直接描述你要 AI 做什么。Enter 发送，Shift + Enter 换行"
                className="field resize-none text-xs"
              />
              <button
                type="button"
                disabled={!input.trim() || loading}
                onClick={() => void send()}
                className="primary-btn self-stretch px-3"
                title="发送"
              >
                <Send size={15} />
              </button>
            </div>
          </div>

        </div>
  )
}

export default function AiAssistantDock() {
  const bookId = useBookStore((s) => s.currentBookId)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const aiAssistantLauncherPosition = useUIStore((s) => s.aiAssistantLauncherPosition)
  const setAiAssistantLauncherPosition = useUIStore((s) => s.setAiAssistantLauncherPosition)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)
  const launcherPositionRef = useRef(aiAssistantLauncherPosition)
  const launcherClickSuppressedRef = useRef(false)
  const interactionCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    launcherPositionRef.current = aiAssistantLauncherPosition
  }, [aiAssistantLauncherPosition])

  useEffect(() => {
    const handleWindowResize = () => {
      setAiAssistantLauncherPosition(launcherPositionRef.current)
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [setAiAssistantLauncherPosition])

  useEffect(() => {
    return () => {
      interactionCleanupRef.current?.()
    }
  }, [])

  if (!bookId || rightPanelOpen) return null

  const handleLauncherDragStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startPosition = launcherPositionRef.current
    const previousUserSelect = document.body.style.userSelect
    let moved = false

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        moved = true
      }
      setAiAssistantLauncherPosition(
        translateAiAssistantLauncherPosition(
          startPosition,
          deltaX,
          deltaY,
          window.innerWidth,
          window.innerHeight
        )
      )
    }

    const cleanup = () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', cleanup)
      interactionCleanupRef.current = null
      if (moved) {
        launcherClickSuppressedRef.current = true
        window.setTimeout(() => {
          launcherClickSuppressedRef.current = false
        }, 0)
      }
    }

    interactionCleanupRef.current?.()
    interactionCleanupRef.current = cleanup
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', cleanup)
  }

  return (
    <button
      type="button"
      onMouseDown={handleLauncherDragStart}
      onClick={(event) => {
        if (launcherClickSuppressedRef.current) {
          event.preventDefault()
          launcherClickSuppressedRef.current = false
          return
        }
        openAiAssistant()
      }}
      className="fixed z-40 flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-xl shadow-[0_10px_24px_rgba(63,111,159,0.22)] transition hover:bg-[var(--accent-secondary)] active:cursor-grabbing"
      style={{
        left: aiAssistantLauncherPosition.x,
        top: aiAssistantLauncherPosition.y,
        touchAction: 'none'
      }}
      title="拖动或打开 AI 创作助手"
      aria-label="拖动或打开 AI 创作助手"
    >
      <Bot size={22} />
    </button>
  )
}

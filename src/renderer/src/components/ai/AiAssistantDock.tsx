import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, ChevronDown, ClipboardCheck, GripVertical, Loader2, MessageSquare, MessageSquarePlus, Send, Settings2, Sparkles, Trash2, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { useWikiStore } from '@/stores/wiki-store'
import { aiPromptStream, isAiConfigReady, type AiCallerConfig } from '@/utils/ai'
import {
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
import { buildConversationListItems, pickConversationAfterDelete } from './conversation-list'
import { resolveAssistantSkillSelection } from './conversation-mode'
import { shouldSubmitAiAssistantInput } from './input-behavior'
import { buildDraftPreviewModel } from './draft-preview'
import { buildAssistantMessageDisplay } from './message-display'
import {
  resizeAiAssistantPanelRect,
  translateAiAssistantPanelRect,
  type AiAssistantPanelRect
} from './panel-layout'
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

export default function AiAssistantDock() {
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
    aiAssistantOpen,
    aiAssistantSkillKey,
    aiAssistantPanelRect,
    aiAssistantSelectionText,
    aiAssistantSelectionChapterId,
    aiAssistantSelectionFrom,
    aiAssistantSelectionTo,
    openAiAssistant,
    closeAiAssistant,
    setAiAssistantSkillKey,
    setAiAssistantPanelRect,
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
  const [context, setContext] = useState<AiAssistantContext>({ contextText: '', chips: [] })
  const [conversationListOpen, setConversationListOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRectRef = useRef(aiAssistantPanelRect)
  const interactionCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    panelRectRef.current = aiAssistantPanelRect
  }, [aiAssistantPanelRect])

  const selectedSkill = useMemo(() => {
    return resolveAssistantSkillSelection(skills, overrides, aiAssistantSkillKey)
  }, [skills, overrides, aiAssistantSkillKey])
  const conversationItems = useMemo(
    () => buildConversationListItems(conversations, conversationId),
    [conversations, conversationId]
  )

  const refreshConversation = async (targetConversationId?: number | null) => {
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
  }

  const refreshConfig = async () => {
    if (!bookId) return
    const [skillRows, overrideRows, profileRow] = await Promise.all([
      window.api.aiGetSkillTemplates(),
      window.api.aiGetSkillOverrides(bookId),
      window.api.aiGetWorkProfile(bookId)
    ])
    setSkills(skillRows as AiSkillTemplate[])
    setOverrides(overrideRows as AiSkillOverride[])
    setProfile(profileRow as AiWorkProfile)
  }

  const rebuildContext = () => {
    const chapterPlain = currentChapter?.content ? stripHtmlToText(currentChapter.content) : ''
    setContext(
      buildAssistantContext({
        policy: resolveAssistantContextPolicy(selectedSkill, profile),
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
    )
  }

  useEffect(() => {
    if (!bookId) return
    void refreshConfig()
    void refreshConversation()
  }, [bookId])

  useEffect(() => {
    rebuildContext()
  }, [
    selectedSkill?.context_policy,
    profile?.context_policy,
    currentChapter?.id,
    currentChapter?.content,
    aiAssistantSelectionChapterId,
    aiAssistantSelectionText,
    characters,
    foreshadowings,
    plotNodes
  ])

  useEffect(() => {
    if (aiAssistantSkillKey) setInput('')
  }, [aiAssistantSkillKey])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, drafts.length, loading])

  useEffect(() => {
    const onWindowResize = () => {
      setAiAssistantPanelRect(panelRectRef.current)
    }
    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
  }, [setAiAssistantPanelRect])

  useEffect(() => {
    return () => {
      interactionCleanupRef.current?.()
    }
  }, [])

  if (!bookId) return null

  const send = async (explicitSkill?: AiSkillTemplate, explicitInput?: string) => {
    const skill = explicitSkill || selectedSkill
    const text = (explicitInput ?? input).trim()
    if (!text || loading || !conversationId) return
    if (skill?.key === 'polish_text' && !(aiAssistantSelectionChapterId === currentChapter?.id && aiAssistantSelectionText.trim())) {
      setError('请先在编辑器中选中要润色的正文，再使用“润色改写”。')
      return
    }
    setError(null)
    setLoading(true)
    setInput('')

    try {
      const [config] = await Promise.all([window.api.aiGetResolvedConfigForBook(bookId)])
      if (!isAiConfigReady(config as AiCallerConfig)) {
        setError('请先在 AI 配置中设置全局账号或完成 Gemini CLI / Ollama 配置')
        setLoading(false)
        return
      }

      const prompt = skill
        ? composeSkillPrompt({ skill, profile, context, userInput: text })
        : composeAssistantChatPrompt({ profile, context, skills, userInput: text })
      const userMessage = (await window.api.aiAddMessage(conversationId, 'user', text, {
        skill_key: skill?.key ?? null,
        mode: skill ? 'skill' : 'chat',
        context_chips: context.chips
      })) as AiMessage
      const pendingMessageId = -Date.now()
      const streamingLabel =
        (config as AiCallerConfig).ai_provider === 'gemini_cli'
          ? 'Gemini 3 Pro 正在生成...'
          : 'AI 正在生成...'
      const pendingMessage = createPendingAssistantStreamMessage(pendingMessageId, streamingLabel)
      setMessages((current) => [...current, userMessage, pendingMessage])

      let streamedContent = ''
      let streamError = ''
      const streamChunkQueue = createAssistantStreamChunkQueue((token) => {
        setMessages((current) => appendAssistantStreamToken(current, pendingMessageId, token))
      })
      await aiPromptStream(
        config as AiCallerConfig,
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
        0.72
      )
      await streamChunkQueue.drain()

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
        mode: skill ? 'skill' : 'chat'
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

  const runSkill = (skill: AiSkillTemplate) => {
    setAiAssistantSkillKey(skill.key)
    if (skill.key === 'continue_writing') {
      setInput('从当前光标或章节末尾自然续写，保持当前节奏。')
    } else if (skill.key === 'review_chapter') {
      setInput('审核当前章节的节奏、人物一致性、伏笔和毒点风险。')
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
            ensureHtmlContent(String(payload.content || ''))
          )
          await selectChapter(chapter.id)
          break
        }
        case 'update_chapter_summary': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          await updateChapterSummary(currentChapter.id, String(payload.summary || payload.content || ''))
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
        default:
          throw new Error('暂不支持应用该草稿')
      }
      await markDraft(draft.id, 'applied')
      useToastStore.getState().addToast('success', 'AI 草稿已应用')
    } catch (err) {
      useToastStore.getState().addToast('error', err instanceof Error ? err.message : '应用草稿失败')
    }
  }

  const open = () => {
    openAiAssistant()
    void refreshConfig()
    void refreshConversation()
  }

  const beginPointerInteraction =
    (
      onMove: (event: MouseEvent, startRect: AiAssistantPanelRect, startX: number, startY: number) => void
    ) =>
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const startRect = panelRectRef.current
      const previousUserSelect = document.body.style.userSelect

      const handleMove = (moveEvent: MouseEvent) => {
        onMove(moveEvent, startRect, startX, startY)
      }

      const cleanup = () => {
        document.body.style.userSelect = previousUserSelect
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', cleanup)
        interactionCleanupRef.current = null
      }

      interactionCleanupRef.current?.()
      interactionCleanupRef.current = cleanup
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', cleanup)
    }

  const handleDragStart = beginPointerInteraction((moveEvent, startRect, startX, startY) => {
    setAiAssistantPanelRect(
      translateAiAssistantPanelRect(
        startRect,
        moveEvent.clientX - startX,
        moveEvent.clientY - startY,
        window.innerWidth,
        window.innerHeight
      )
    )
  })

  const handleResizeStart = beginPointerInteraction((moveEvent, startRect, startX, startY) => {
    setAiAssistantPanelRect(
      resizeAiAssistantPanelRect(
        startRect,
        moveEvent.clientX - startX,
        moveEvent.clientY - startY,
        window.innerWidth,
        window.innerHeight
      )
    )
  })

  return (
    <>
      {aiAssistantOpen && (
        <div
          className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl"
          style={{
            left: aiAssistantPanelRect.x,
            top: aiAssistantPanelRect.y,
            width: aiAssistantPanelRect.width,
            height: aiAssistantPanelRect.height
          }}
        >
          <div
            onMouseDown={handleDragStart}
            className="flex h-12 shrink-0 cursor-move items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-4"
          >
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Bot size={17} className="text-emerald-400" />
              <span className="shrink-0">AI 创作助手</span>
              <GripVertical size={14} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex items-center gap-1" onMouseDown={(event) => event.stopPropagation()}>
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
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-red-400"
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
                <ChevronDown size={16} />
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
                        ? 'border-emerald-500/35 bg-emerald-500/10'
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
                      className="rounded p-1 text-[var(--text-muted)] opacity-70 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
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
                  可以对话，也可以直接调用能力卡。涉及正文、章节和资产的结果会先进入草稿篮，确认后才写入作品。
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {skills.map((skill) => (
                    <button
                      key={skill.key}
                      type="button"
                      onClick={() => runSkill(skill)}
                      className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-left transition hover:border-emerald-500/40"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Sparkles size={13} className="text-emerald-400" /> {skill.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] text-[var(--text-muted)]">{skill.description}</div>
                    </button>
                  ))}
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
                      ? 'ml-8 border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
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
                      <Loader2 size={12} className="animate-spin text-emerald-400" />
                    </span>
                  )}
                </div>
              )
            })}

            {drafts.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
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
                            className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-500"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void markDraft(draft.id, 'dismissed')}
                            title="丢弃草稿"
                            className="rounded border border-[var(--border-secondary)] p-1.5 text-[var(--text-muted)] hover:text-red-400"
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
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <select
                value={selectedSkill?.key || ''}
                onChange={(event) => setAiAssistantSkillKey(event.target.value || null)}
                className="field py-1.5 text-xs"
              >
                <option value="">普通对话 / 自动识别</option>
                {skills.map((skill) => (
                  <option key={skill.key} value={skill.key}>
                    {skill.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => openModal('aiSettings')}
                className="secondary-btn shrink-0"
                title="配置能力"
              >
                <Settings2 size={13} />
              </button>
            </div>
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
                placeholder="普通提问，或选择能力卡执行写作任务。Enter 发送，Shift + Enter 换行"
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

          <div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            title="拖动调整大小"
          >
            <div className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-sm border-r-2 border-b-2 border-[var(--text-muted)]" />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (aiAssistantOpen) {
            closeAiAssistant()
            return
          }
          open()
        }}
        className={`fixed bottom-28 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border shadow-xl transition ${
          aiAssistantOpen
            ? 'border-[var(--border-secondary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
            : 'border-emerald-500 bg-emerald-600 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:bg-emerald-500'
        }`}
        title="打开 AI 创作助手"
        aria-label="打开 AI 创作助手"
      >
        {aiAssistantOpen ? <X size={20} /> : <Bot size={22} />}
      </button>
    </>
  )
}

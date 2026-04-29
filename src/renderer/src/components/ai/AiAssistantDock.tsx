import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore, type AiChapterDraft, type InlineAiDraft } from '@/stores/ui-store'
import { useWikiStore } from '@/stores/wiki-store'
import { aiPromptStream, getResolvedGlobalAiConfig, isAiConfigReady, type AiCallerConfig } from '@/utils/ai'
import {
  applyAssistantContextSelection,
  attachSelectionMetaToDrafts,
  buildAssistantContext,
  composeAssistantChatPrompt,
  composeSkillPrompt,
  resolveAssistantContextPolicy,
  type AiAssistantContext,
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { stripHtmlToText } from '@/utils/html-to-text'
import { buildConversationListItems, pickConversationAfterDelete } from './conversation-list'
import { buildChapterEditorQuickActions, isBlankChapterContent } from './chapter-quick-actions'
import {
  resolveAssistantIntent,
  resolveAssistantSkillSelection
} from './conversation-mode'
import { buildDraftPreviewModel } from './draft-preview'
import { DEFAULT_CONTINUE_INPUT, toAiChapterDraft, toInlineAiDraft } from './inline-draft'
import { translateAiAssistantLauncherPosition } from './panel-layout'
import {
  appendAssistantStreamToken,
  completeAssistantStreamMessage,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  getAssistantStreamEmptyError,
  replaceAssistantStreamContent
} from './streaming-message'
import { resolveAssistantContext } from '@/utils/ai/assistant-context'
import { BookshelfCreationAssistantPanel } from './book-creation/BookshelfCreationAssistantPanel'
import {
  draftTitle,
  ensureHtmlContent,
  formatProviderLabel,
  normalizeAssistantDrafts,
  withLocalRagChip
} from './ai-assistant-helpers'
import { applyAiDraft } from './assistant-draft-application'
import { useAiAssistantData } from './useAiAssistantData'
import { useAiAssistantRequest } from './useAiAssistantRequest'
import { AssistantPanelComposer } from './panel-parts/AssistantPanelComposer'
import { AssistantPanelHeader } from './panel-parts/AssistantPanelHeader'
import { ConversationListDropdown } from './panel-parts/ConversationListDropdown'
import { DraftListPanel } from './panel-parts/DraftListPanel'
import { MessageStreamArea } from './panel-parts/MessageStreamArea'

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
  conversation_id?: number | null
  kind: string
  title: string
  payload: Record<string, unknown>
  status: 'pending' | 'applied' | 'dismissed'
  target_ref?: string
}

export function AiAssistantPanel() {
  const bookId = useBookStore((s) => s.currentBookId)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const volumes = useChapterStore((s) => s.volumes)
  const createVolume = useChapterStore((s) => s.createVolume)
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
    setInlineAiDraft,
    clearInlineAiDraft,
    setAiChapterDraft,
    clearAiChapterDraft,
    openModal,
    activeModal
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
  const [providerLabel, setProviderLabel] = useState('未配置')
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
        ? { id: currentChapter.id, title: currentChapter.title, plainText: chapterPlain, summary: currentChapter.summary }
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
  const resolvedPanelContext = useMemo(
    () =>
      resolveAssistantContext({
        currentBookId: bookId,
        currentChapterTitle: currentChapter?.title,
        hasSelection: aiAssistantSelectionChapterId === currentChapter?.id && Boolean(aiAssistantSelectionText.trim()),
        activeModal
      }),
    [activeModal, aiAssistantSelectionChapterId, aiAssistantSelectionText, bookId, currentChapter?.id, currentChapter?.title]
  )
  const hasCurrentSelection = aiAssistantSelectionChapterId === currentChapter?.id && Boolean(aiAssistantSelectionText.trim())
  const currentChapterIsBlank = Boolean(currentChapter && isBlankChapterContent(currentChapter.content))

  const { refreshConversation, refreshConfig } = useAiAssistantData({
    bookId,
    currentChapterId: currentChapter?.id,
    setSkills,
    setOverrides,
    setProfile,
    setConversations,
    setMessages,
    setDrafts,
    setConversationId,
    setInlineAiDraft,
    clearInlineAiDraft,
    setAiChapterDraft,
    clearAiChapterDraft
  })

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    void getResolvedGlobalAiConfig()
      .then((config) => {
        if (!cancelled) setProviderLabel(formatProviderLabel(config?.ai_provider))
      })
      .catch(() => {
        if (!cancelled) setProviderLabel('未配置')
      })
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

  const { send } = useAiAssistantRequest({
    input,
    loading,
    conversationId,
    bookId,
    context,
    profile,
    skills,
    overrides,
    assistantIntent,
    currentChapter,
    volumes,
    aiAssistantSelectionChapterId,
    aiAssistantSelectionText,
    aiAssistantSelectionFrom,
    aiAssistantSelectionTo,
    setMessages,
    setError,
    setLoading,
    setInput,
    setInlineAiDraft,
    setAiChapterDraft,
    activeRequestAbortRef,
    refreshConversation
  })


  useEffect(() => {
    sendCommandRef.current = (text) => {
      void send(undefined, text)
    }
  })

  if (!bookId) return <BookshelfCreationAssistantPanel />

  const seedQuickAction = (skill: AiSkillTemplate, actionInput?: string) => {
    if (actionInput) {
      setInput(actionInput)
    } else if (skill.key === 'continue_writing') {
      setInput(DEFAULT_CONTINUE_INPUT)
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
    await applyAiDraft(draft, {
      currentChapter,
      bookId,
      volumes,
      updateChapterContent,
      createVolume,
      createChapter,
      selectChapter,
      updateChapterSummary,
      createCharacter,
      createWikiEntry,
      createPlotNode,
      createForeshadowing,
      markDraft
    })
  }

  const quickActions =
    resolvedPanelContext.surface === 'chapter_editor'
      ? buildChapterEditorQuickActions({
          currentChapter,
          volumes,
          hasSelection: hasCurrentSelection
        })
      : resolvedPanelContext.quickActions.map((action) => ({
          key: action.key,
          label: action.label,
          description: resolvedPanelContext.description,
          disabled: Boolean(action.disabled),
          input: action.input
        }))
  const showStarterActions = messages.length === 0 || (resolvedPanelContext.surface === 'chapter_editor' && currentChapterIsBlank)
  return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-secondary)]">
          <AssistantPanelHeader
            title={resolvedPanelContext.title}
            providerLabel={providerLabel}
            conversationListOpen={conversationListOpen}
            profileGenre={profile?.genre}
            hasSelectedTextForCurrentChapter={aiAssistantSelectionChapterId === currentChapter?.id}
            selectedText={aiAssistantSelectionText}
            onToggleConversationList={() => setConversationListOpen((open) => !open)}
            onCreateConversation={() => void createConversation()}
            onClearConversation={() => void clearConversation()}
            onOpenDialogueRewrite={(selectedText) =>
              openModal('dialogueRewrite', { selectedText })
            }
            onOpenWorldConsistency={() => openModal('worldConsistency')}
            onOpenCitationsManager={() => openModal('citationsManager')}
            onOpenTeamManagement={() => openModal('teamManagement')}
            onOpenAiSettings={() => openModal('aiSettings')}
            onClose={closeAiAssistant}
          />

          <ConversationListDropdown
            open={conversationListOpen}
            items={conversationItems}
            onClose={() => setConversationListOpen(false)}
            onCreate={() => void createConversation()}
            onSelect={(conversationId) => void refreshConversation(conversationId)}
            onDelete={(conversationId) => void deleteConversation(conversationId)}
          />

          <MessageStreamArea
            ref={scrollRef}
            messages={messages}
            contextChips={context.chips}
            showStarterActions={showStarterActions}
            starterDescription={resolvedPanelContext.description}
            starterFooter={
              resolvedPanelContext.surface === 'chapter_editor'
                ? ' 直接输入你的写作意图即可；涉及正文和资产的结果会先进入草稿篮。'
                : ' 直接输入目标，助手会按当前页面切换建议和输出方式。'
            }
            quickActions={quickActions.map((action) => ({
              key: action.key,
              label: action.label,
              description: action.description,
              disabled: Boolean(action.disabled),
              input: (action as { input?: string }).input
            }))}
            skills={skills}
            onSeedSkill={(skill, input) => seedQuickAction(skill, input)}
            onPrefillInput={(input) => setInput(input)}
          >
            <DraftListPanel
              drafts={drafts}
              onApply={(draft) => void applyDraft(draft)}
              onDismiss={(draftId) => void markDraft(draftId, 'dismissed')}
            />

            {error && (
              <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-surface)] p-2 text-xs text-[var(--danger-primary)]">
                {error}
              </div>
            )}
          </MessageStreamArea>

          <AssistantPanelComposer
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            loading={loading}
            quickActions={quickActions.map((action) => ({
              key: action.key,
              label: action.label,
              description: action.description,
              disabled: Boolean(action.disabled),
              input: (action as { input?: string }).input
            }))}
            skills={skills}
            onSeedSkill={(skill, input) => seedQuickAction(skill, input)}
            onPrefillInput={(input) => setInput(input)}
          />

        </div>
  )
}

export default function AiAssistantDock() {
  const bookId = useBookStore((s) => s.currentBookId)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const aiAssistantOpen = useUIStore((s) => s.aiAssistantOpen)
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

  if (!bookId) {
    if (!aiAssistantOpen) return null
    return (
      <div className="fixed bottom-0 right-0 top-12 z-40 w-[min(920px,calc(100vw-24px))] border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <AiAssistantPanel />
      </div>
    )
  }

  if (rightPanelOpen) return null

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

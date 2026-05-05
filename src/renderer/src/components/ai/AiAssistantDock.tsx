import { useCallback, useEffect, useRef, useState } from 'react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useUIStore } from '@/stores/ui-store'
import { useWikiStore } from '@/stores/wiki-store'
import { getResolvedGlobalAiConfig } from '@/utils/ai'
import {
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { pickConversationAfterDelete } from './conversation-list'
import { buildChapterEditorQuickActions } from './chapter-quick-actions'
import { DEFAULT_CONTINUE_INPUT } from './inline-draft'
import { BookshelfCreationAssistantPanel } from './book-creation/BookshelfCreationAssistantPanel'
import { formatProviderLabel } from './ai-assistant-helpers'
import { applyAiDraft } from './assistant-draft-application'
import { useAiAssistantContext } from './useAiAssistantContext'
import { useAiAssistantData } from './useAiAssistantData'
import { useAiAssistantRequest } from './useAiAssistantRequest'
import { AssistantPanelComposer } from './panel-parts/AssistantPanelComposer'
import { AssistantPanelHeader } from './panel-parts/AssistantPanelHeader'
import { ConversationListDropdown } from './panel-parts/ConversationListDropdown'
import { DraftListPanel } from './panel-parts/DraftListPanel'
import { MessageStreamArea } from './panel-parts/MessageStreamArea'
import { StoryFactProposalPanel } from './panel-parts/StoryFactProposalPanel'
import { resolveSeededAssistantSkill } from './conversation-mode'
import {
  DEFAULT_ASSISTANT_INTERACTION_MODE,
  isAssistantInteractionMode,
  type AssistantInteractionMode
} from './assistant-interaction-mode'
import type { StoryFactProposal } from '../../../../shared/story-bible'

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

const ASSISTANT_MODE_STORAGE_KEY = 'zhengdao.aiAssistant.interactionMode'

function readStoredAssistantMode(): AssistantInteractionMode {
  if (typeof window === 'undefined') return DEFAULT_ASSISTANT_INTERACTION_MODE
  const value = window.localStorage.getItem(ASSISTANT_MODE_STORAGE_KEY)
  return isAssistantInteractionMode(value) ? value : DEFAULT_ASSISTANT_INTERACTION_MODE
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
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)
  const createCharacter = useCharacterStore((s) => s.createCharacter)
  const foreshadowings = useForeshadowStore((s) => s.foreshadowings)
  const createForeshadowing = useForeshadowStore((s) => s.createForeshadowing)
  const plotNodes = usePlotStore((s) => s.plotNodes)
  const createPlotNode = usePlotStore((s) => s.createPlotNode)
  const createWikiEntry = useWikiStore((s) => s.createEntry)
  const aiAssistantSelectionText = useUIStore((s) => s.aiAssistantSelectionText)
  const aiAssistantSelectionChapterId = useUIStore((s) => s.aiAssistantSelectionChapterId)
  const aiAssistantSelectionFrom = useUIStore((s) => s.aiAssistantSelectionFrom)
  const aiAssistantSelectionTo = useUIStore((s) => s.aiAssistantSelectionTo)
  const aiAssistantCommand = useUIStore((s) => s.aiAssistantCommand)
  const closeAiAssistant = useUIStore((s) => s.closeAiAssistant)
  const consumeAiAssistantCommand = useUIStore((s) => s.consumeAiAssistantCommand)
  const setInlineAiDraft = useUIStore((s) => s.setInlineAiDraft)
  const clearInlineAiDraft = useUIStore((s) => s.clearInlineAiDraft)
  const setAiChapterDraft = useUIStore((s) => s.setAiChapterDraft)
  const clearAiChapterDraft = useUIStore((s) => s.clearAiChapterDraft)
  const openModal = useUIStore((s) => s.openModal)
  const activeModal = useUIStore((s) => s.activeModal)

  const [conversationId, setConversationId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<AiConversationRow[]>([])
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [drafts, setDrafts] = useState<AiDraftRow[]>([])
  const [storyFacts, setStoryFacts] = useState<StoryFactProposal[]>([])
  const [storyFactBusyIds, setStoryFactBusyIds] = useState<number[]>([])
  const [skills, setSkills] = useState<AiSkillTemplate[]>([])
  const [overrides, setOverrides] = useState<AiSkillOverride[]>([])
  const [profile, setProfile] = useState<AiWorkProfile | null>(null)
  const [input, setInput] = useState('')
  const [seededSkillKey, setSeededSkillKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationListOpen, setConversationListOpen] = useState(false)
  const [enabledContextChipIds, setEnabledContextChipIds] = useState<string[]>([])
  const [providerLabel, setProviderLabel] = useState('未配置')
  const [assistantMode, setAssistantMode] = useState<AssistantInteractionMode>(readStoredAssistantMode)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRequestAbortRef = useRef<AbortController | null>(null)
  const sendCommandRef = useRef<(text: string) => void>(() => {})

  const refreshStoryFacts = useCallback(async () => {
    if (!bookId) {
      setStoryFacts([])
      return
    }
    const proposals = (await window.api.aiListStoryFactProposals(bookId, 'pending')) as StoryFactProposal[]
    setStoryFacts(proposals)
  }, [bookId])

  const {
    assistantIntent,
    baseContext,
    contextDefaultsKey,
    context,
    resolvedPanelContext,
    conversationItems,
    hasCurrentSelection,
    currentChapterIsBlank
  } = useAiAssistantContext({
    bookId,
    currentChapter,
    characters,
    foreshadowings,
    plotNodes,
    conversations,
    conversationId,
    skills,
    overrides,
    profile,
    input,
    enabledContextChipIds,
    aiAssistantSelectionChapterId,
    aiAssistantSelectionText,
    volumes,
    activeModal
  })

  const { refreshConversation } = useAiAssistantData({
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
    void refreshStoryFacts().catch(() => null)
  }, [refreshStoryFacts, messages.length, loading])

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
      // We intentionally abort the latest in-flight request on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      activeRequestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(ASSISTANT_MODE_STORAGE_KEY, assistantMode)
  }, [assistantMode])

  useEffect(() => {
    if (!bookId || !aiAssistantCommand || !conversationId || loading || skills.length === 0) return
    const { id, input: commandInput, autoSend } = aiAssistantCommand
    setSeededSkillKey(null)
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
    assistantMode,
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
      setSeededSkillKey(null)
      void send(undefined, text)
    }
  })

  if (!bookId) return <BookshelfCreationAssistantPanel />

  const updateComposerInput = (value: string) => {
    setSeededSkillKey(null)
    setInput(value)
  }

  const submitComposer = () => {
    const seededSkill = resolveSeededAssistantSkill(skills, seededSkillKey)
    setSeededSkillKey(null)
    void send(seededSkill)
  }

  const seedQuickAction = (skill: AiSkillTemplate, actionInput?: string) => {
    setSeededSkillKey(skill.key)
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

  const decideStoryFact = async (id: number, action: 'accept' | 'reject') => {
    if (!bookId) return
    setStoryFactBusyIds((ids) => [...ids, id])
    try {
      if (action === 'accept') {
        await window.api.aiAcceptStoryFactProposals([id])
        await loadCharacters(bookId).catch(() => undefined)
      } else {
        await window.api.aiRejectStoryFactProposals([id])
      }
      await refreshStoryFacts()
    } finally {
      setStoryFactBusyIds((ids) => ids.filter((item) => item !== id))
    }
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
            onOpenDirectorPanel={() => openModal('directorPanel')}
            onOpenVisualStudio={() => openModal('visualStudio')}
            onOpenMcpSettings={() => openModal('mcpSettings')}
            onOpenMarketScanDeconstruct={() => openModal('marketScanDeconstruct')}
            onOpenAiSettings={() => openModal('aiSettings')}
            onOpenCanonPack={() => openModal('canonPack')}
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
            onPrefillInput={(input) => {
              setSeededSkillKey(null)
              setInput(input)
            }}
            onRunQuickAction={(action) => {
              if (!action.input) return
              setSeededSkillKey(null)
              void send(undefined, action.input)
            }}
          >
            <StoryFactProposalPanel
              proposals={storyFacts}
              busyIds={storyFactBusyIds}
              onAccept={(id) => void decideStoryFact(id, 'accept')}
              onReject={(id) => void decideStoryFact(id, 'reject')}
            />

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
            onChange={updateComposerInput}
            onSubmit={submitComposer}
            loading={loading}
            assistantMode={assistantMode}
            onAssistantModeChange={setAssistantMode}
            quickActions={quickActions.map((action) => ({
              key: action.key,
              label: action.label,
              description: action.description,
              disabled: Boolean(action.disabled),
              input: (action as { input?: string }).input
            }))}
            skills={skills}
            onSeedSkill={(skill, input) => seedQuickAction(skill, input)}
            onPrefillInput={(input) => {
              setSeededSkillKey(null)
              setInput(input)
            }}
          />

        </div>
  )
}

// SPLIT-006 phase 6 — AiAssistantDock launcher lives in its own file
// so this entry stays focused on AiAssistantPanel + the export contract.
export { default } from './AiAssistantDockLauncher'

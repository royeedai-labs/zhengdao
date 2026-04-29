import { useMemo } from 'react'
import {
  applyAssistantContextSelection,
  buildAssistantContext,
  resolveAssistantContextPolicy,
  type AiAssistantContext,
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { stripHtmlToText } from '@/utils/html-to-text'
import {
  resolveAssistantIntent,
  resolveAssistantSkillSelection,
  type AssistantIntent
} from './conversation-mode'
import { buildConversationListItems, type ConversationListItem } from './conversation-list'
import { resolveAssistantContext } from '@/utils/ai/assistant-context'
import { isBlankChapterContent } from './chapter-quick-actions'
import type { ModalType } from '@/types'

/**
 * SPLIT-006 phase 6 — derived-state hook for AiAssistantPanel.
 *
 * Bundles the 8 useMemo derivations the panel needs:
 *   assistantIntent       — chat / skill picker decision
 *   selectedSkill         — the skill resolved from the current intent
 *   contextPolicy         — how aggressively to expand context
 *   baseContext           — derived AiAssistantContext (no chip toggle)
 *   contextDefaultsKey    — primitive key for the chip-defaults effect
 *   context               — base + chip-toggle applied
 *   resolvedPanelContext  — surface-aware presentation (title, quickActions)
 *   conversationItems     — display rows for the history dropdown
 * plus two booleans (hasCurrentSelection, currentChapterIsBlank) so the
 * render layer can avoid recomputing them inline.
 *
 * No setState, no stores; the hook is purely declarative — every output
 * is `useMemo`'d so React only recomputes when the matching deps shift.
 */

interface CharacterInput {
  id: number
  name: string
  description?: string
}

interface ForeshadowInput {
  id: number
  text: string
  status: string
}

interface PlotNodeInput {
  id: number
  title: string
  description?: string
  chapter_number?: number
}

export interface UseAiAssistantContextDeps {
  bookId: number | null
  currentChapter:
    | {
        id: number
        title: string
        content?: string | null
        summary?: string | null
      }
    | null
  characters: CharacterInput[]
  foreshadowings: ForeshadowInput[]
  plotNodes: PlotNodeInput[]
  conversations: Array<{
    id: number
    title: string
    updated_at: string
    message_count?: number
  }>
  conversationId: number | null
  skills: AiSkillTemplate[]
  overrides: AiSkillOverride[]
  profile: AiWorkProfile | null
  input: string
  enabledContextChipIds: string[]
  aiAssistantSelectionChapterId: number | null
  aiAssistantSelectionText: string
  volumes: { length: number }
  activeModal: ModalType
}

export interface UseAiAssistantContextReturn {
  assistantIntent: AssistantIntent
  selectedSkill: AiSkillTemplate | null
  contextPolicy: string
  baseContext: AiAssistantContext
  contextDefaultsKey: string
  context: AiAssistantContext
  resolvedPanelContext: ReturnType<typeof resolveAssistantContext>
  conversationItems: ConversationListItem[]
  hasCurrentSelection: boolean
  currentChapterIsBlank: boolean
}

export function useAiAssistantContext(
  deps: UseAiAssistantContextDeps
): UseAiAssistantContextReturn {
  const {
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
  } = deps

  const assistantIntent = useMemo(
    () =>
      resolveAssistantIntent({
        skills,
        userInput: input,
        selectedText:
          aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
        hasCurrentChapter: Boolean(currentChapter),
        hasVolumes: volumes.length > 0
      }),
    [
      aiAssistantSelectionChapterId,
      aiAssistantSelectionText,
      currentChapter,
      input,
      skills,
      volumes.length
    ]
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
        ? {
            id: currentChapter.id,
            title: currentChapter.title,
            plainText: chapterPlain,
            summary: currentChapter.summary ?? undefined
          }
        : null,
      selectedText:
        aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
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
        hasSelection:
          aiAssistantSelectionChapterId === currentChapter?.id &&
          Boolean(aiAssistantSelectionText.trim()),
        activeModal
      }),
    [
      activeModal,
      aiAssistantSelectionChapterId,
      aiAssistantSelectionText,
      bookId,
      currentChapter?.id,
      currentChapter?.title
    ]
  )

  const hasCurrentSelection =
    aiAssistantSelectionChapterId === currentChapter?.id &&
    Boolean(aiAssistantSelectionText.trim())
  const currentChapterIsBlank = Boolean(
    currentChapter && isBlankChapterContent(currentChapter.content ?? null)
  )

  return {
    assistantIntent,
    selectedSkill,
    contextPolicy,
    baseContext,
    contextDefaultsKey,
    context,
    resolvedPanelContext,
    conversationItems,
    hasCurrentSelection,
    currentChapterIsBlank
  }
}

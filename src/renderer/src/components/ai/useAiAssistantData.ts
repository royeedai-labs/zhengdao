import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { useUIStore, type AiChapterDraft, type InlineAiDraft } from '@/stores/ui-store'
import { toAiChapterDraft, toInlineAiDraft } from './inline-draft'

/**
 * SPLIT-006 phase 5 — AI assistant data fetching hook.
 *
 * Owns three async paths that all hit window.api.ai* endpoints:
 *   - refreshConfig()         skills + overrides + workProfile
 *   - refreshConversation()   conversations + messages + drafts
 *                             (pulls inline + chapter drafts out of the
 *                              draft basket and into the editor surface)
 *   - bookId-change effect    fires both on first mount + whenever
 *                             the user opens a different book; cancels
 *                             via local flag if the book switches mid-
 *                             flight to avoid stale-state writes.
 *
 * Pulled out of AiAssistantPanel so the hook owns the cancellation
 * + duplicated load-all sequence; the panel keeps only the conversationId
 * trigger effect for its own state.
 */

interface ConversationRow {
  id: number
  title: string
  updated_at: string
  message_count?: number
}

interface MessageRow {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

interface DraftRow {
  id: number
  conversation_id?: number | null
  kind: string
  title: string
  payload: Record<string, unknown>
  status: 'pending' | 'applied' | 'dismissed'
  target_ref?: string
}

export interface UseAiAssistantDataDeps {
  bookId: number | null
  currentChapterId: number | undefined
  setSkills: Dispatch<SetStateAction<AiSkillTemplate[]>>
  setOverrides: Dispatch<SetStateAction<AiSkillOverride[]>>
  setProfile: Dispatch<SetStateAction<AiWorkProfile | null>>
  setConversations: Dispatch<SetStateAction<ConversationRow[]>>
  setMessages: Dispatch<SetStateAction<MessageRow[]>>
  setDrafts: Dispatch<SetStateAction<DraftRow[]>>
  setConversationId: Dispatch<SetStateAction<number | null>>
  setInlineAiDraft: (draft: InlineAiDraft) => void
  clearInlineAiDraft: () => void
  setAiChapterDraft: (draft: AiChapterDraft) => void
  clearAiChapterDraft: () => void
}

export interface UseAiAssistantDataReturn {
  refreshConversation: (targetConversationId?: number | null) => Promise<void>
  refreshConfig: () => Promise<void>
}

export function useAiAssistantData(deps: UseAiAssistantDataDeps): UseAiAssistantDataReturn {
  const {
    bookId,
    currentChapterId,
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
  } = deps

  const applyConversationLoad = useCallback(
    (
      conversationRows: ConversationRow[],
      messageRows: MessageRow[],
      allDrafts: DraftRow[],
      conversationId: number
    ) => {
      const inlineDraft = allDrafts.reduce<InlineAiDraft | null>(
        (found, draft) => found ?? toInlineAiDraft(draft, currentChapterId),
        null
      )
      const chapterDraft = allDrafts.reduce<AiChapterDraft | null>(
        (found, draft) => found ?? toAiChapterDraft(draft),
        null
      )
      const hiddenDraftIds = new Set(
        [inlineDraft?.id, chapterDraft?.id].filter(
          (id): id is number => typeof id === 'number'
        )
      )
      setMessages(messageRows)
      setConversations(conversationRows)
      setDrafts(allDrafts.filter((draft) => !hiddenDraftIds.has(draft.id)))
      if (inlineDraft) {
        setInlineAiDraft(inlineDraft)
      } else {
        clearInlineAiDraft()
      }
      if (chapterDraft) {
        const currentDraft = useUIStore.getState().aiChapterDraft
        if (currentDraft?.id !== chapterDraft.id) setAiChapterDraft(chapterDraft)
      } else {
        clearAiChapterDraft()
      }
      setConversationId(conversationId)
    },
    [
      currentChapterId,
      setMessages,
      setConversations,
      setDrafts,
      setInlineAiDraft,
      clearInlineAiDraft,
      setAiChapterDraft,
      clearAiChapterDraft,
      setConversationId
    ]
  )

  const refreshConversation = useCallback(
    async (targetConversationId?: number | null) => {
      if (!bookId) return
      const conversation = targetConversationId
        ? ({ id: targetConversationId } as { id: number })
        : ((await window.api.aiGetOrCreateConversation(bookId)) as { id: number })
      const [conversationRows, messageRows, draftRows] = await Promise.all([
        window.api.aiGetConversations(bookId),
        window.api.aiGetMessages(conversation.id),
        window.api.aiGetDrafts(bookId, 'pending', conversation.id)
      ])
      applyConversationLoad(
        conversationRows as ConversationRow[],
        messageRows as MessageRow[],
        draftRows as DraftRow[],
        conversation.id
      )
    },
    [bookId, applyConversationLoad]
  )

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
  }, [bookId, setSkills, setOverrides, setProfile])

  // First-mount + bookId-change parallel load. We do not await
  // refreshConfig + refreshConversation in a `useEffect` because the
  // `cancelled` flag must guard against a book switch mid-flight: the
  // raw inlined sequence was the same shape pre-split.
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
      applyConversationLoad(
        conversationRows as ConversationRow[],
        messageRows as MessageRow[],
        draftRows as DraftRow[],
        conversation.id
      )
    }

    void loadAssistantState()
    return () => {
      cancelled = true
    }
  }, [bookId, applyConversationLoad, setSkills, setOverrides, setProfile])

  return { refreshConversation, refreshConfig }
}

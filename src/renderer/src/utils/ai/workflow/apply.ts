import { nonEmpty } from './helpers'
import type { AiDraftPayload, AiTextDraftApplicationPlan } from './types'

/**
 * SPLIT-008 — text-draft application planning.
 *
 * Pure function that decides — given a parsed AiDraftPayload + the
 * editor's current chapter id — whether to insert at a position, replace
 * a selection range, or report an invalid plan. The renderer-side
 * editor reaches for the result and applies it via a single API call.
 */

export function planTextDraftApplication(
  draft: AiDraftPayload,
  currentChapterId: number | null
): AiTextDraftApplicationPlan | null {
  if (draft.kind !== 'insert_text' && draft.kind !== 'replace_text') return null

  const content = String(draft.content || '')
  if (!nonEmpty(content)) {
    return {
      kind: 'invalid',
      error: draft.kind === 'insert_text' ? '草稿正文为空' : '替换正文为空'
    }
  }

  if (draft.kind === 'insert_text') {
    const selectionChapterId = Number(draft.selection_chapter_id)
    const selectionTo = Number(draft.selection_to)
    const insertAt =
      Number.isFinite(selectionChapterId) &&
      Number.isFinite(selectionTo) &&
      currentChapterId != null &&
      selectionChapterId === currentChapterId
        ? selectionTo
        : null
    return { kind: 'insert_text', content, insertAt }
  }

  const selectionChapterId = Number(draft.selection_chapter_id)
  const selectionFrom = Number(draft.selection_from)
  const selectionTo = Number(draft.selection_to)
  const originalText = String(draft.original_text || '')

  if (
    !Number.isFinite(selectionChapterId) ||
    !Number.isFinite(selectionFrom) ||
    !Number.isFinite(selectionTo) ||
    selectionFrom < 0 ||
    selectionTo < selectionFrom ||
    !nonEmpty(originalText)
  ) {
    return {
      kind: 'invalid',
      error: 'AI 草稿缺少原始选区，不能直接替换正文，请重新生成。'
    }
  }

  if (currentChapterId == null || selectionChapterId !== currentChapterId) {
    return {
      kind: 'invalid',
      error: '当前章节与草稿目标不一致，请回到原章节后重新应用。'
    }
  }

  return {
    kind: 'replace_text',
    content,
    chapterId: selectionChapterId,
    from: selectionFrom,
    to: selectionTo,
    expectedText: originalText
  }
}

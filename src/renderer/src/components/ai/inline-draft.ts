import type { AiChapterDraft, InlineAiDraft } from '@/stores/ui-store'
import { planTextDraftApplication, type AiDraftPayload } from '@/utils/ai/assistant-workflow'

export const DEFAULT_CONTINUE_INPUT = '从当前光标或章节末尾自然续写，保持当前节奏。'
export const DEFAULT_CREATE_CHAPTER_INPUT = '继续按当前作品设定创建下一章，给出章节标题和正文。'

export type InlineDraftRow = {
  id: number
  conversation_id?: number | null
  kind: string
  title: string
  payload: Record<string, unknown>
  target_ref?: string
}

export function getTargetChapterId(draft: InlineDraftRow): number | null {
  if (typeof draft.target_ref === 'string') {
    const match = /^chapter:(\d+)$/.exec(draft.target_ref)
    if (match) return Number(match[1])
  }
  const selectionChapterId = Number(draft.payload.selection_chapter_id)
  return Number.isFinite(selectionChapterId) ? selectionChapterId : null
}

export function toInlineAiDraft(
  draft: InlineDraftRow,
  currentChapterId: number | null | undefined,
  fallbackRetryInput = DEFAULT_CONTINUE_INPUT
): InlineAiDraft | null {
  if (draft.kind !== 'insert_text' || currentChapterId == null) return null
  const targetChapterId = getTargetChapterId(draft)
  if (targetChapterId != null && targetChapterId !== currentChapterId) return null
  const plan = planTextDraftApplication(draft.payload as AiDraftPayload, currentChapterId)
  if (!plan || plan.kind !== 'insert_text') return null
  return {
    id: draft.id,
    title: draft.title || 'AI 续写草稿',
    payload: draft.payload,
    chapterId: currentChapterId,
    conversationId: draft.conversation_id ?? null,
    retryInput: String(draft.payload.retry_input || fallbackRetryInput)
  }
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function toAiChapterDraft(
  draft: InlineDraftRow,
  fallbackRetryInput = DEFAULT_CREATE_CHAPTER_INPUT
): AiChapterDraft | null {
  if (draft.kind !== 'create_chapter') return null
  const title = textValue(draft.payload.title) || draft.title || 'AI 新章节'
  const rawContent = textValue(draft.payload.content || draft.payload.body)
  const content = /<\/?[a-z][^>]*>/i.test(rawContent) ? htmlToPlainText(rawContent) : rawContent
  if (!content) return null
  const volumeId = Number(draft.payload.volume_id || draft.payload.volumeId)
  return {
    id: draft.id,
    title,
    content,
    summary: textValue(draft.payload.summary),
    volumeId: Number.isFinite(volumeId) ? volumeId : null,
    volumeTitle: textValue(draft.payload.volume_title || draft.payload.volumeTitle || draft.payload.volume),
    conversationId: draft.conversation_id ?? null,
    retryInput: textValue(draft.payload.retry_input) || fallbackRetryInput
  }
}

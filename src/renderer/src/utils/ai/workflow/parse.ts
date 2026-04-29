import { nonEmpty } from './helpers'
import {
  ALLOWED_DRAFT_KINDS,
  type AiDraftKind,
  type AiDraftPayload,
  type AiSelectionSnapshot
} from './types'

/**
 * SPLIT-008 — parse + draft creation.
 *
 * LLM responses come back in three increasingly noisy shapes:
 *   1. clean JSON (or JSON5) — handled by `tryParseJson`
 *   2. JSON wrapped in ```json fences — handled by `parseStructuredDraftPayload`
 *   3. plain text with a chapter title — handled by
 *      `createChapterDraftFromPlainText`
 *
 * `parseAssistantDrafts` is the strict entrypoint (rejects anything that
 * doesn't carry an `ALLOWED_DRAFT_KINDS` literal); `createChapterDraftFromAssistantResponse`
 * is the lenient one (accepts a chapter from any of the three shapes).
 *
 * `attachSelectionMetaToDrafts` is the post-process step that pins
 * insert/replace drafts to the current selection range.
 */

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match ? match[1].trim() : trimmed
}

// LB-07: 严格 JSON.parse 优先；失败后用 JSON5 兜底解析（支持 trailing comma /
// 未加引号 key / 嵌入注释等 LLM 常见非严格输出）。
function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text)
  } catch {
    /* fall through to json5 lenient parse */
  }
  try {
    // Lazy import 避免顶部 import 循环和体积负担。
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSON5 = require('json5') as { parse: (input: string) => unknown }
    return JSON5.parse(text)
  } catch {
    return undefined
  }
}

function findEmbeddedJsonCandidate(text: string): string | null {
  for (let start = 0; start < text.length; start += 1) {
    const first = text[start]
    if (first !== '{' && first !== '[') continue

    const stack: string[] = [first]
    let inString = false
    let escaped = false

    for (let cursor = start + 1; cursor < text.length; cursor += 1) {
      const char = text[cursor]

      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (inString) continue

      if (char === '{' || char === '[') {
        stack.push(char)
        continue
      }

      if (char === '}' || char === ']') {
        const last = stack[stack.length - 1]
        if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
          stack.pop()
          if (stack.length === 0) {
            return text.slice(start, cursor + 1)
          }
        } else {
          break
        }
      }
    }
  }

  return null
}

function parseStructuredDraftPayload(text: string): unknown | undefined {
  const direct = tryParseJson(stripCodeFence(text))
  if (direct !== undefined) return direct

  for (const block of text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) {
    const parsed = tryParseJson(block[1].trim())
    if (parsed !== undefined) return parsed
  }

  const embedded = findEmbeddedJsonCandidate(text)
  return embedded ? tryParseJson(embedded) : undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function firstTextField(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

export function parseAssistantDrafts(text: string): {
  drafts: AiDraftPayload[]
  errors: string[]
} {
  const errors: string[] = []
  const data = parseStructuredDraftPayload(text)
  if (data === undefined) {
    return { drafts: [], errors: ['AI 返回内容不是可解析的 JSON 草稿'] }
  }

  const rawDrafts = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { drafts?: unknown[] }).drafts)
      ? (data as { drafts: unknown[] }).drafts
      : data && typeof data === 'object' && typeof (data as { kind?: unknown }).kind === 'string'
        ? [data]
        : data && typeof data === 'object' && (data as { draft?: unknown }).draft
          ? [(data as { draft: unknown }).draft]
          : []

  const drafts: AiDraftPayload[] = []
  for (const raw of rawDrafts) {
    if (!raw || typeof raw !== 'object') {
      errors.push('AI 草稿格式无效')
      continue
    }
    const draft = raw as Record<string, unknown>
    const kind = draft.kind
    if (typeof kind !== 'string' || !ALLOWED_DRAFT_KINDS.has(kind as AiDraftKind)) {
      errors.push(`不支持的 AI 草稿类型：${String(kind)}`)
      continue
    }
    drafts.push(draft as AiDraftPayload)
  }

  return { drafts, errors }
}

function coerceChapterDraftFromStructuredPayload(
  data: unknown,
  fallbackTitle: string
): AiDraftPayload | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const draft = coerceChapterDraftFromStructuredPayload(item, fallbackTitle)
      if (draft) return draft
    }
    return null
  }

  const record = asRecord(data)
  if (!record) return null

  const nestedCandidates = [record.draft, record.chapter]
  for (const candidate of nestedCandidates) {
    const draft = coerceChapterDraftFromStructuredPayload(candidate, fallbackTitle)
    if (draft) return draft
  }
  for (const key of ['drafts', 'chapters']) {
    const draft = coerceChapterDraftFromStructuredPayload(record[key], fallbackTitle)
    if (draft) return draft
  }

  const kind = typeof record.kind === 'string' ? record.kind : ''
  const content = firstTextField(record, [
    'content',
    'body',
    'text',
    'chapter_content',
    'chapterContent',
    '正文'
  ])
  if (!content) return null

  const hasChapterShape =
    kind === 'create_chapter' ||
    Boolean(
      firstTextField(record, [
        'title',
        'chapter_title',
        'chapterTitle',
        'chapterName',
        '章节标题',
        '章节名'
      ])
    )
  if (!hasChapterShape) return null

  const title =
    firstTextField(record, [
      'title',
      'chapter_title',
      'chapterTitle',
      'chapterName',
      '章节标题',
      '章节名'
    ]) || fallbackTitle
  const summary = firstTextField(record, ['summary', 'synopsis', '摘要'])
  const volumeTitle = firstTextField(record, ['volume_title', 'volumeTitle', 'volume', '卷名'])

  return {
    kind: 'create_chapter',
    title,
    content,
    ...(summary ? { summary } : {}),
    ...(volumeTitle ? { volume_title: volumeTitle } : {})
  }
}

function normalizePlainDraftLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function cleanPlainTitle(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^标题\s*[:：]\s*/, '')
    .replace(/^卷名\s*[:：]\s*/, '')
    .replace(/^章节名\s*[:：]\s*/, '')
    .trim()
}

function isLikelyChapterTitle(line: string): boolean {
  const cleaned = cleanPlainTitle(line)
  if (!cleaned) return false
  if (/^标题\s*[:：]/.test(line)) return true
  if (/^章节名\s*[:：]/.test(line)) return true
  if (/^第.{1,12}[章节]/.test(cleaned)) return true
  if (/^chapter\s+\d+/i.test(cleaned)) return true
  return false
}

function isLikelyVolumeTitle(line: string): boolean {
  const cleaned = cleanPlainTitle(line)
  if (!cleaned) return false
  if (/^卷名\s*[:：]/.test(line)) return true
  if (/^第.{1,12}[卷部]/.test(cleaned)) return true
  if (/^volume\s+\d+/i.test(cleaned)) return true
  return false
}

export function createChapterDraftFromPlainText(
  text: string,
  fallbackTitle = 'AI 新章节'
): AiDraftPayload | null {
  const lines = normalizePlainDraftLines(text)
  if (lines.length === 0) return null

  const first = lines[0]
  const second = lines[1] || ''
  const hasVolumeTitle = isLikelyVolumeTitle(first)
  const chapterTitleLine = hasVolumeTitle && isLikelyChapterTitle(second) ? second : first
  const hasTitle = isLikelyChapterTitle(chapterTitleLine)
  const title = hasTitle ? cleanPlainTitle(chapterTitleLine) : fallbackTitle
  const bodyStartIndex = hasVolumeTitle && hasTitle ? 2 : hasTitle ? 1 : hasVolumeTitle ? 1 : 0
  const bodyLines = lines.slice(bodyStartIndex)
  const body = bodyLines
    .map((line, index) => (index === 0 ? line.replace(/^正文\s*[:：]\s*/, '').trim() : line))
    .filter(Boolean)
    .join('\n\n')
    .trim()

  return {
    kind: 'create_chapter',
    title,
    content: body || lines.slice(hasVolumeTitle ? 1 : 0).join('\n\n'),
    ...(hasVolumeTitle ? { volume_title: cleanPlainTitle(first) } : {})
  }
}

export function createChapterDraftFromAssistantResponse(
  text: string,
  fallbackTitle = 'AI 新章节',
  options: { allowPlainTextFallback?: boolean } = {}
): AiDraftPayload | null {
  const structured = parseStructuredDraftPayload(text)
  if (structured !== undefined) {
    const draft = coerceChapterDraftFromStructuredPayload(structured, fallbackTitle)
    if (draft) return draft
  }
  return options.allowPlainTextFallback
    ? createChapterDraftFromPlainText(text, fallbackTitle)
    : null
}

export function attachSelectionMetaToDrafts(
  drafts: AiDraftPayload[],
  selection: AiSelectionSnapshot
): AiDraftPayload[] {
  return drafts.map((draft) => {
    if (draft.kind === 'replace_text') {
      if (
        selection.chapterId == null ||
        selection.from == null ||
        selection.to == null ||
        !nonEmpty(selection.text)
      ) {
        return draft
      }
      return {
        ...draft,
        original_text: selection.text,
        selection_chapter_id: selection.chapterId,
        selection_from: selection.from,
        selection_to: selection.to
      }
    }

    if (draft.kind === 'insert_text') {
      if (selection.chapterId == null || selection.to == null) return draft
      return {
        ...draft,
        selection_chapter_id: selection.chapterId,
        selection_to: selection.to
      }
    }

    return draft
  })
}

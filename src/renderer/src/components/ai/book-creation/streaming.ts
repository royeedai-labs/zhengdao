import {
  hasCreationBriefInput,
  type AiBookCreationPackage,
  type AssistantCreationBrief
} from '../../../../../shared/ai-book-creation'
import { coerceBookCreationPackage } from './package'

/**
 * SPLIT-006 — JSON-stream parsers for the BookshelfCreationAssistantPanel.
 *
 * The AI returns a structured JSON envelope (`{assistant_message, brief,
 * suggestions, ...}`) but the renderer needs to feed the user partial
 * tokens as they stream. These helpers extract the assistant_message
 * substring even when the JSON is incomplete, recover from malformed
 * brackets, and fall back to a deterministic message when the model
 * forgets to populate `assistant_message`.
 */

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const candidate = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeJsonStringFragment(fragment: string): string {
  const safeFragment = fragment.replace(/\\u[0-9a-fA-F]{0,3}$/, '').replace(/\\$/, '')

  try {
    return JSON.parse(`"${safeFragment}"`) as string
  } catch {
    return safeFragment
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

export function extractStreamingJsonStringProperty(text: string, key: string): string | null {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`).exec(text)
  const value = match ? decodeJsonStringFragment(match[1]).trim() : ''
  return value || null
}

export function extractAssistantMessageFromStructuredStream(text: string): string | null {
  const parsed = extractJsonObject(text) as { assistant_message?: unknown } | null
  if (typeof parsed?.assistant_message === 'string' && parsed.assistant_message.trim()) {
    return parsed.assistant_message.trim()
  }
  return extractStreamingJsonStringProperty(text, 'assistant_message')
}

export function looksLikeJsonResponse(text: string): boolean {
  const trimmed = text.trim()
  return (
    /^(?:```json\s*)?\{/.test(trimmed) ||
    trimmed.includes('"assistant_message"') ||
    trimmed.includes('"brief"')
  )
}

export function buildBookshelfBriefFallbackContent(brief: AssistantCreationBrief): string {
  if (hasCreationBriefInput(brief)) {
    return '已记录起书方向，可以生成起书方案；也可以继续补充创作方向。'
  }
  return '先写一句故事灵感，就可以生成起书方案。'
}

export function buildBookshelfBriefFinalContent(
  rawStream: string,
  brief: AssistantCreationBrief
): string {
  const assistantMessage = extractAssistantMessageFromStructuredStream(rawStream)
  if (assistantMessage) return assistantMessage

  if (looksLikeJsonResponse(rawStream)) {
    return buildBookshelfBriefFallbackContent(brief)
  }

  return rawStream.trim() || buildBookshelfBriefFallbackContent(brief)
}

function countStreamingMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length || 0
}

function formatBookPackageSummary(pkg: AiBookCreationPackage, title = '起书方案结构已解析'): string {
  const chapterCount = pkg.volumes.reduce(
    (total, volume) => total + (Array.isArray(volume.chapters) ? volume.chapters.length : 0),
    0
  )
  return [
    title,
    `作品：《${pkg.book.title || '未命名'}》`,
    `分卷 ${pkg.volumes.length} · 章节 ${chapterCount}`,
    `人物 ${pkg.characters.length} · 关系 ${pkg.relations?.length || 0} · 设定 ${pkg.wikiEntries.length}`,
    `剧情 ${pkg.plotNodes.length} · 伏笔 ${pkg.foreshadowings.length}`
  ].join('\n')
}

export function buildBookshelfBriefStreamContent(rawStream: string): string {
  const assistantMessage = extractAssistantMessageFromStructuredStream(rawStream)
  if (assistantMessage) return assistantMessage

  const trimmed = rawStream.trim()
  if (!trimmed || looksLikeJsonResponse(trimmed)) return ''
  return trimmed
}

export function buildBookPackageStreamContent(rawStream: string): string {
  const pkg = coerceBookCreationPackage(extractJsonObject(rawStream))
  if (pkg) return formatBookPackageSummary(pkg)

  const bookTitle = extractStreamingJsonStringProperty(rawStream, 'title')
  const volumeCount = countStreamingMatches(rawStream, /"chapters"\s*:/g)
  const chapterCount = countStreamingMatches(rawStream, /"summary"\s*:/g)
  const characterCount = countStreamingMatches(rawStream, /"name"\s*:/g)
  const wikiCount = countStreamingMatches(rawStream, /"category"\s*:/g)
  const plotCount = countStreamingMatches(rawStream, /"nodeType"\s*:/g)
  const foreshadowCount = countStreamingMatches(rawStream, /"expectedChapter"\s*:/g)
  const counts = [
    volumeCount ? `分卷 ${volumeCount}` : '',
    chapterCount ? `章节 ${chapterCount}` : '',
    characterCount ? `人物 ${characterCount}` : '',
    wikiCount ? `设定 ${wikiCount}` : '',
    plotCount ? `剧情 ${plotCount}` : '',
    foreshadowCount ? `伏笔 ${foreshadowCount}` : ''
  ].filter(Boolean)

  return [
    '正在解析起书方案结构...',
    bookTitle ? `作品：《${bookTitle}》` : '',
    counts.length > 0 ? `已识别：${counts.join(' · ')}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

import { getDb } from '../database/connection'

export interface LocalRagChapter {
  id: number
  title: string
  content: string
}

export interface LocalRagSnippet {
  id: string
  chapterId: number
  title: string
  text: string
  score: number
}

export function retrieveLocalBookSnippets(bookId: number, query: string, limit = 4): LocalRagSnippet[] {
  const rows = getDb()
    .prepare(
      `
      SELECT c.id, c.title, c.content
      FROM chapters c
      JOIN volumes v ON v.id = c.volume_id
      WHERE v.book_id = ? AND c.deleted_at IS NULL AND v.deleted_at IS NULL
      ORDER BY v.sort_order, c.sort_order
    `
    )
    .all(bookId) as LocalRagChapter[]
  return rankLocalRagSnippets(rows, query, limit)
}

export function rankLocalRagSnippets(
  chapters: LocalRagChapter[],
  query: string,
  limit = 4
): LocalRagSnippet[] {
  const terms = extractSearchTerms(query)
  if (terms.length === 0) return []

  return chapters
    .map((chapter) => {
      const plain = stripHtml(chapter.content)
      const normalized = normalizeText(`${chapter.title}\n${plain}`)
      const matched = terms.filter((term) => normalized.includes(term))
      const phraseBoost = normalized.includes(normalizeText(query).slice(0, 32)) ? 2 : 0
      const score = matched.length + phraseBoost
      return {
        id: `local:${chapter.id}`,
        chapterId: chapter.id,
        title: chapter.title,
        text: buildExcerpt(plain, matched[0] || terms[0], 760),
        score
      }
    })
    .filter((snippet) => snippet.score > 0 && snippet.text.trim())
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 8)))
}

export function formatLocalRagPrompt(snippets: LocalRagSnippet[]): string {
  return snippets
    .map((snippet, index) => `[L${index + 1}] ${snippet.title}（本地章节 ${snippet.chapterId}）\n${snippet.text}`)
    .join('\n\n')
}

function extractSearchTerms(query: string): string[] {
  const normalized = normalizeText(query)
  const terms = new Set<string>()
  for (const token of normalized.split(/[^A-Za-z0-9\u4e00-\u9fff]+/)) {
    if (token.length >= 2) terms.add(token.slice(0, 24))
  }
  const compact = normalized.replace(/[^\u4e00-\u9fff]/g, '')
  for (let i = 0; i < compact.length - 1 && terms.size < 32; i += 1) {
    terms.add(compact.slice(i, i + 2))
  }
  return Array.from(terms).slice(0, 32)
}

function buildExcerpt(text: string, term: string, maxChars: number): string {
  const normalized = normalizeText(text)
  const index = term ? normalized.indexOf(term) : -1
  if (index < 0 || text.length <= maxChars) return text.slice(0, maxChars)
  const start = Math.max(0, index - Math.floor(maxChars * 0.35))
  const end = Math.min(text.length, start + maxChars)
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`
}

function normalizeText(text: string): string {
  return stripHtml(text).replace(/\s+/g, ' ').trim().toLowerCase()
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

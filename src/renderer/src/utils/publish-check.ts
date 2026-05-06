import { checkSensitive } from './sensitive-words'

export type PublishCheckScope = 'chapter' | 'book'
export type PublishIssueKind =
  | 'empty_title'
  | 'empty_body'
  | 'sensitive_word'
  | 'word_count_low'
  | 'word_count_high'
  | 'ai_tone_risk'

export interface PublishCheckChapter {
  id: number
  title: string
  content: string | null
  word_count?: number
  volume_title?: string
}

export interface PublishIssue {
  kind: PublishIssueKind
  chapterId: number
  chapterTitle: string
  message: string
  severity: 'warning' | 'danger'
  word?: string
  count?: number
}

export interface PublishPackage {
  scope: PublishCheckScope
  chapters: PublishCheckChapter[]
  text: string
  totalWords: number
  issues: PublishIssue[]
}

export interface PublishCheckOptions {
  lowWordThreshold?: number
  highWordThreshold?: number
}

const DEFAULT_LOW_WORD_THRESHOLD = 100
const DEFAULT_HIGH_WORD_THRESHOLD = 12000
const AI_TONE_PATTERNS = [
  '综上所述',
  '值得注意的是',
  '不禁让人',
  '命运的齿轮',
  '仿佛整个世界',
  '一股莫名的',
  '空气中弥漫着',
  '眼神中闪过一丝',
  '某种意义上',
  '毋庸置疑'
] as const

export const PLATFORM_NEUTRAL_RULES = [
  '标题与正文完整',
  '章节字数稳定',
  '敏感词自查',
  '发布格式可复制',
  'AI 味/低质句提示'
] as const

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function htmlToPublishText(html: string | null | undefined): string {
  if (!html) return ''
  return decodeHtmlEntities(
    html
      .replace(/\r/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

export function countCnWords(text: string): number {
  return text.replace(/\s/g, '').length
}

export function detectAiToneRisks(text: string): string[] {
  return AI_TONE_PATTERNS.filter((pattern) => text.includes(pattern))
}

export function formatChapterForPublishing(chapter: PublishCheckChapter): string {
  const title = chapter.title.trim() || '未命名章节'
  const body = htmlToPublishText(chapter.content)
  const paragraphs = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `\u3000\u3000${line}`)
  return [title, '', ...paragraphs].join('\n').trim()
}

export function buildPublishText(chapters: PublishCheckChapter[]): string {
  return chapters.map(formatChapterForPublishing).filter(Boolean).join('\n\n')
}

export function buildPublishPackage(
  scope: PublishCheckScope,
  chapters: PublishCheckChapter[],
  sensitiveWords: string[],
  options: PublishCheckOptions = {}
): PublishPackage {
  const lowWordThreshold = options.lowWordThreshold ?? DEFAULT_LOW_WORD_THRESHOLD
  const highWordThreshold = options.highWordThreshold ?? DEFAULT_HIGH_WORD_THRESHOLD
  const issues: PublishIssue[] = []
  let totalWords = 0

  for (const chapter of chapters) {
    const chapterTitle = chapter.title.trim() || '未命名章节'
    const body = htmlToPublishText(chapter.content)
    const wordCount = chapter.word_count ?? countCnWords(body)
    totalWords += wordCount

    if (!chapter.title.trim()) {
      issues.push({
        kind: 'empty_title',
        chapterId: chapter.id,
        chapterTitle,
        message: '章节标题为空',
        severity: 'danger'
      })
    }

    if (!body.trim()) {
      issues.push({
        kind: 'empty_body',
        chapterId: chapter.id,
        chapterTitle,
        message: '章节正文为空',
        severity: 'danger'
      })
      continue
    }

    if (wordCount > 0 && wordCount < lowWordThreshold) {
      issues.push({
        kind: 'word_count_low',
        chapterId: chapter.id,
        chapterTitle,
        message: `章节字数偏少：${wordCount} 字`,
        severity: 'warning',
        count: wordCount
      })
    }

    if (wordCount > highWordThreshold) {
      issues.push({
        kind: 'word_count_high',
        chapterId: chapter.id,
        chapterTitle,
        message: `章节字数偏高：${wordCount} 字`,
        severity: 'warning',
        count: wordCount
      })
    }

    const sensitiveHits = checkSensitive(body, sensitiveWords)
    const grouped = new Map<string, number>()
    for (const hit of sensitiveHits) grouped.set(hit.word, (grouped.get(hit.word) || 0) + 1)
    for (const [word, count] of grouped) {
      issues.push({
        kind: 'sensitive_word',
        chapterId: chapter.id,
        chapterTitle,
        message: `命中敏感词「${word}」${count} 次`,
        severity: 'danger',
        word,
        count
      })
    }

    const aiToneHits = detectAiToneRisks(body)
    if (aiToneHits.length > 0) {
      issues.push({
        kind: 'ai_tone_risk',
        chapterId: chapter.id,
        chapterTitle,
        message: `AI 味/模板句风险：${aiToneHits.slice(0, 3).map((word) => `「${word}」`).join('、')}`,
        severity: 'warning',
        count: aiToneHits.length
      })
    }
  }

  return {
    scope,
    chapters,
    text: buildPublishText(chapters),
    totalWords,
    issues
  }
}

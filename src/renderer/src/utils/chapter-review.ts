import type { AiDraftPayload } from './ai/assistant-workflow'
import { parseAssistantDrafts } from './ai/assistant-workflow'

export const CHAPTER_REVIEW_SECTIONS = [
  '剧情推进',
  '角色一致性',
  '伏笔回收',
  '毒点风险',
  '节奏问题',
  '可执行修改建议'
] as const

export type ChapterReviewSection = (typeof CHAPTER_REVIEW_SECTIONS)[number]

export interface ChapterReviewAvailabilityInput {
  currentChapter: { content?: string | null } | null
  chapterText?: string | null
}

export interface ChapterReviewPromptInput {
  chapterTitle: string
  chapterText: string
  charactersText: string
  foreshadowingsText: string
  plotNodesText: string
  userFocus?: string
}

function plainTextFromChapterContent(value: string | null | undefined): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
}

export function getChapterReviewUnavailableReason(
  input: ChapterReviewAvailabilityInput
): string | null {
  if (!input.currentChapter) return '请先打开章节'
  const chapterText = (input.chapterText ?? plainTextFromChapterContent(input.currentChapter.content)).trim()
  if (!chapterText) return '当前章节正文为空，无法审稿'
  return null
}

export function buildChapterReviewPrompt(input: ChapterReviewPromptInput): {
  systemPrompt: string
  userPrompt: string
} {
  const systemPrompt = [
    '你是中文长篇网文的审稿编辑。',
    '你的任务是帮助作者发现问题，不要替作者直接改正文。',
    '必须按指定六个标题输出审稿报告；建议要具体、可执行、能回到章节修改。',
    '如果发现值得加入作品资产库的角色、设定、伏笔或剧情节点，可在最后追加一个 JSON 草稿块；没有建议则不要输出 JSON。',
    'JSON 草稿块只允许使用 drafts 数组，kind 只能是 create_character、create_wiki_entry、create_foreshadowing、create_plot_node。'
  ].join('\n')

  const userPrompt = [
    `请审稿当前章节《${input.chapterTitle || '未命名章节'}》。`,
    input.userFocus?.trim() ? `用户额外关注：${input.userFocus.trim()}` : '',
    '请严格使用以下 Markdown 二级标题：',
    ...CHAPTER_REVIEW_SECTIONS.map((section) => `## ${section}`),
    '每段至少给出“结论 + 证据 + 建议”。',
    '',
    '## 当前章节正文',
    input.chapterText || '（空）',
    input.charactersText ? `\n## 已有角色\n${input.charactersText}` : '',
    input.foreshadowingsText ? `\n## 已有伏笔\n${input.foreshadowingsText}` : '',
    input.plotNodesText ? `\n## 已有剧情节点\n${input.plotNodesText}` : '',
    '',
    '如需追加资产建议，请在正文报告后输出如下 JSON 示例之一：',
    '```json',
    '{"drafts":[{"kind":"create_foreshadowing","text":"伏笔描述","expected_chapter":null,"expected_word_count":null}]}',
    '```'
  ]
    .filter(Boolean)
    .join('\n')

  return { systemPrompt, userPrompt }
}

export function hasAllReviewSections(content: string): boolean {
  return CHAPTER_REVIEW_SECTIONS.every((section) =>
    new RegExp(`(^|\\n)##\\s+${section}(\\s|\\n|$)`).test(content)
  )
}

export function normalizeReviewReport(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (hasAllReviewSections(trimmed)) return trimmed

  return [
    ...CHAPTER_REVIEW_SECTIONS.map((section) => `## ${section}\n（AI 未按该段落单独输出，请参考下方原始报告。）`),
    '## 原始报告',
    trimmed
  ].join('\n\n')
}

export function extractReviewAssetDrafts(content: string): {
  drafts: AiDraftPayload[]
  errors: string[]
} {
  const parsed = parseAssistantDrafts(content)
  const allowed = new Set(['create_character', 'create_wiki_entry', 'create_foreshadowing', 'create_plot_node'])
  return {
    drafts: parsed.drafts.filter((draft) => allowed.has(draft.kind)),
    errors: parsed.errors
  }
}

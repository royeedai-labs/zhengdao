import { describe, expect, it } from 'vitest'
import {
  CHAPTER_REVIEW_SECTIONS,
  buildChapterReviewPrompt,
  getChapterReviewUnavailableReason,
  extractReviewAssetDrafts,
  hasAllReviewSections,
  normalizeReviewReport
} from '../chapter-review'

describe('chapter review helpers', () => {
  it('builds a fixed-section review prompt', () => {
    const prompt = buildChapterReviewPrompt({
      chapterTitle: '第一章',
      chapterText: '正文',
      charactersText: '- 角色',
      foreshadowingsText: '- 伏笔',
      plotNodesText: '- 节点',
      userFocus: '看节奏'
    })
    for (const section of CHAPTER_REVIEW_SECTIONS) {
      expect(prompt.userPrompt).toContain(`## ${section}`)
    }
    expect(prompt.systemPrompt).toContain('不要替作者直接改正文')
  })

  it('normalizes non-conforming reports into the fixed review sections', () => {
    const normalized = normalizeReviewReport('这一章节奏偏慢。')
    expect(hasAllReviewSections(normalized)).toBe(true)
    expect(normalized).toContain('## 原始报告')
  })

  it('reports chapter review availability before opening a useless run path', () => {
    expect(getChapterReviewUnavailableReason({ currentChapter: null })).toBe('请先打开章节')
    expect(
      getChapterReviewUnavailableReason({
        currentChapter: { content: '<p><br /></p>' }
      })
    ).toBe('当前章节正文为空，无法审稿')
    expect(
      getChapterReviewUnavailableReason({
        currentChapter: { content: '<p>林雪推门入场。</p>' }
      })
    ).toBeNull()
  })

  it('extracts only supported asset drafts from review output', () => {
    const parsed = extractReviewAssetDrafts(`
审稿内容
\`\`\`json
{"drafts":[
  {"kind":"create_character","name":"林澈","description":"新角色"},
  {"kind":"replace_text","content":"不要进入资产建议"}
]}
\`\`\`
`)
    expect(parsed.drafts).toHaveLength(1)
    expect(parsed.drafts[0]).toMatchObject({ kind: 'create_character', name: '林澈' })
  })
})

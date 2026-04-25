import { describe, expect, it } from 'vitest'
import { formatLocalRagPrompt, rankLocalRagSnippets } from '../local-rag-service'

describe('local RAG service', () => {
  it('returns only small matching local snippets for the current request', () => {
    const snippets = rankLocalRagSnippets(
      [
        { id: 1, title: '第一章 宴会', content: '<p>林凡在宴会上反杀赵天宇，黑色戒指发烫。</p>' },
        { id: 2, title: '第二章 山路', content: '<p>苏离沿山路追查失踪案。</p>' }
      ],
      '林凡宴会反杀有什么证据？',
      2
    )

    expect(snippets).toHaveLength(1)
    expect(snippets[0]).toMatchObject({ chapterId: 1, title: '第一章 宴会' })
    expect(snippets[0]!.text).toContain('林凡')
    expect(formatLocalRagPrompt(snippets)).toContain('[L1] 第一章 宴会')
  })
})

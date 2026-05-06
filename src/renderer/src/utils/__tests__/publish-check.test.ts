import { describe, expect, it } from 'vitest'
import {
  buildPublishPackage,
  detectAiToneRisks,
  formatChapterForPublishing,
  htmlToPublishText
} from '../publish-check'

describe('publish check package', () => {
  it('turns editor html into platform-neutral publish text', () => {
    expect(htmlToPublishText('<p>第一段</p><p>第二段&nbsp;&amp;</p>')).toBe('第一段\n第二段 &')
    expect(formatChapterForPublishing({ id: 1, title: '第一章', content: '<p>正文</p>' })).toBe('第一章\n\n　　正文')
  })

  it('keeps plain text paragraph breaks in the generated publish package', () => {
    const pkg = buildPublishPackage(
      'chapter',
      [{ id: 1, title: '第一章', content: '第一段\n第二段', word_count: 6 }],
      [],
      { lowWordThreshold: 0 }
    )
    expect(pkg.text).toBe('第一章\n\n　　第一段\n　　第二段')
  })

  it('checks empty title, empty body, sensitive words, and low word count', () => {
    const pkg = buildPublishPackage(
      'book',
      [
        { id: 1, title: '', content: '<p>习近平出现</p>', word_count: 5 },
        { id: 2, title: '空章', content: '', word_count: 0 }
      ],
      ['习近平'],
      { lowWordThreshold: 10 }
    )
    expect(pkg.totalWords).toBe(5)
    expect(pkg.issues.map((issue) => issue.kind)).toEqual([
      'empty_title',
      'word_count_low',
      'sensitive_word',
      'empty_body'
    ])
  })

  it('flags high word count without requiring a platform account', () => {
    const pkg = buildPublishPackage(
      'chapter',
      [{ id: 1, title: '长章', content: '<p>很多字</p>', word_count: 13000 }],
      [],
      { highWordThreshold: 12000 }
    )
    expect(pkg.issues).toHaveLength(1)
    expect(pkg.issues[0]).toMatchObject({ kind: 'word_count_high', severity: 'warning' })
  })

  it('flags likely AI template phrases as platform-neutral publish warnings', () => {
    expect(detectAiToneRisks('命运的齿轮开始转动，空气中弥漫着不安。')).toEqual(['命运的齿轮', '空气中弥漫着'])

    const pkg = buildPublishPackage(
      'chapter',
      [{ id: 1, title: '第三章', content: '<p>命运的齿轮开始转动。</p>', word_count: 12 }],
      [],
      { lowWordThreshold: 0 }
    )

    expect(pkg.issues).toHaveLength(1)
    expect(pkg.issues[0]).toMatchObject({ kind: 'ai_tone_risk', severity: 'warning' })
  })
})

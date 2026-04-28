import { describe, expect, it } from 'vitest'
import {
  CREATION_BRIEF_FIELDS,
  getCreationBriefMissingFields,
  isCreationBriefConfirmed,
  normalizeCreationBrief,
  stripBookCreationChapterContent,
  validateBookCreationPackage,
  type AiBookCreationPackage
} from '../ai-book-creation'

describe('AI book creation shared helpers', () => {
  it('keeps creation blocked until all required brief fields are present and confirmed', () => {
    const missing = getCreationBriefMissingFields({
      title: '长夜证道',
      genreTheme: '都市修真，主题是代价与选择'
    })

    expect(missing.map((field) => field.key)).toContain('targetLength')
    expect(missing.map((field) => field.key)).not.toContain('chapterPlan')
    expect(isCreationBriefConfirmed({
      title: '长夜证道',
      genreTheme: '都市修真',
      targetLength: '100 万字',
      confirmed: false
    })).toBe(false)

    expect(isCreationBriefConfirmed({
      title: '长夜证道',
      genreTheme: '都市修真',
      targetLength: '让 AI 评估篇幅',
      confirmed: true
    })).toBe(true)
  })

  it('marks optional guidance fields as non-blocking and offers multiple choices', () => {
    const characterPlan = CREATION_BRIEF_FIELDS.find((field) => field.key === 'characterPlan')
    const genreTheme = CREATION_BRIEF_FIELDS.find((field) => field.key === 'genreTheme')

    expect(characterPlan?.required).toBe(false)
    expect(characterPlan?.quickOptions).toContain('让 AI 写人物组')
    expect(genreTheme?.multiSelect).toBe(true)
    expect(genreTheme?.quickOptions.length).toBeGreaterThanOrEqual(5)
  })

  it('normalizes model output that uses visible Chinese field labels', () => {
    expect(normalizeCreationBrief({
      作品名或暂定名: '老王的人生',
      '题材/主题/核心冲突': '现实生活',
      目标总字数或篇幅范围: '10 万字以内'
    })).toMatchObject({
      title: '老王的人生',
      genreTheme: '现实生活',
      targetLength: '10 万字以内'
    })
  })

  it('accepts a complete package only when it can create a real writing workspace', () => {
    const pkg: AiBookCreationPackage = {
      book: { title: '长夜证道' },
      volumes: [{ title: '第一卷', chapters: [{ title: '第一章', content: '开篇正文' }] }],
      characters: [{ name: '陆明' }],
      wikiEntries: [],
      plotNodes: [],
      foreshadowings: []
    }

    expect(validateBookCreationPackage(pkg)).toEqual({ ok: true, errors: [] })
    expect(validateBookCreationPackage({ ...pkg, volumes: [] }).ok).toBe(false)
  })

  it('strips generated prose from chapter bodies before creating a writing workspace', () => {
    const pkg: AiBookCreationPackage = {
      book: { title: '老王的人生' },
      volumes: [
        {
          title: '第一卷',
          chapters: [{ title: '第一章 开始', summary: '建立主角处境。', content: '这段不应直接进入正文。' }]
        }
      ],
      characters: [{ name: '老王' }],
      wikiEntries: [],
      plotNodes: [],
      foreshadowings: []
    }

    const stripped = stripBookCreationChapterContent(pkg)

    expect(stripped.volumes[0].chapters[0]).toMatchObject({
      title: '第一章 开始',
      summary: '建立主角处境。',
      content: ''
    })
    expect(pkg.volumes[0].chapters[0].content).toBe('这段不应直接进入正文。')
    expect(validateBookCreationPackage(stripped)).toEqual({ ok: true, errors: [] })
  })
})

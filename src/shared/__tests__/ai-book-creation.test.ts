import { describe, expect, it } from 'vitest'
import {
  CREATION_BRIEF_FIELDS,
  extractCharacterPlanItems,
  getCreationBriefMissingFields,
  getMinimumCharacterCount,
  hasCreationBriefInput,
  isCreationBriefConfirmed,
  normalizeCreationBrief,
  normalizeCreationRelations,
  stripBookCreationChapterContent,
  validateBookCreationPackage,
  type AiBookCreationPackage
} from '../ai-book-creation'

describe('AI book creation shared helpers', () => {
  it('allows a one-line idea or any brief field to start book creation', () => {
    expect(hasCreationBriefInput({})).toBe(false)
    expect(getCreationBriefMissingFields({})).toEqual([])
    expect(hasCreationBriefInput({ seedIdea: '退休刑警回小镇查旧案' })).toBe(true)
    expect(hasCreationBriefInput({ title: '长夜证道' })).toBe(true)

    expect(isCreationBriefConfirmed({
      seedIdea: '退休刑警回小镇查旧案',
      confirmed: false
    })).toBe(false)

    expect(isCreationBriefConfirmed({
      seedIdea: '退休刑警回小镇查旧案',
      confirmed: true
    })).toBe(true)

    expect(isCreationBriefConfirmed({
      title: '长夜证道',
      confirmed: true
    })).toBe(true)
  })

  it('marks all advanced guidance fields as non-blocking and offers multiple choices', () => {
    const title = CREATION_BRIEF_FIELDS.find((field) => field.key === 'title')
    const characterPlan = CREATION_BRIEF_FIELDS.find((field) => field.key === 'characterPlan')
    const genreTheme = CREATION_BRIEF_FIELDS.find((field) => field.key === 'genreTheme')

    expect(title?.required).toBe(false)
    expect(genreTheme?.required).toBe(false)
    expect(characterPlan?.required).toBe(false)
    expect(characterPlan?.quickOptions).toContain('AI 写人物组')
    expect(genreTheme?.multiSelect).toBe(true)
    expect(genreTheme?.quickOptions.length).toBeGreaterThanOrEqual(5)
  })

  it('normalizes model output that uses visible Chinese field labels', () => {
    expect(normalizeCreationBrief({
      一句话灵感: '一个退休刑警回到小镇',
      '书名（可选）': '老王的人生',
      '题材与核心冲突（可选）': '现实生活',
      '篇幅目标（可选）': '10 万字以内'
    })).toMatchObject({
      seedIdea: '一个退休刑警回到小镇',
      title: '老王的人生',
      genreTheme: '现实生活',
      targetLength: '10 万字以内'
    })
  })

  it('accepts a complete package only when it can create a real writing workspace', () => {
    const pkg: AiBookCreationPackage = {
      book: { title: '长夜证道' },
      volumes: [
        {
          title: '第一卷',
          chapters: [
            { title: '第一章', summary: '开篇', content: '开篇正文' },
            { title: '第二章', summary: '推进', content: '' },
            { title: '第三章', summary: '反转', content: '' }
          ]
        }
      ],
      characters: [{ name: '陆明' }, { name: '周青' }],
      relations: [{ sourceName: '陆明', targetName: '周青', relationType: 'ally', label: '共同查案' }],
      wikiEntries: [
        { category: '世界观', title: '城市', content: '现实城市' },
        { category: '规则', title: '行业', content: '职场规则' }
      ],
      plotNodes: [
        { chapterNumber: 1, title: '开篇钩子', score: 1 },
        { chapterNumber: 2, title: '线索推进', score: 2 },
        { chapterNumber: 3, title: '反转爽点', score: 3 }
      ],
      foreshadowings: [{ text: '第一章的小细节第三章回收。', expectedChapter: 3 }]
    }

    expect(validateBookCreationPackage(pkg)).toEqual({ ok: true, errors: [] })
    expect(validateBookCreationPackage({ ...pkg, volumes: [] }).ok).toBe(false)
    expect(validateBookCreationPackage({ ...pkg, characters: [{ name: '陆明' }] }).ok).toBe(false)
    expect(validateBookCreationPackage({ ...pkg, relations: [] }).ok).toBe(false)
  })

  it('derives the minimum character count from explicit character requirements', () => {
    expect(extractCharacterPlanItems('退休老人、小伙')).toEqual(['退休老人', '小伙'])
    expect(getMinimumCharacterCount({ characterPlan: '退休老人、小伙' })).toBe(2)
    expect(getMinimumCharacterCount({ characterPlan: '主角、反派、3 个关键配角' })).toBe(5)
    expect(getMinimumCharacterCount({ characterPlan: '群像' })).toBe(4)
    expect(getMinimumCharacterCount({ characterPlan: '30岁男性主角' })).toBe(2)
  })

  it('normalizes AI book creation relations by character name and relation type aliases', () => {
    expect(
      normalizeCreationRelations(
        [
          { sourceName: '陆明', targetName: '周青', relationType: 'friend', label: '一起查案' },
          { sourceName: '陆明', targetName: '玄衡', relationType: 'master', label: '旧师徒' },
          { sourceName: '陆明', targetName: '陆明', relationType: 'enemy' }
        ],
        ['陆明', '周青', '玄衡']
      )
    ).toEqual([
      { sourceName: '陆明', targetName: '周青', relationType: 'ally', label: '一起查案' },
      { sourceName: '陆明', targetName: '玄衡', relationType: 'mentor', label: '旧师徒' }
    ])
  })

  it('strips generated prose from chapter bodies before creating a writing workspace', () => {
    const pkg: AiBookCreationPackage = {
      book: { title: '老王的人生' },
      volumes: [
        {
          title: '第一卷',
          chapters: [
            { title: '第一章 开始', summary: '建立主角处境。', content: '这段不应直接进入正文。' },
            { title: '第二章 推进', summary: '推动线索。', content: '也不应写入。' },
            { title: '第三章 反转', summary: '完成反转。', content: '' }
          ]
        }
      ],
      characters: [{ name: '老王' }, { name: '小李' }],
      relations: [{ sourceName: '老王', targetName: '小李', relationType: 'ally', label: '共同调查旧照片' }],
      wikiEntries: [
        { category: '世界观', title: '小镇', content: '小镇熟人社会' },
        { category: '规则', title: '线索规则', content: '线索必须可回收' }
      ],
      plotNodes: [
        { chapterNumber: 1, title: '开篇钩子', score: 1 },
        { chapterNumber: 2, title: '线索推进', score: 2 },
        { chapterNumber: 3, title: '反转爽点', score: 3 }
      ],
      foreshadowings: [{ text: '旧照片第三章回收。', expectedChapter: 3 }]
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

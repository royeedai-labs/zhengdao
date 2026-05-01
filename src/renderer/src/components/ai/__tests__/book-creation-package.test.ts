import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateBookCreationPackage, type AiBookCreationPackage } from '../../../../../shared/ai-book-creation'
import {
  buildFallbackBookCreationPackage,
  mergeBookCreationPackageWithFallback
} from '../book-creation/package'
import { formatBriefForPrompt } from '../book-creation/brief'
import { buildBookPackagePrompt } from '../book-creation/prompts'
import { resolveCreationFlowState } from '../book-creation/creation-flow-state'

describe('book creation package fallback', () => {
  it('splits explicit character requirements into separate fallback characters', () => {
    const fallback = buildFallbackBookCreationPackage({
      title: '乡村鬼故事',
      genreTheme: '悬疑推理',
      targetLength: '10 万字以内',
      chapterPlan: '10 章左右',
      characterPlan: '退休老人、小伙',
      styleAudiencePlatform: '悬疑反转',
      worldbuilding: '轻幻想元素'
    })

    expect(fallback.characters.map((character) => character.name)).toEqual(['退休老人', '小伙'])
    expect(fallback.relations).toEqual([
      expect.objectContaining({
        sourceName: '退休老人',
        targetName: '小伙',
        relationType: 'ally'
      })
    ])
    expect(fallback.volumes[0].chapters).toHaveLength(3)
    expect(fallback.plotNodes).toHaveLength(3)
    expect(fallback.foreshadowings).toHaveLength(1)
    expect(fallback.volumes[0].chapters.every((chapter) => chapter.content === '')).toBe(true)
    expect(validateBookCreationPackage(fallback, { minCharacters: 2 })).toEqual({
      ok: true,
      errors: []
    })
  })

  it('repairs a one-character one-chapter model package with deterministic resources', () => {
    const fallback = buildFallbackBookCreationPackage({
      title: '乡村鬼故事',
      genreTheme: '悬疑推理',
      targetLength: '10 万字以内',
      characterPlan: '退休老人、小伙'
    })
    const modelPackage: AiBookCreationPackage = {
      book: { title: '乡村鬼故事' },
      volumes: [{ title: '第一卷', chapters: [{ title: '第一章', summary: '开篇', content: '正文' }] }],
      characters: [{ name: '主角', description: '退休老人、小伙' }],
      wikiEntries: [],
      plotNodes: [{ chapterNumber: 1, title: '开篇', score: 1 }],
      foreshadowings: []
    }

    const repaired = mergeBookCreationPackageWithFallback(modelPackage, fallback)

    expect(repaired.characters.map((character) => character.name)).toEqual(['退休老人', '小伙'])
    expect(repaired.relations).toEqual([
      expect.objectContaining({
        sourceName: '退休老人',
        targetName: '小伙',
        relationType: 'ally'
      })
    ])
    expect(repaired.volumes[0].chapters).toHaveLength(3)
    expect(repaired.plotNodes).toHaveLength(3)
    expect(repaired.wikiEntries.length).toBeGreaterThanOrEqual(2)
    expect(repaired.foreshadowings).toHaveLength(1)
    expect(repaired.volumes[0].chapters.every((chapter) => chapter.content === '')).toBe(true)
  })

  it('builds a valid fallback package from only a one-line seed idea', () => {
    const fallback = buildFallbackBookCreationPackage({
      seedIdea: '退休刑警回到小镇，发现二十年前旧案和女儿失踪有关'
    })

    expect(fallback.book.title).toBeTruthy()
    expect(fallback.workProfile?.genreRules).toContain('退休刑警')
    expect(fallback.characters.length).toBeGreaterThanOrEqual(2)
    expect(fallback.volumes[0].chapters).toHaveLength(3)
    expect(validateBookCreationPackage(fallback)).toEqual({ ok: true, errors: [] })
  })

  it('marks blank prompt fields for AI completion while preserving explicit constraints', () => {
    const brief = {
      seedIdea: '退休刑警回小镇查旧案',
      targetLength: '10 万字以内',
      boundaries: '不写血腥'
    }
    const prompt = buildBookPackagePrompt(brief)
    const formatted = formatBriefForPrompt(brief)

    expect(formatted).toContain('核心灵感: 退休刑警回小镇查旧案')
    expect(formatted).toContain('书名（可选）: 未填写，交给 AI 补全')
    expect(formatted).toContain('篇幅目标（可选）: 10 万字以内')
    expect(prompt.systemPrompt).toContain('用户明确填写的创作方向字段当作硬约束')
    expect(prompt.systemPrompt).toContain('用户留空的作品名、题材、篇幅')
    expect(prompt.systemPrompt).toContain('relations 必须至少 1 条')
    expect(prompt.userPrompt).toContain('"relations"')
    expect(prompt.userPrompt).toContain('不写血腥')
  })
})

describe('book creation flow state', () => {
  it('maps empty input, brief, generation, preview, and creating to fixed steps', () => {
    expect(resolveCreationFlowState({
      hasBriefInput: false,
      generating: false,
      hasPackageDraft: false,
      creating: false
    })).toMatchObject({ step: 1, stage: 'empty', status: '第 1/4 步 · 先写一句故事灵感' })

    expect(resolveCreationFlowState({
      hasBriefInput: true,
      generating: false,
      hasPackageDraft: false,
      creating: false
    })).toMatchObject({ step: 2, stage: 'brief_ready', status: '第 2/4 步 · 可选方向随时补充' })

    expect(resolveCreationFlowState({
      hasBriefInput: true,
      generating: true,
      hasPackageDraft: false,
      creating: false
    })).toMatchObject({ step: 3, stage: 'generating', status: '第 3/4 步 · 正在生成起书方案' })

    expect(resolveCreationFlowState({
      hasBriefInput: true,
      generating: false,
      hasPackageDraft: true,
      creating: false
    })).toMatchObject({ step: 4, stage: 'preview_ready', status: '第 4/4 步 · 确认后才创建作品' })

    expect(resolveCreationFlowState({
      hasBriefInput: true,
      generating: false,
      hasPackageDraft: true,
      creating: true
    })).toMatchObject({ step: 4, stage: 'creating', status: '第 4/4 步 · 正在创建本地作品' })
  })
})

describe('BookshelfCreationAssistantPanel UX copy', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('@/stores/book-store')
    vi.doUnmock('@/stores/chapter-store')
    vi.doUnmock('@/stores/toast-store')
    vi.doUnmock('@/stores/ui-store')
  })

  async function renderBookshelfCreationAssistantPanel() {
    vi.resetModules()
    vi.doMock('@/stores/book-store', () => ({
      useBookStore: (selector: (state: { loadBooks: () => Promise<void>; openBook: () => void }) => unknown) =>
        selector({ loadBooks: vi.fn().mockResolvedValue(undefined), openBook: vi.fn() })
    }))
    vi.doMock('@/stores/chapter-store', () => ({
      useChapterStore: (selector: (state: { selectChapter: () => Promise<void> }) => unknown) =>
        selector({ selectChapter: vi.fn().mockResolvedValue(undefined) })
    }))
    vi.doMock('@/stores/toast-store', () => ({
      useToastStore: {
        getState: () => ({ addToast: vi.fn() })
      }
    }))
    vi.doMock('@/stores/ui-store', () => ({
      useUIStore: (
        selector: (state: {
          closeAiAssistant: () => void
          openAiAssistant: () => void
          aiAssistantCommand: null
          consumeAiAssistantCommand: () => void
        }) => unknown
      ) =>
        selector({
          closeAiAssistant: vi.fn(),
          openAiAssistant: vi.fn(),
          aiAssistantCommand: null,
          consumeAiAssistantCommand: vi.fn()
        })
    }))

    const { BookshelfCreationAssistantPanel } = await import('../book-creation/BookshelfCreationAssistantPanel')
    return renderToString(createElement(BookshelfCreationAssistantPanel))
  }

  it('renders the empty state as a four-step AI book-starting workspace', async () => {
    const html = await renderBookshelfCreationAssistantPanel()

    expect(html).toContain('AI 起书')
    expect(html).toContain('第 1/4 步')
    expect(html).toContain('创作方向（可选）')
    expect(html).toContain('生成起书方案')
    expect(html).not.toContain('老手可控')
    expect(html).not.toContain('高级参数')
  })
})

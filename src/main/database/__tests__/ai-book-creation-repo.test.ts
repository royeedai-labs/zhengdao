import { rmSync } from 'fs'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import type { AiBookCreationPackage, AssistantCreationBrief } from '../../../shared/ai-book-creation'

const state = vi.hoisted(() => ({
  db: null as Database.Database | null,
  userData: `/tmp/zhengdao-ai-book-cover-${Math.random().toString(36).slice(2)}`
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => state.userData
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

vi.mock('../connection', () => ({
  getDb: () => {
    if (!state.db) throw new Error('test db not initialized')
    return state.db
  }
}))

import { createBookFromAiPackage } from '../ai-book-creation-repo'

function completeBrief(): AssistantCreationBrief {
  return {
    title: '急诊夜班',
    seedIdea: '急诊科医生的日常，每天日常加很多紧急情况医学处理',
    genreTheme: '现实医疗，核心冲突是专业判断、患者信任和医院流程压力',
    targetLength: '8 章试写',
    chapterPlan: '2 卷 8 章',
    characterPlan: '超 10 个人物，2 个主角',
    styleAudiencePlatform: '现实质感，强情节但不过度夸张',
    worldbuilding: '三甲医院急诊科',
    boundaries: '不写血腥猎奇',
    otherRequirements: '前 3 章爽点和悬念要合理',
    confirmed: true
  }
}

function packageDraft(): AiBookCreationPackage {
  const chapters = Array.from({ length: 8 }, (_, index) => ({
    title: `第${index + 1}章 急诊事件${index + 1}`,
    content: index === 0 ? '这段不应直接进入正文。' : '',
    summary: `第${index + 1}章围绕急诊事件推进，完成一次专业判断、关系变化或悬念升级。`
  }))
  const customFields = (index: number) => ({
    role: index < 2 ? `第${index + 1}主角` : '功能角色',
    personality: index < 2 ? '冷静果断，重视患者结果' : '立场明确，能制造信息差',
    goal: index < 2 ? '守住急诊判断并推进核心事件' : '推动医疗事件升级或提供关键线索',
    specialty: index < 2 ? '急诊判断与现场协调' : '专业资源、人脉或现实压力',
    arc: `第${index + 1}名人物在前八章完成一次立场或关系变化。`
  })
  return {
    book: { title: '急诊夜班', author: '测试作者' },
    workProfile: {
      productGenre: 'webnovel',
      styleGuide: '现实质感，专业判断清楚，冲突推进明确',
      contentBoundaries: '不写血腥猎奇'
    },
    volumes: [
      {
        title: '第一卷 开篇入局',
        chapters: chapters.slice(0, 4)
      },
      {
        title: '第二卷 升级反转',
        chapters: chapters.slice(4)
      }
    ],
    characters: Array.from({ length: 11 }, (_, index) => ({
      name: index === 0 ? '许知远' : index === 1 ? '林夏' : `急诊人物${index + 1}`,
      faction: index < 2 ? 'protagonist' : index === 2 ? 'antagonist' : 'neutral',
      status: 'active',
      description: `第${index + 1}名人物承担急诊主线中的专业、关系或现实压力功能。`,
      customFields: customFields(index)
    })),
    relations: [
      { sourceName: '许知远', targetName: '林夏', relationType: 'ally', label: '双主角互补推进急诊主线' },
      { sourceName: '许知远', targetName: '急诊人物3', relationType: 'rival', label: '围绕处置判断形成阶段性冲突' }
    ],
    wikiEntries: [
      { category: '世界观', title: '三甲医院急诊科', content: '急诊科以分诊、抢救、观察和转科流程推动故事节奏。' },
      { category: '行业规则', title: '分诊优先级', content: '患者危急程度决定处置顺序，也是冲突来源之一。' },
      { category: '主线冲突', title: '专业判断与信任', content: '主角需要在证据不完整时做出负责判断。' },
      { category: '节奏规则', title: '压力与兑现', content: '压力节点必须服务后续反击或医学处置兑现。' }
    ],
    plotNodes: Array.from({ length: 8 }, (_, index) => ({
      chapterNumber: index + 1,
      title: `急诊节点${index + 1}`,
      score: [1, 2, 3, -1, 1, -2, 2, 4][index],
      nodeType: 'main' as const,
      description: `第${index + 1}章提供专业判断、线索落地、压力升级或阶段兑现。`
    })),
    foreshadowings: [
      { text: '第一章分诊台上的异常病历第三章回收', expectedChapter: 3, expectedWordCount: null },
      { text: '第六章患者家属的一句话第八章回收', expectedChapter: 8, expectedWordCount: null }
    ]
  }
}

describe('AI book creation repository', () => {
  beforeEach(() => {
    rmSync(state.userData, { recursive: true, force: true })
    state.db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(state.db)
  })

  afterEach(() => {
    state.db?.close()
    state.db = null
    rmSync(state.userData, { recursive: true, force: true })
  })

  it('creates a complete book workspace from a confirmed AI package', () => {
    const result = createBookFromAiPackage({
      brief: completeBrief(),
      package: packageDraft(),
      messages: [{ role: 'user', content: '我要写一部急诊科医生日常。' }]
    }) as { book: { id: number; title: string; cover_path: string; cover_url: string }; firstChapterId: number; conversationId: number }

    expect(result.book.title).toBe('急诊夜班')
    expect(result.book.cover_path.endsWith('auto-cover.svg')).toBe(true)
    expect(result.book.cover_url).toMatch(/^zhengdao-cover:\/\/book\//)
    expect(result.firstChapterId).toBeGreaterThan(0)
    expect(result.conversationId).toBeGreaterThan(0)
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM volumes').get()).toEqual({ count: 2 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM chapters').get()).toEqual({ count: 8 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM characters').get()).toEqual({ count: 11 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM character_relations').get()).toEqual({ count: 2 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM settings_wiki').get()).toEqual({ count: 4 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM plot_nodes').get()).toEqual({ count: 8 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM foreshadowings').get()).toEqual({ count: 2 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM ai_messages').get()).toEqual({ count: 1 })
    expect(
      state.db!.prepare('SELECT genre, character_fields, faction_labels, status_labels FROM project_config WHERE book_id = ?').get(result.book.id)
    ).toMatchObject({
      genre: 'AI 起书'
    })
    expect(
      JSON.parse((state.db!.prepare('SELECT character_fields FROM project_config WHERE book_id = ?').get(result.book.id) as { character_fields: string }).character_fields)
        .map((field: { key: string }) => field.key)
    ).toEqual(['role', 'personality', 'goal', 'specialty', 'arc'])
    expect(
      JSON.parse((state.db!.prepare("SELECT custom_fields FROM characters WHERE name = '许知远'").get() as { custom_fields: string }).custom_fields)
    ).toMatchObject({
      role: '第1主角',
      personality: '冷静果断，重视患者结果'
    })
    expect(
      state.db!.prepare('SELECT chapter_number FROM plot_nodes ORDER BY chapter_number').all()
    ).toEqual(Array.from({ length: 8 }, (_, index) => ({ chapter_number: index + 1 })))
    expect(
      state.db!.prepare('SELECT content, word_count, summary FROM chapters WHERE id = ?').get(result.firstChapterId)
    ).toEqual({
      content: '',
      word_count: 0,
      summary: '第1章围绕急诊事件推进，完成一次专业判断、关系变化或悬念升级。'
    })
  })

  it('rejects invalid packages without leaving half-created books', () => {
    expect(() =>
      createBookFromAiPackage({
        brief: completeBrief(),
        package: { ...packageDraft(), volumes: [] }
      })
    ).toThrow('缺少分卷')

    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM books').get()).toEqual({ count: 0 })
  })
})

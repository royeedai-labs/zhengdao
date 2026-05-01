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
    title: '长夜证道',
    genreTheme: '都市修真，主题是代价与选择',
    targetLength: '100 万字',
    chapterPlan: '300 章，每章约 3000 字',
    characterPlan: '主角、反派、3 个关键配角',
    styleAudiencePlatform: '男频爽文，起点向',
    worldbuilding: '现代都市中隐藏修真门派',
    boundaries: '不写血腥虐杀',
    otherRequirements: '无',
    confirmed: true
  }
}

function packageDraft(): AiBookCreationPackage {
  return {
    book: { title: '长夜证道', author: '测试作者' },
    workProfile: {
      productGenre: 'webnovel',
      styleGuide: '冷静克制，冲突推进明确',
      contentBoundaries: '不写血腥虐杀'
    },
    volumes: [
      {
        title: '第一卷',
        chapters: [
          { title: '第一章 风雪夜归人', content: '他在风雪里推开门。', summary: '主角登场。' },
          { title: '第二章 旧地铃声', content: '', summary: '线索推进。' },
          { title: '第三章 隐门初现', content: '', summary: '第一次反转。' }
        ]
      }
    ],
    characters: [
      { name: '陆明', faction: 'protagonist', status: 'active', description: '主角' },
      { name: '沈青', faction: 'ally', status: 'active', description: '关键盟友' },
      { name: '玄衡', faction: 'antagonist', status: 'active', description: '反派' },
      { name: '周伯', faction: 'neutral', status: 'active', description: '旧事知情人' },
      { name: '林月', faction: 'ally', status: 'active', description: '关键配角' }
    ],
    relations: [
      { sourceName: '陆明', targetName: '沈青', relationType: 'ally', label: '共同追查隐门旧案' },
      { sourceName: '陆明', targetName: '玄衡', relationType: 'enemy', label: '围绕灵脉争夺正面对抗' }
    ],
    wikiEntries: [
      { category: '世界观', title: '隐门', content: '隐藏在都市中的修行组织。' },
      { category: '规则', title: '灵脉', content: '灵脉觉醒会引发旧势力争夺。' }
    ],
    plotNodes: [
      { chapterNumber: 1, title: '归来', score: 2, nodeType: 'main', description: '主角回到旧地。' },
      { chapterNumber: 2, title: '旧铃线索', score: 2, nodeType: 'main', description: '铜铃指向隐门旧案。' },
      { chapterNumber: 3, title: '隐门反转', score: 3, nodeType: 'main', description: '旧地不是普通故居。' }
    ],
    foreshadowings: [{ text: '门口的旧铜铃无人自响', expectedChapter: 12, expectedWordCount: null }]
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
      messages: [{ role: 'user', content: '我要写一部都市修真。' }]
    }) as { book: { id: number; title: string; cover_path: string; cover_url: string }; firstChapterId: number; conversationId: number }

    expect(result.book.title).toBe('长夜证道')
    expect(result.book.cover_path.endsWith('auto-cover.svg')).toBe(true)
    expect(result.book.cover_url).toMatch(/^zhengdao-cover:\/\/book\//)
    expect(result.firstChapterId).toBeGreaterThan(0)
    expect(result.conversationId).toBeGreaterThan(0)
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM chapters').get()).toEqual({ count: 3 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM characters').get()).toEqual({ count: 5 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM character_relations').get()).toEqual({ count: 2 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM settings_wiki').get()).toEqual({ count: 2 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM plot_nodes').get()).toEqual({ count: 3 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM foreshadowings').get()).toEqual({ count: 1 })
    expect(state.db!.prepare('SELECT COUNT(*) AS count FROM ai_messages').get()).toEqual({ count: 1 })
    expect(
      state.db!.prepare('SELECT content, word_count, summary FROM chapters WHERE id = ?').get(result.firstChapterId)
    ).toEqual({
      content: '',
      word_count: 0,
      summary: '主角登场。'
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

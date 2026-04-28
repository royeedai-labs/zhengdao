import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'

const state = vi.hoisted(() => ({
  db: null as Database.Database | null
}))

vi.mock('../connection', () => ({
  getDb: () => {
    if (!state.db) throw new Error('test db not initialized')
    return state.db
  }
}))

import {
  addAiMessage,
  clearAiConversation,
  createAiConversation,
  createAiDraft,
  deleteAiConversation,
  getAiConversations,
  getAiDrafts,
  getAiMessages,
  getAiWorkProfile,
  getGlobalAiConfig,
  getResolvedAiConfigForBook,
  getResolvedGlobalAiConfig,
  saveGlobalAiConfig,
  saveAiWorkProfile
} from '../ai-assistant-repo'

describe('ai assistant conversation repository', () => {
  beforeEach(() => {
    state.db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(state.db)
    state.db.prepare("INSERT INTO books (id, title, author) VALUES (1, '测试书', '')").run()
  })

  afterEach(() => {
    state.db?.close()
    state.db = null
  })

  it('creates and lists independent conversations for a book', () => {
    const first = createAiConversation(1) as { id: number; title: string }
    const second = createAiConversation(1) as { id: number; title: string }

    expect(first.id).not.toBe(second.id)
    expect(first.title).toBe('AI 对话')

    const rows = getAiConversations(1) as Array<{ id: number }>
    expect(rows.map((row) => row.id)).toEqual([second.id, first.id])
  })

  it('clears only the selected conversation messages and pending drafts', () => {
    const first = createAiConversation(1) as { id: number }
    const second = createAiConversation(1) as { id: number }
    addAiMessage(first.id, 'user', '第一会话')
    addAiMessage(second.id, 'user', '第二会话')
    const firstDraft = createAiDraft({
      book_id: 1,
      conversation_id: first.id,
      kind: 'create_character',
      title: '角色',
      payload: { kind: 'create_character', name: '角色' }
    }) as { id: number }
    const secondDraft = createAiDraft({
      book_id: 1,
      conversation_id: second.id,
      kind: 'create_character',
      title: '保留角色',
      payload: { kind: 'create_character', name: '保留角色' }
    }) as { id: number }
    state.db!.prepare("UPDATE ai_drafts SET status = 'applied' WHERE id = ?").run(firstDraft.id)

    clearAiConversation(first.id)

    expect(getAiMessages(first.id)).toEqual([])
    expect(getAiMessages(second.id)).toHaveLength(1)
    expect((getAiDrafts(1, 'all') as Array<{ id: number }>).map((draft) => draft.id).sort()).toEqual([
      firstDraft.id,
      secondDraft.id
    ])
  })

  it('deletes one conversation history without touching other conversations', () => {
    const first = createAiConversation(1) as { id: number }
    const second = createAiConversation(1) as { id: number }
    addAiMessage(first.id, 'user', '第一会话')
    addAiMessage(second.id, 'user', '第二会话')
    createAiDraft({
      book_id: 1,
      conversation_id: first.id,
      kind: 'create_character',
      title: '删除角色',
      payload: { kind: 'create_character', name: '删除角色' }
    })
    const retainedDraft = createAiDraft({
      book_id: 1,
      conversation_id: second.id,
      kind: 'create_character',
      title: '保留角色',
      payload: { kind: 'create_character', name: '保留角色' }
    }) as { id: number }

    deleteAiConversation(first.id)

    expect((getAiConversations(1) as Array<{ id: number }>).map((row) => row.id)).toEqual([second.id])
    expect(getAiMessages(first.id)).toEqual([])
    expect(getAiMessages(second.id)).toHaveLength(1)
    expect((getAiDrafts(1, 'all') as Array<{ id: number }>).map((draft) => draft.id)).toEqual([
      retainedDraft.id
    ])
  })

  it('uses one global AI config and ignores work-level account references', () => {
    state.db!
      .prepare(
        `INSERT INTO ai_accounts (id, name, provider, api_endpoint, model, credential_ref, is_default, status)
         VALUES
         (1, '作品旧账号', 'openai', 'https://work.example/v1', 'work-model', '', 0, 'unknown'),
         (2, '应用默认账号', 'gemini_cli', '', 'global-model', '', 1, 'unknown')`
      )
      .run()
    state.db!
      .prepare(
        `INSERT INTO ai_work_profiles (
          book_id, default_account_id, style_guide, genre_rules, content_boundaries, asset_rules, rhythm_rules, context_policy
        ) VALUES (1, 1, '', '', '', '', '', 'smart_minimal')`
      )
      .run()

    expect(getResolvedAiConfigForBook(1)).toMatchObject({
      ai_provider: 'zhengdao_official',
      ai_model: ''
    })

    saveGlobalAiConfig({
      ai_provider: 'gemini_cli',
      ai_model: 'global-model'
    })

    expect(getResolvedAiConfigForBook(1)).toMatchObject({
      ai_provider: 'gemini_cli',
      ai_model: 'global-model'
    })
    expect(getResolvedGlobalAiConfig()).toMatchObject({
      ai_provider: 'gemini_cli',
      ai_model: 'global-model'
    })
    expect(getGlobalAiConfig()).toMatchObject({
      ai_provider: 'gemini_cli',
      ai_model: 'global-model'
    })
  })

  it('clears incoming work-level account references when saving a work profile', () => {
    saveAiWorkProfile(1, {
      default_account_id: 9,
      style_guide: '短句，强节奏。'
    })

    const profile = getAiWorkProfile(1) as { default_account_id: number | null; style_guide: string }
    expect(profile.default_account_id).toBeNull()
    expect(profile.style_guide).toBe('短句，强节奏。')
  })
})

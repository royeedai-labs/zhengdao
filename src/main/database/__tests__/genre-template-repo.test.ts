import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  db: null as Database.Database | null
}))

vi.mock('../connection', () => ({
  getDb: () => {
    if (!state.db) throw new Error('Database not initialized in test')
    return state.db
  }
}))

import { runMigrations } from '../migrations'
import { createSchema } from '../schema'
import {
  copyGenreTemplate,
  createGenreTemplate,
  deleteGenreTemplate,
  getGenreTemplates,
  updateGenreTemplate
} from '../genre-template-repo'

describe('genre-template-repo', () => {
  beforeEach(() => {
    state.db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(state.db)
    runMigrations(state.db)
  })

  afterEach(() => {
    state.db?.close()
    state.db = null
  })

  it('creates, updates, copies, and deletes custom genre templates while preserving seed templates', () => {
    const initial = getGenreTemplates()
    expect(initial.length).toBeGreaterThanOrEqual(5)
    expect(initial[0]?.is_seed).toBe(1)

    const created = createGenreTemplate({
      name: 'Mystery Crew',
      character_fields: [{ key: 'clue', label: '线索', type: 'text' }],
      faction_labels: [{ value: 'team', label: '调查组', color: 'indigo' }],
      status_labels: [{ value: 'active', label: '活跃' }],
      emotion_labels: [{ score: 2, label: '悬念推进' }]
    })

    expect(created).toMatchObject({
      name: 'Mystery Crew',
      is_seed: 0,
      slug: 'mystery-crew'
    })

    const updated = updateGenreTemplate(created!.id, { name: 'Mystery Crew Updated' })
    expect(updated).toMatchObject({
      id: created!.id,
      name: 'Mystery Crew Updated',
      slug: 'mystery-crew'
    })

    const copied = copyGenreTemplate(created!.id)
    expect(copied).toMatchObject({
      is_seed: 0,
      name: 'Mystery Crew Updated（副本）'
    })

    expect(deleteGenreTemplate(initial[0]!.id)).toBe(false)
    expect(deleteGenreTemplate(created!.id)).toBe(true)
    expect(getGenreTemplates().some((item) => item?.id === created!.id)).toBe(false)
  })
})

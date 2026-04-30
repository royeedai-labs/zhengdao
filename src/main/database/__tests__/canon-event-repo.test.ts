import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import { runMigrations } from '../migrations'
import * as connection from '../connection'
import {
  createEvent,
  deleteEvent,
  getById,
  listByBookId,
  updateEvent
} from '../canon-event-repo'

describe('canon-event-repo', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(db)
    runMigrations(db)
    db.prepare("INSERT INTO books (id, title, author) VALUES (1, 'demo', '')").run()
    vi.spyOn(connection, 'getDb').mockReturnValue(db)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('inserts an event with sane defaults and returns it', () => {
    const created = createEvent({
      book_id: 1,
      title: '主角觉醒',
      chapter_number: 7
    })
    expect(created.id).toBeGreaterThan(0)
    expect(created.book_id).toBe(1)
    expect(created.title).toBe('主角觉醒')
    expect(created.event_type).toBe('plot')
    expect(created.importance).toBe('normal')
    expect(created.related_character_ids).toEqual([])
    expect(created.metadata).toEqual({})
  })

  it('rejects event with empty title', () => {
    expect(() => createEvent({ book_id: 1, title: '   ' })).toThrow(/invalid_event_input/)
  })

  it('lists events ordered by chapter_number then sort_order', () => {
    createEvent({ book_id: 1, title: 'A', chapter_number: 5, sort_order: 1 })
    createEvent({ book_id: 1, title: 'B', chapter_number: 1, sort_order: 0 })
    createEvent({ book_id: 1, title: 'C', sort_order: 99 })
    createEvent({ book_id: 1, title: 'D', chapter_number: 5, sort_order: 0 })

    const list = listByBookId(1)
    expect(list.map((e) => e.title)).toEqual(['B', 'D', 'A', 'C'])
  })

  it('updates partial fields and bumps updated_at', async () => {
    const created = createEvent({ book_id: 1, title: 'Original' })
    const before = created.updated_at
    await new Promise((r) => setTimeout(r, 1100))
    updateEvent(created.id, { title: 'Renamed', importance: 'high' })
    const after = getById(created.id)
    expect(after?.title).toBe('Renamed')
    expect(after?.importance).toBe('high')
    expect(after?.updated_at).not.toBe(before)
  })

  it('deletes an event by id', () => {
    const created = createEvent({ book_id: 1, title: 'X' })
    deleteEvent(created.id)
    expect(getById(created.id)).toBeNull()
  })

  it('serializes related_character_ids and metadata as JSON', () => {
    const created = createEvent({
      book_id: 1,
      title: 'Multi',
      related_character_ids: [10, 20, 30],
      metadata: { foreshadowId: 7 }
    })
    expect(created.related_character_ids).toEqual([10, 20, 30])
    expect(created.metadata).toEqual({ foreshadowId: 7 })
    const reloaded = getById(created.id)
    expect(reloaded?.related_character_ids).toEqual([10, 20, 30])
    expect(reloaded?.metadata).toEqual({ foreshadowId: 7 })
  })
})

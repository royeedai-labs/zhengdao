import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import { runMigrations } from '../migrations'
import * as connection from '../connection'
import { getVolumesWithChapterMeta } from '../chapter-repo'

describe('chapter repository performance payloads', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(db)
    runMigrations(db)
    vi.spyOn(connection, 'getDb').mockReturnValue(db)
    db.prepare("INSERT INTO books (id, title, author) VALUES (1, 'demo', '')").run()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('returns sorted chapter metadata without content', () => {
    db.prepare("INSERT INTO volumes (id, book_id, title, sort_order) VALUES (10, 1, '第二卷', 2)").run()
    db.prepare("INSERT INTO volumes (id, book_id, title, sort_order) VALUES (11, 1, '第一卷', 1)").run()
    db.prepare(
      `INSERT INTO chapters (id, volume_id, title, content, word_count, summary, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(1, 10, '第二卷第一章', '<p>hidden</p>', 6, 'summary-b', 0)
    db.prepare(
      `INSERT INTO chapters (id, volume_id, title, content, word_count, summary, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(2, 11, '第一卷第一章', '<p>hidden</p>', 5, 'summary-a', 0)

    const volumes = getVolumesWithChapterMeta(1) as Array<{
      title: string
      chapters: Array<Record<string, unknown>>
    }>

    expect(volumes.map((volume) => volume.title)).toEqual(['第一卷', '第二卷'])
    expect(volumes[0].chapters[0]).toMatchObject({
      id: 2,
      title: '第一卷第一章',
      word_count: 5,
      summary: 'summary-a'
    })
    expect(volumes[0].chapters[0]).not.toHaveProperty('content')
  })

  it('keeps a 1000 chapter outline as metadata-only payload', () => {
    db.prepare("INSERT INTO volumes (id, book_id, title, sort_order) VALUES (1, 1, '长篇卷', 0)").run()
    const insert = db.prepare(
      `INSERT INTO chapters (volume_id, title, content, word_count, sort_order)
       VALUES (1, ?, ?, ?, ?)`
    )
    const body = '<p>'.concat('正文'.repeat(1000), '</p>')
    const tx = db.transaction(() => {
      for (let index = 0; index < 1000; index += 1) {
        insert.run(`第 ${index + 1} 章`, body, 2000, index)
      }
    })
    tx()

    const started = performance.now()
    const volumes = getVolumesWithChapterMeta(1) as Array<{ chapters: Array<Record<string, unknown>> }>
    const elapsed = performance.now() - started
    const payload = JSON.stringify(volumes)

    expect(volumes[0].chapters).toHaveLength(1000)
    expect(payload).not.toContain('正文正文正文')
    expect(payload).not.toContain('"content"')
    expect(elapsed).toBeLessThan(100)
  })
})

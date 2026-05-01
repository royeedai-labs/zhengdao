import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../../database/schema'
import { runMigrations } from '../../database/migrations'

const state = vi.hoisted(() => ({
  db: null as Database.Database | null
}))

vi.mock('../../database/connection', () => ({
  getDb: () => {
    if (!state.db) throw new Error('test db not initialized')
    return state.db
  }
}))

import {
  computeBookPayloadHash,
  exportBookPackageV2,
  importBookPackageV2
} from '../book-package'

describe('desktop book package v2', () => {
  beforeEach(() => {
    state.db = new BetterSqlite3(':memory:') as Database.Database
    state.db.pragma('foreign_keys = ON')
    createSchema(state.db)
    runMigrations(state.db)
    seedBook(state.db)
  })

  afterEach(() => {
    state.db?.close()
    state.db = null
  })

  it('exports a full work package without credentials or local paths', () => {
    const payload = exportBookPackageV2(1)

    expect(payload.export_version).toBe(2)
    expect(payload.project_config?.ai_api_key).toBe('')
    expect(payload.ai_work_profiles[0]?.default_account_id).toBeNull()
    expect(payload.visual_assets[0]?.local_path).toBe('')
    expect(JSON.stringify(payload)).not.toContain('secret-key')
    expect(JSON.stringify(payload)).not.toContain('/Users/dai/private')
  })

  it('hashes stable work content without exported_at churn', () => {
    const payload = exportBookPackageV2(1)
    const changedExportTime = { ...payload, exported_at: '2099-01-01T00:00:00.000Z' }

    expect(computeBookPayloadHash(payload)).toBe(computeBookPayloadHash(changedExportTime))
  })

  it('imports a cloud conflict copy after detaching the local cloud link', () => {
    state.db!
      .prepare(
        `UPDATE books
         SET cloud_book_id = 'cloud-1',
             cloud_sync_version = 2,
             cloud_payload_hash = 'local-hash',
             cloud_sync_status = 'synced'
         WHERE id = 1`
      )
      .run()
    const payload = exportBookPackageV2(1)
    payload.book.title = '云端书'
    payload.chapters[0].content = '<p>云端正文</p>'

    const result = importBookPackageV2(payload, {
      titleSuffix: '（云端冲突副本）',
      detachCloudLinkFromBookId: 1,
      syncMetadata: {
        cloudBookId: 'cloud-1',
        cloudSyncVersion: 3,
        cloudPayloadHash: computeBookPayloadHash(payload),
        cloudUpdatedAt: '2026-05-02T00:00:00.000Z',
        cloudSyncStatus: 'synced'
      }
    })

    const localChapter = state.db!
      .prepare(
        `SELECT c.content
         FROM chapters c
         JOIN volumes v ON v.id = c.volume_id
         WHERE v.book_id = 1`
      )
      .get() as { content: string }
    const imported = state.db!.prepare('SELECT * FROM books WHERE id = ?').get(result.bookId) as {
      title: string
      cloud_book_id: string
      cloud_sync_status: string
    }
    const original = state.db!.prepare('SELECT * FROM books WHERE id = 1').get() as {
      cloud_book_id: string | null
      cloud_sync_status: string
    }

    expect(result.bookId).not.toBe(1)
    expect(localChapter.content).toBe('<p>本地正文</p>')
    expect(original.cloud_book_id).toBeNull()
    expect(original.cloud_sync_status).toBe('conflict')
    expect(imported.title).toBe('云端书（云端冲突副本）')
    expect(imported.cloud_book_id).toBe('cloud-1')
    expect(imported.cloud_sync_status).toBe('synced')
  })
})

function seedBook(db: Database.Database) {
  db.prepare("INSERT INTO books (id, title, author, cover_path) VALUES (1, '本地书', '作者', '/Users/dai/private/cover.png')").run()
  db.prepare(
    `INSERT INTO project_config (book_id, genre, character_fields, faction_labels, status_labels, emotion_labels, ai_api_key)
     VALUES (1, 'urban', '[]', '[]', '[]', '[]', 'secret-key')`
  ).run()
  db.prepare("INSERT INTO volumes (id, book_id, title, sort_order) VALUES (10, 1, '第一卷', 0)").run()
  db.prepare("INSERT INTO chapters (id, volume_id, title, content, word_count, sort_order) VALUES (20, 10, '第一章', '<p>本地正文</p>', 4, 0)").run()
  db.prepare("INSERT INTO characters (id, book_id, name) VALUES (30, 1, '主角')").run()
  db.prepare("INSERT INTO character_appearances (character_id, chapter_id) VALUES (30, 20)").run()
  db.prepare("INSERT INTO ai_accounts (id, name, credential_ref) VALUES (40, '全局账号', 'credential')").run()
  db.prepare("INSERT INTO ai_work_profiles (book_id, default_account_id, style_guide) VALUES (1, 40, '冷峻')").run()
  db.prepare(
    `INSERT INTO visual_assets (book_id, skill_id, remote_run_id, provider, url, local_path)
     VALUES (1, 'character_portrait', 'run-1', 'official', 'https://example.test/a.png', '/Users/dai/private/a.png')`
  ).run()
}

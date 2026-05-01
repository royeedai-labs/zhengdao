import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import { runMigrations } from '../migrations'

const state = vi.hoisted(() => ({
  db: null as Database.Database | null,
  userData: `/tmp/zhengdao-book-cover-${Math.random().toString(36).slice(2)}`
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

import { createBook, getBooks } from '../book-repo'

describe('book repository covers', () => {
  beforeEach(() => {
    rmSync(state.userData, { recursive: true, force: true })
    state.db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(state.db)
    runMigrations(state.db)
  })

  afterEach(() => {
    state.db?.close()
    state.db = null
    rmSync(state.userData, { recursive: true, force: true })
  })

  it('creates a local automatic cover for new books', () => {
    const book = createBook({ title: '青云志', author: '老笔', productGenre: 'webnovel' }) as {
      cover_path: string
      cover_url: string
    }

    expect(book.cover_path.endsWith('auto-cover.svg')).toBe(true)
    expect(existsSync(book.cover_path)).toBe(true)
    expect(book.cover_url).toMatch(/^zhengdao-cover:\/\/book\//)
  })

  it('copies uploaded raster covers into app data', () => {
    const sourceDir = join(state.userData, 'source')
    mkdirSync(sourceDir, { recursive: true })
    const sourcePath = join(sourceDir, 'cover.png')
    writeFileSync(sourcePath, 'png-bytes')

    const book = createBook({ title: '青云志', author: '', coverSourcePath: sourcePath }) as {
      cover_path: string
      cover_url: string
    }

    expect(book.cover_path).toContain('custom-cover-')
    expect(book.cover_path.endsWith('.png')).toBe(true)
    expect(existsSync(book.cover_path)).toBe(true)
    expect(book.cover_url).toMatch(/^zhengdao-cover:\/\/book\//)
  })

  it('does not inline or backfill cover bytes while listing books', () => {
    state.db!.prepare("INSERT INTO books (id, title, author, updated_at) VALUES (1, '旧书', '', '2026-01-01 00:00:00')").run()

    const books = getBooks() as Array<{ id: number; cover_path: string | null; cover_url: string | null; updated_at: string }>

    expect(books[0].id).toBe(1)
    expect(books[0].cover_path).toBeNull()
    expect(books[0].cover_url).toBeNull()
    expect(JSON.stringify(books)).not.toContain('data:image')
    expect(books[0].updated_at).toBe('2026-01-01 00:00:00')
  })
})

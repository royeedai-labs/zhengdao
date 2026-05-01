import { getDb } from './connection'
import { saveConfig } from './config-repo'
import type { Genre } from '../../shared/genre'
import {
  type BookCoverBook,
  generateAutoCoverForBook,
  mapBookCoverUrl,
  removeBookCoverDirectory,
  setBookCoverFromFile
} from '../book-cover-service'

export interface BookSyncMetadata {
  cloudBookId: string
  cloudSyncVersion: number
  cloudPayloadHash: string
  cloudUpdatedAt: string | null
  cloudSyncStatus?: 'idle' | 'synced' | 'pending' | 'conflict' | 'error' | 'archived'
  archivedAt?: string | null
}

export function getBooks(options: { includeArchived?: boolean } = {}) {
  const db = getDb()
  const archivedFilter = options.includeArchived ? '' : 'WHERE b.archived_at IS NULL'
  const books = db.prepare(`
    SELECT b.*, COALESCE(SUM(c.word_count), 0) as total_words
    FROM books b
    LEFT JOIN volumes v ON v.book_id = b.id AND v.deleted_at IS NULL
    LEFT JOIN chapters c ON c.volume_id = v.id AND c.deleted_at IS NULL
    ${archivedFilter}
    GROUP BY b.id
    ORDER BY b.updated_at DESC
  `).all()
  return books.map((book) => mapBookCoverUrl(book as any))
}

export function getBookById(id: number): Record<string, any> | null {
  const row = getDb().prepare('SELECT * FROM books WHERE id = ?').get(id) as Record<string, any> | undefined
  return row ? mapBookCoverUrl(row as BookCoverBook) : null
}

export function getBookByCloudId(cloudBookId: string): Record<string, any> | null {
  const row = getDb().prepare('SELECT * FROM books WHERE cloud_book_id = ?').get(cloudBookId) as
    | Record<string, any>
    | undefined
  return row ? mapBookCoverUrl(row as BookCoverBook) : null
}

export function createBook(data: { title: string; author: string; productGenre?: Genre; coverSourcePath?: string }) {
  const db = getDb()
  const result = db.prepare('INSERT INTO books (title, author) VALUES (?, ?)').run(data.title, data.author)
  const bookId = result.lastInsertRowid as number

  saveConfig(bookId, {
    genre: 'urban',
    character_fields: [],
    faction_labels: [],
    status_labels: [],
    emotion_labels: [],
    daily_goal: 6000,
    daily_goal_mode: 'follow_system',
    sensitive_list: 'default'
  })

  if (data.coverSourcePath) {
    setBookCoverFromFile(bookId, data.coverSourcePath)
  } else {
    generateAutoCoverForBook(bookId, {
      title: data.title,
      author: data.author,
      genre: data.productGenre
    })
  }

  return mapBookCoverUrl(db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as any)
}

export function deleteBook(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM books WHERE id = ?').run(id)
  removeBookCoverDirectory(id)
}

export function archiveBookLocal(id: number, status: BookSyncMetadata['cloudSyncStatus'] = 'archived') {
  getDb()
    .prepare(
      `UPDATE books
       SET archived_at = COALESCE(archived_at, datetime('now','localtime')),
           cloud_sync_status = ?,
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    )
    .run(status, id)
}

export function restoreArchivedBook(id: number) {
  getDb()
    .prepare(
      `UPDATE books
       SET archived_at = NULL,
           cloud_sync_status = 'synced',
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    )
    .run(id)
}

export function markBookCloudSync(id: number, metadata: BookSyncMetadata) {
  getDb()
    .prepare(
      `UPDATE books
       SET cloud_book_id = ?,
           cloud_sync_version = ?,
           cloud_payload_hash = ?,
           cloud_updated_at = ?,
           cloud_sync_status = ?,
           archived_at = ?,
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    )
    .run(
      metadata.cloudBookId,
      metadata.cloudSyncVersion,
      metadata.cloudPayloadHash,
      metadata.cloudUpdatedAt,
      metadata.cloudSyncStatus ?? 'synced',
      metadata.archivedAt ?? null,
      id
    )
}

export function markBookSyncStatus(id: number, status: BookSyncMetadata['cloudSyncStatus']) {
  getDb().prepare('UPDATE books SET cloud_sync_status = ? WHERE id = ?').run(status, id)
}

export function clearBookCloudSync(id: number) {
  getDb()
    .prepare(
      `UPDATE books
       SET cloud_book_id = NULL,
           cloud_sync_version = 0,
           cloud_payload_hash = '',
           cloud_updated_at = NULL,
           cloud_sync_status = 'pending'
       WHERE id = ?`
    )
    .run(id)
}

export function getBookStats(bookId: number) {
  const db = getDb()
  const stats = db.prepare(`
    SELECT COALESCE(SUM(c.word_count), 0) as total_words,
           COUNT(DISTINCT c.id) as total_chapters,
           COUNT(DISTINCT ch.id) as total_characters
    FROM books b
    LEFT JOIN volumes v ON v.book_id = b.id AND v.deleted_at IS NULL
    LEFT JOIN chapters c ON c.volume_id = v.id AND c.deleted_at IS NULL
    LEFT JOIN characters ch ON ch.book_id = b.id AND ch.deleted_at IS NULL
    WHERE b.id = ?
  `).get(bookId)
  return stats
}

import { getDb } from './connection'
import { saveConfig } from './config-repo'
import type { Genre } from '../../shared/genre'
import {
  generateAutoCoverForBook,
  mapBookCoverUrl,
  removeBookCoverDirectory,
  setBookCoverFromFile
} from '../book-cover-service'

export function getBooks() {
  const db = getDb()
  const books = db.prepare(`
    SELECT b.*, COALESCE(SUM(c.word_count), 0) as total_words
    FROM books b
    LEFT JOIN volumes v ON v.book_id = b.id AND v.deleted_at IS NULL
    LEFT JOIN chapters c ON c.volume_id = v.id AND c.deleted_at IS NULL
    GROUP BY b.id
    ORDER BY b.updated_at DESC
  `).all()
  return books.map((book) => mapBookCoverUrl(book as any))
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

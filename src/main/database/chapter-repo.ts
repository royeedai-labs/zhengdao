import { getDb } from './connection'

export function getVolumes(bookId: number) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM volumes WHERE book_id = ? AND deleted_at IS NULL ORDER BY sort_order')
    .all(bookId)
}

export function createVolume(data: { book_id: number; title: string }) {
  const db = getDb()
  const maxOrder = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM volumes WHERE book_id = ? AND deleted_at IS NULL'
    )
    .get(data.book_id) as { max_order: number }
  const result = db
    .prepare('INSERT INTO volumes (book_id, title, sort_order) VALUES (?, ?, ?)')
    .run(data.book_id, data.title, maxOrder.max_order + 1)
  return db.prepare('SELECT * FROM volumes WHERE id = ?').get(result.lastInsertRowid)
}

export function updateVolume(id: number, title: string) {
  const db = getDb()
  db.prepare('UPDATE volumes SET title = ? WHERE id = ?').run(title, id)
}

export function deleteVolume(id: number) {
  const db = getDb()
  db.prepare(`UPDATE volumes SET deleted_at = datetime('now','localtime') WHERE id = ?`).run(id)
}

export function restoreVolume(id: number) {
  const db = getDb()
  db.prepare('UPDATE volumes SET deleted_at = NULL WHERE id = ?').run(id)
}

export function permanentlyDeleteVolume(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM volumes WHERE id = ?').run(id)
}

export function getChapters(volumeId: number) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM chapters WHERE volume_id = ? AND deleted_at IS NULL ORDER BY sort_order')
    .all(volumeId)
}

export function getVolumesWithChapters(bookId: number) {
  const db = getDb()
  const volumes: any[] = db
    .prepare('SELECT * FROM volumes WHERE book_id = ? AND deleted_at IS NULL ORDER BY sort_order')
    .all(bookId)
  const allChapters: any[] = db
    .prepare(
      `
    SELECT c.* FROM chapters c
    JOIN volumes v ON v.id = c.volume_id
    WHERE v.book_id = ? AND c.deleted_at IS NULL AND v.deleted_at IS NULL
    ORDER BY v.sort_order, c.sort_order
  `
    )
    .all(bookId)

  const chaptersByVolume = new Map<number, any[]>()
  for (const ch of allChapters) {
    const list = chaptersByVolume.get(ch.volume_id) || []
    list.push(ch)
    chaptersByVolume.set(ch.volume_id, list)
  }
  for (const vol of volumes) {
    vol.chapters = chaptersByVolume.get(vol.id) || []
  }
  return volumes
}

export function getVolumesWithChapterMeta(bookId: number) {
  const db = getDb()
  const volumes: any[] = db
    .prepare('SELECT * FROM volumes WHERE book_id = ? AND deleted_at IS NULL ORDER BY sort_order')
    .all(bookId)
  const allChapters: any[] = db
    .prepare(
      `
    SELECT
      c.id,
      c.volume_id,
      c.title,
      c.word_count,
      c.summary,
      c.sort_order,
      c.created_at,
      c.updated_at
    FROM chapters c
    JOIN volumes v ON v.id = c.volume_id
    WHERE v.book_id = ? AND c.deleted_at IS NULL AND v.deleted_at IS NULL
    ORDER BY v.sort_order, c.sort_order
  `
    )
    .all(bookId)

  const chaptersByVolume = new Map<number, any[]>()
  for (const ch of allChapters) {
    const list = chaptersByVolume.get(ch.volume_id) || []
    list.push(ch)
    chaptersByVolume.set(ch.volume_id, list)
  }
  for (const vol of volumes) {
    vol.chapters = chaptersByVolume.get(vol.id) || []
  }
  return volumes
}

export function getChapter(id: number) {
  const db = getDb()
  return db.prepare('SELECT * FROM chapters WHERE id = ? AND deleted_at IS NULL').get(id)
}

function countWordsFromHtml(html: string): number {
  const stripped = html.replace(/<[^>]*>/g, '').replace(/\s/g, '')
  return stripped.length
}

export function createChapter(data: { volume_id: number; title: string; content?: string; summary?: string }) {
  const db = getDb()
  const maxOrder = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM chapters WHERE volume_id = ? AND deleted_at IS NULL'
    )
    .get(data.volume_id) as { max_order: number }
  const content = data.content ?? ''
  const summary = data.summary?.trim() ?? ''
  const wordCount = countWordsFromHtml(content)
  const result = db
    .prepare(
      'INSERT INTO chapters (volume_id, title, content, word_count, summary, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(data.volume_id, data.title, content, wordCount, summary, maxOrder.max_order + 1)
  return db.prepare('SELECT * FROM chapters WHERE id = ?').get(result.lastInsertRowid)
}

export function updateChapter(id: number, data: Record<string, unknown>) {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(data)) {
    if (['content', 'word_count', 'title'].includes(key)) {
      fields.push(`${key} = ?`)
      values.push(val)
    }
  }
  if (fields.length === 0) return
  fields.push("updated_at = datetime('now','localtime')")
  values.push(id)
  db.prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  db.prepare(`
    UPDATE books SET updated_at = datetime('now','localtime')
    WHERE id = (
      SELECT v.book_id FROM chapters c
      JOIN volumes v ON v.id = c.volume_id
      WHERE c.id = ?
    )
  `).run(id)
}

export function updateChapterTitle(id: number, title: string) {
  const db = getDb()
  db.prepare("UPDATE chapters SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(title, id)
}

export function updateChapterSummary(id: number, summary: string) {
  const db = getDb()
  db.prepare("UPDATE chapters SET summary = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(summary, id)
  db.prepare(`
    UPDATE books SET updated_at = datetime('now','localtime')
    WHERE id = (
      SELECT v.book_id FROM chapters c
      JOIN volumes v ON v.id = c.volume_id
      WHERE c.id = ?
    )
  `).run(id)
}

export function deleteChapter(id: number) {
  const db = getDb()
  db.prepare(`UPDATE chapters SET deleted_at = datetime('now','localtime') WHERE id = ?`).run(id)
}

export function restoreChapter(id: number) {
  const db = getDb()
  db.prepare('UPDATE chapters SET deleted_at = NULL WHERE id = ?').run(id)
}

export function permanentlyDeleteChapter(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM chapters WHERE id = ?').run(id)
}

export function getAllChaptersForBook(bookId: number) {
  const db = getDb()
  return db
    .prepare(
      `
    SELECT c.*, v.title as volume_title
    FROM chapters c
    JOIN volumes v ON v.id = c.volume_id
    WHERE v.book_id = ? AND c.deleted_at IS NULL AND v.deleted_at IS NULL
    ORDER BY v.sort_order, c.sort_order
  `
    )
    .all(bookId)
}

export function reorderChapters(volumeId: number, chapterIds: number[]) {
  const db = getDb()
  const stmt = db.prepare('UPDATE chapters SET sort_order = ? WHERE id = ?')
  for (let idx = 0; idx < chapterIds.length; idx++) {
    stmt.run(idx, chapterIds[idx])
  }
}

export function reorderVolumes(bookId: number, volumeIds: number[]) {
  const db = getDb()
  const stmt = db.prepare('UPDATE volumes SET sort_order = ? WHERE id = ?')
  for (let idx = 0; idx < volumeIds.length; idx++) {
    stmt.run(idx, volumeIds[idx])
  }
}

export function moveChapter(chapterId: number, targetVolumeId: number) {
  const db = getDb()
  const maxOrder = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM chapters WHERE volume_id = ? AND deleted_at IS NULL'
    )
    .get(targetVolumeId) as { max_order: number }
  db.prepare('UPDATE chapters SET volume_id = ?, sort_order = ? WHERE id = ?').run(
    targetVolumeId,
    maxOrder.max_order + 1,
    chapterId
  )
}

export function getRecentChaptersForBook(bookId: number, limit: number) {
  const db = getDb()
  return db
    .prepare(
      `
    SELECT c.* FROM chapters c
    JOIN volumes v ON v.id = c.volume_id AND v.deleted_at IS NULL
    WHERE v.book_id = ? AND c.deleted_at IS NULL
    ORDER BY c.updated_at DESC
    LIMIT ?
  `
    )
    .all(bookId, limit) as Record<string, unknown>[]
}

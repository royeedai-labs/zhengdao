import { getDb } from './connection'
import { normalizeRelationType } from '../../shared/relation-types'

export function getRelations(bookId: number) {
  const db = getDb()
  return db.prepare('SELECT * FROM character_relations WHERE book_id = ? ORDER BY id').all(bookId)
}

export function createRelation(
  bookId: number,
  sourceId: number,
  targetId: number,
  relationType: string,
  label: string
) {
  const db = getDb()
  if (sourceId === targetId) throw new Error('invalid_relation')
  const rows = db
    .prepare(
      'SELECT id FROM characters WHERE book_id = ? AND id IN (?, ?) AND deleted_at IS NULL'
    )
    .all(bookId, sourceId, targetId) as { id: number }[]
  if (rows.length !== 2) throw new Error('invalid_characters')
  const result = db
    .prepare(
      `
    INSERT INTO character_relations (book_id, source_id, target_id, relation_type, label)
    VALUES (?, ?, ?, ?, ?)
  `
    )
    .run(bookId, sourceId, targetId, normalizeRelationType(relationType), label ?? '')
  return db.prepare('SELECT * FROM character_relations WHERE id = ?').get(result.lastInsertRowid)
}

export function updateRelation(id: number, relationType: string, label: string) {
  const db = getDb()
  db.prepare('UPDATE character_relations SET relation_type = ?, label = ? WHERE id = ?').run(
    normalizeRelationType(relationType),
    label ?? '',
    id
  )
}

export function deleteRelation(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM character_relations WHERE id = ?').run(id)
}

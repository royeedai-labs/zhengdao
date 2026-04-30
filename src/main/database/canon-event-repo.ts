import { getDb } from './connection'

/**
 * DI-07 v3.2 — canon_events repo.
 *
 * Events are finer-grained timeline nodes than plot_nodes (plot is 卷-级
 * 大节点；events 是章节级时间轴 / 伏笔触发点 / 角色关键节点)。CG-A3
 * timeline view 直接消费 listByBookId 输出。
 */

export type CanonEventType = 'plot' | 'character' | 'world' | 'foreshadow'
export type CanonEventImportance = 'low' | 'normal' | 'high'

export interface CanonEvent {
  id: number
  book_id: number
  title: string
  description: string
  chapter_id: number | null
  chapter_number: number | null
  event_type: CanonEventType
  importance: CanonEventImportance
  related_character_ids: number[]
  metadata: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CanonEventInput {
  book_id: number
  title: string
  description?: string
  chapter_id?: number | null
  chapter_number?: number | null
  event_type?: CanonEventType
  importance?: CanonEventImportance
  related_character_ids?: number[]
  metadata?: Record<string, unknown>
  sort_order?: number
}

export interface CanonEventPatch {
  title?: string
  description?: string
  chapter_id?: number | null
  chapter_number?: number | null
  event_type?: CanonEventType
  importance?: CanonEventImportance
  related_character_ids?: number[]
  metadata?: Record<string, unknown>
  sort_order?: number
}

interface CanonEventRow {
  id: number
  book_id: number
  title: string
  description: string
  chapter_id: number | null
  chapter_number: number | null
  event_type: string
  importance: string
  related_character_ids: string
  metadata: string
  sort_order: number
  created_at: string
  updated_at: string
}

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function rowToEvent(row: CanonEventRow): CanonEvent {
  return {
    id: row.id,
    book_id: row.book_id,
    title: row.title,
    description: row.description ?? '',
    chapter_id: row.chapter_id,
    chapter_number: row.chapter_number,
    event_type: (row.event_type as CanonEventType) ?? 'plot',
    importance: (row.importance as CanonEventImportance) ?? 'normal',
    related_character_ids: safeParseJson<number[]>(row.related_character_ids, []),
    metadata: safeParseJson<Record<string, unknown>>(row.metadata, {}),
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function listByBookId(bookId: number): CanonEvent[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM canon_events WHERE book_id = ?
       ORDER BY chapter_number IS NULL, chapter_number ASC, sort_order ASC, id ASC`
    )
    .all(bookId) as CanonEventRow[]
  return rows.map(rowToEvent)
}

export function getById(id: number): CanonEvent | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM canon_events WHERE id = ?').get(id) as
    | CanonEventRow
    | undefined
  return row ? rowToEvent(row) : null
}

export function createEvent(input: CanonEventInput): CanonEvent {
  if (!input.book_id || !input.title || !input.title.trim()) {
    throw new Error('invalid_event_input')
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO canon_events
         (book_id, title, description, chapter_id, chapter_number, event_type,
          importance, related_character_ids, metadata, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.book_id,
      input.title.trim(),
      input.description ?? '',
      input.chapter_id ?? null,
      input.chapter_number ?? null,
      input.event_type ?? 'plot',
      input.importance ?? 'normal',
      JSON.stringify(input.related_character_ids ?? []),
      JSON.stringify(input.metadata ?? {}),
      input.sort_order ?? 0
    )
  const created = getById(Number(result.lastInsertRowid))
  if (!created) throw new Error('event_create_failed')
  return created
}

export function updateEvent(id: number, patch: CanonEventPatch): void {
  if (Object.keys(patch).length === 0) return
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []
  if (patch.title !== undefined) {
    fields.push('title = ?')
    values.push(patch.title.trim())
  }
  if (patch.description !== undefined) {
    fields.push('description = ?')
    values.push(patch.description)
  }
  if (patch.chapter_id !== undefined) {
    fields.push('chapter_id = ?')
    values.push(patch.chapter_id)
  }
  if (patch.chapter_number !== undefined) {
    fields.push('chapter_number = ?')
    values.push(patch.chapter_number)
  }
  if (patch.event_type !== undefined) {
    fields.push('event_type = ?')
    values.push(patch.event_type)
  }
  if (patch.importance !== undefined) {
    fields.push('importance = ?')
    values.push(patch.importance)
  }
  if (patch.related_character_ids !== undefined) {
    fields.push('related_character_ids = ?')
    values.push(JSON.stringify(patch.related_character_ids))
  }
  if (patch.metadata !== undefined) {
    fields.push('metadata = ?')
    values.push(JSON.stringify(patch.metadata))
  }
  if (patch.sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(patch.sort_order)
  }
  if (fields.length === 0) return
  fields.push("updated_at = datetime('now','localtime')")
  values.push(id)
  db.prepare(`UPDATE canon_events SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteEvent(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM canon_events WHERE id = ?').run(id)
}

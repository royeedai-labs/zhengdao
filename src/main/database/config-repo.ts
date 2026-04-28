import { getDb } from './connection'

function safeJsonParse(value: unknown, fallback: unknown[] = []): unknown {
  if (typeof value !== 'string' || !value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function getConfig(bookId: number) {
  const db = getDb()
  const row: any = db.prepare('SELECT * FROM project_config WHERE book_id = ?').get(bookId)
  if (!row) return null
  return {
    ...row,
    character_fields: safeJsonParse(row.character_fields),
    faction_labels: safeJsonParse(row.faction_labels),
    status_labels: safeJsonParse(row.status_labels),
    emotion_labels: safeJsonParse(row.emotion_labels)
  }
}

export function saveConfig(bookId: number, config: Record<string, unknown>) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM project_config WHERE book_id = ?').get(bookId)
  const charFields = JSON.stringify(config.character_fields || [])
  const factionLabels = JSON.stringify(config.faction_labels || [])
  const statusLabels = JSON.stringify(config.status_labels || [])
  const emotionLabels = JSON.stringify(config.emotion_labels || [])

  if (existing) {
    db.prepare(`
      UPDATE project_config SET genre = ?, character_fields = ?, faction_labels = ?,
        status_labels = ?, emotion_labels = ?, daily_goal = ?, daily_goal_mode = ?, sensitive_list = ?,
        editor_font = ?, editor_font_size = ?, editor_line_height = ?, editor_width = ?
      WHERE book_id = ?
    `).run(
      config.genre || 'urban', charFields, factionLabels, statusLabels, emotionLabels,
      config.daily_goal || 6000, config.daily_goal_mode || 'follow_system', config.sensitive_list || 'default',
      config.editor_font ?? 'serif',
      config.editor_font_size ?? 19,
      config.editor_line_height ?? 2.2,
      config.editor_width ?? 'standard',
      bookId
    )
  } else {
    db.prepare(`
      INSERT INTO project_config (book_id, genre, character_fields, faction_labels,
        status_labels, emotion_labels, daily_goal, daily_goal_mode, sensitive_list,
        editor_font, editor_font_size, editor_line_height, editor_width)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookId, config.genre || 'urban', charFields, factionLabels, statusLabels, emotionLabels,
      config.daily_goal || 6000, config.daily_goal_mode || 'follow_system', config.sensitive_list || 'default',
      config.editor_font ?? 'serif',
      config.editor_font_size ?? 19,
      config.editor_line_height ?? 2.2,
      config.editor_width ?? 'standard'
    )
  }
}

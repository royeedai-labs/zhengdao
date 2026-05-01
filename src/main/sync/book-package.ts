import { createHash } from 'crypto'
import { isAbsolute } from 'path'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'

export const DESKTOP_BOOK_PACKAGE_VERSION = 2

type Row = Record<string, any>

export interface DesktopBookPackageV2 {
  export_version: 2
  exported_at: string
  book: Row
  project_config: Row | null
  volumes: Row[]
  chapters: Row[]
  characters: Row[]
  character_appearances: Row[]
  character_relations: Row[]
  character_milestones: Row[]
  plotlines: Row[]
  plot_nodes: Row[]
  plot_node_characters: Row[]
  foreshadowings: Row[]
  settings_wiki: Row[]
  notes: Row[]
  citations: Row[]
  snapshots: Row[]
  daily_stats: Row[]
  writing_sessions: Row[]
  achievements: Row[]
  chapter_templates: Row[]
  ai_work_profiles: Row[]
  ai_skill_overrides: Row[]
  ai_conversations: Row[]
  ai_messages: Row[]
  ai_drafts: Row[]
  canon_events: Row[]
  canon_organizations: Row[]
  canon_character_organizations: Row[]
  director_run_links: Row[]
  director_run_chapter_cache: Row[]
  ai_story_fact_proposals: Row[]
  ai_story_bible_snapshots: Row[]
  visual_assets: Row[]
}

export interface ImportedBookResult {
  bookId: number
  title: string
  payloadHash: string
}

export interface ImportBookPackageOptions {
  targetBookId?: number
  titleSuffix?: string
  detachCloudLinkFromBookId?: number
  syncMetadata?: {
    cloudBookId: string
    cloudSyncVersion: number
    cloudPayloadHash: string
    cloudUpdatedAt: string | null
    cloudSyncStatus?: string
    archivedAt?: string | null
  }
}

export function exportBookPackageV2(bookId: number): DesktopBookPackageV2 {
  const db = getDb()
  const book = selectOne(db, 'books', 'id = ?', [bookId])
  if (!book) throw new Error(`Book ${bookId} not found`)

  const volumes = selectRows(db, 'volumes', 'book_id = ?', [bookId])
  const volumeIds = ids(volumes)
  const chapters = selectRowsIn(db, 'chapters', 'volume_id', volumeIds)
  const chapterIds = ids(chapters)
  const characters = selectRows(db, 'characters', 'book_id = ?', [bookId])
  const characterIds = ids(characters)
  const plotlines = selectRows(db, 'plotlines', 'book_id = ?', [bookId])
  const plotNodes = selectRows(db, 'plot_nodes', 'book_id = ?', [bookId])
  const plotNodeIds = ids(plotNodes)
  const conversations = selectRows(db, 'ai_conversations', 'book_id = ?', [bookId])
  const conversationIds = ids(conversations)
  const directorRuns = selectRows(db, 'director_run_links', 'book_id = ?', [bookId])
  const directorRunIds = ids(directorRuns)
  const canonOrganizations = selectRows(db, 'canon_organizations', 'book_id = ?', [bookId])
  const canonOrganizationIds = ids(canonOrganizations)

  const projectConfig = selectOne(db, 'project_config', 'book_id = ?', [bookId])
  if (projectConfig) projectConfig.ai_api_key = ''

  return {
    export_version: DESKTOP_BOOK_PACKAGE_VERSION,
    exported_at: new Date().toISOString(),
    book: sanitizeBookRow(book),
    project_config: projectConfig,
    volumes,
    chapters,
    characters,
    character_appearances: selectRowsByAnyIn(db, 'character_appearances', [
      ['character_id', characterIds],
      ['chapter_id', chapterIds]
    ]),
    character_relations: selectRows(db, 'character_relations', 'book_id = ?', [bookId]),
    character_milestones: selectRowsIn(db, 'character_milestones', 'character_id', characterIds),
    plotlines,
    plot_nodes: plotNodes,
    plot_node_characters: selectRowsIn(db, 'plot_node_characters', 'plot_node_id', plotNodeIds),
    foreshadowings: selectRows(db, 'foreshadowings', 'book_id = ?', [bookId]),
    settings_wiki: selectRows(db, 'settings_wiki', 'book_id = ?', [bookId]),
    notes: selectRows(db, 'notes', 'book_id = ?', [bookId]),
    citations: selectRows(db, 'citations', 'book_id = ?', [bookId]),
    snapshots: selectRowsIn(db, 'snapshots', 'chapter_id', chapterIds),
    daily_stats: selectRows(db, 'daily_stats', 'book_id = ?', [bookId]),
    writing_sessions: selectRows(db, 'writing_sessions', 'book_id = ?', [bookId]),
    achievements: selectRows(db, 'achievements', 'book_id = ?', [bookId]),
    chapter_templates: selectRows(db, 'chapter_templates', 'book_id = ?', [bookId]),
    ai_work_profiles: selectRows(db, 'ai_work_profiles', 'book_id = ?', [bookId]).map((row) => ({
      ...row,
      default_account_id: null
    })),
    ai_skill_overrides: selectRows(db, 'ai_skill_overrides', 'book_id = ?', [bookId]),
    ai_conversations: conversations,
    ai_messages: selectRowsIn(db, 'ai_messages', 'conversation_id', conversationIds),
    ai_drafts: selectRows(db, 'ai_drafts', 'book_id = ?', [bookId]),
    canon_events: selectRows(db, 'canon_events', 'book_id = ?', [bookId]),
    canon_organizations: canonOrganizations,
    canon_character_organizations: selectRowsIn(
      db,
      'canon_character_organizations',
      'organization_id',
      canonOrganizationIds
    ),
    director_run_links: directorRuns,
    director_run_chapter_cache: selectRowsIn(
      db,
      'director_run_chapter_cache',
      'director_run_link_id',
      directorRunIds
    ),
    ai_story_fact_proposals: selectRows(db, 'ai_story_fact_proposals', 'book_id = ?', [bookId]),
    ai_story_bible_snapshots: selectRows(db, 'ai_story_bible_snapshots', 'book_id = ?', [bookId]),
    visual_assets: selectRows(db, 'visual_assets', 'book_id = ?', [bookId]).map((row) => ({
      ...row,
      local_path: ''
    }))
  }
}

export function computeBookPayloadHash(payload: unknown): string {
  return createHash('sha256').update(stableJson(normalizePayloadForHash(payload))).digest('hex')
}

export function importBookPackageV2(
  payload: unknown,
  options: ImportBookPackageOptions = {}
): ImportedBookResult {
  const pkg = assertPackage(payload)
  const db = getDb()
  return db.transaction(() => {
    if (
      options.detachCloudLinkFromBookId !== undefined &&
      options.detachCloudLinkFromBookId !== options.targetBookId
    ) {
      db.prepare(
        `UPDATE books
         SET cloud_book_id = NULL,
             cloud_sync_version = 0,
             cloud_payload_hash = '',
             cloud_updated_at = NULL,
             cloud_sync_status = 'conflict',
             updated_at = datetime('now','localtime')
         WHERE id = ?`
      ).run(options.detachCloudLinkFromBookId)
    }

    if (options.targetBookId !== undefined) {
      deleteRowsForReplace(db, options.targetBookId)
      db.prepare('DELETE FROM books WHERE id = ?').run(options.targetBookId)
    }

    const bookMap = new Map<number, number>()
    const volumeMap = new Map<number, number>()
    const chapterMap = new Map<number, number>()
    const characterMap = new Map<number, number>()
    const relationMap = new Map<number, number>()
    const plotlineMap = new Map<number, number>()
    const plotNodeMap = new Map<number, number>()
    const conversationMap = new Map<number, number>()
    const messageMap = new Map<number, number>()
    const canonOrgMap = new Map<number, number>()
    const directorRunMap = new Map<number, number>()

    const bookRow: Row = {
      ...sanitizeBookRow(pkg.book),
      title: `${String(pkg.book.title || '未命名作品')}${options.titleSuffix ?? ''}`,
      cloud_book_id: options.syncMetadata?.cloudBookId ?? null,
      cloud_sync_version: options.syncMetadata?.cloudSyncVersion ?? 0,
      cloud_payload_hash: options.syncMetadata?.cloudPayloadHash ?? '',
      cloud_updated_at: options.syncMetadata?.cloudUpdatedAt ?? null,
      cloud_sync_status: options.syncMetadata?.cloudSyncStatus ?? 'idle',
      archived_at: options.syncMetadata?.archivedAt ?? null
    }
    if (options.targetBookId !== undefined) bookRow.id = options.targetBookId
    const newBookId = insertRow(db, 'books', bookRow, {}, { omitId: options.targetBookId === undefined })
    bookMap.set(Number(pkg.book.id), newBookId)

    if (pkg.project_config) {
      insertRow(db, 'project_config', pkg.project_config, {
        book_id: newBookId,
        ai_api_key: ''
      })
    }

    for (const row of pkg.volumes) {
      volumeMap.set(Number(row.id), insertRow(db, 'volumes', row, { book_id: newBookId }))
    }
    for (const row of pkg.chapters) {
      chapterMap.set(Number(row.id), insertRow(db, 'chapters', row, { volume_id: mapped(volumeMap, row.volume_id) }))
    }
    for (const row of pkg.characters) {
      characterMap.set(Number(row.id), insertRow(db, 'characters', row, { book_id: newBookId }))
    }
    for (const row of pkg.character_appearances) {
      const characterId = mapped(characterMap, row.character_id)
      const chapterId = mapped(chapterMap, row.chapter_id)
      if (characterId && chapterId) insertRow(db, 'character_appearances', row, { character_id: characterId, chapter_id: chapterId })
    }
    for (const row of pkg.character_relations) {
      const sourceId = mapped(characterMap, row.source_id)
      const targetId = mapped(characterMap, row.target_id)
      if (sourceId && targetId) {
        relationMap.set(
          Number(row.id),
          insertRow(db, 'character_relations', row, {
            book_id: newBookId,
            source_id: sourceId,
            target_id: targetId
          })
        )
      }
    }
    for (const row of pkg.character_milestones) {
      const characterId = mapped(characterMap, row.character_id)
      if (characterId) insertRow(db, 'character_milestones', row, { character_id: characterId })
    }

    for (const row of pkg.plotlines) {
      plotlineMap.set(Number(row.id), insertRow(db, 'plotlines', row, { book_id: newBookId }))
    }
    for (const row of pkg.plot_nodes) {
      plotNodeMap.set(
        Number(row.id),
        insertRow(db, 'plot_nodes', row, {
          book_id: newBookId,
          plotline_id: nullableMapped(plotlineMap, row.plotline_id)
        })
      )
    }
    for (const row of pkg.plot_node_characters) {
      const plotNodeId = mapped(plotNodeMap, row.plot_node_id)
      const characterId = mapped(characterMap, row.character_id)
      if (plotNodeId && characterId) insertRow(db, 'plot_node_characters', row, { plot_node_id: plotNodeId, character_id: characterId })
    }

    for (const row of pkg.foreshadowings) {
      insertRow(db, 'foreshadowings', row, {
        book_id: newBookId,
        chapter_id: nullableMapped(chapterMap, row.chapter_id)
      })
    }
    insertBookRows(db, 'settings_wiki', pkg.settings_wiki, newBookId)
    insertBookRows(db, 'notes', pkg.notes, newBookId)
    insertBookRows(db, 'citations', pkg.citations, newBookId)
    for (const row of pkg.snapshots) {
      const chapterId = mapped(chapterMap, row.chapter_id)
      if (chapterId) insertRow(db, 'snapshots', row, { chapter_id: chapterId })
    }
    insertBookRows(db, 'daily_stats', pkg.daily_stats, newBookId)
    insertBookRows(db, 'writing_sessions', pkg.writing_sessions, newBookId)
    insertBookRows(db, 'achievements', pkg.achievements, newBookId)
    insertBookRows(db, 'chapter_templates', pkg.chapter_templates, newBookId)

    for (const row of pkg.ai_work_profiles) {
      insertRow(db, 'ai_work_profiles', row, { book_id: newBookId, default_account_id: null })
    }
    insertBookRows(db, 'ai_skill_overrides', pkg.ai_skill_overrides, newBookId)
    for (const row of pkg.ai_conversations) {
      conversationMap.set(Number(row.id), insertRow(db, 'ai_conversations', row, { book_id: newBookId }))
    }
    for (const row of pkg.ai_messages) {
      const conversationId = mapped(conversationMap, row.conversation_id)
      if (conversationId) messageMap.set(Number(row.id), insertRow(db, 'ai_messages', row, { conversation_id: conversationId }))
    }
    for (const row of pkg.ai_drafts) {
      insertRow(db, 'ai_drafts', row, {
        book_id: newBookId,
        conversation_id: nullableMapped(conversationMap, row.conversation_id),
        message_id: nullableMapped(messageMap, row.message_id)
      })
    }

    for (const row of pkg.canon_events) {
      insertRow(db, 'canon_events', row, {
        book_id: newBookId,
        chapter_id: nullableMapped(chapterMap, row.chapter_id),
        related_character_ids: remapJsonIdArray(row.related_character_ids, characterMap)
      })
    }
    for (const row of pkg.canon_organizations) {
      canonOrgMap.set(Number(row.id), insertRow(db, 'canon_organizations', row, { book_id: newBookId, parent_id: null }))
    }
    for (const row of pkg.canon_organizations) {
      const newId = mapped(canonOrgMap, row.id)
      const parentId = nullableMapped(canonOrgMap, row.parent_id)
      if (newId && parentId) db.prepare('UPDATE canon_organizations SET parent_id = ? WHERE id = ?').run(parentId, newId)
    }
    for (const row of pkg.canon_character_organizations) {
      const characterId = mapped(characterMap, row.character_id)
      const organizationId = mapped(canonOrgMap, row.organization_id)
      if (characterId && organizationId) {
        insertRow(db, 'canon_character_organizations', row, {
          character_id: characterId,
          organization_id: organizationId
        })
      }
    }

    for (const row of pkg.director_run_links) {
      directorRunMap.set(Number(row.id), insertRow(db, 'director_run_links', row, { book_id: newBookId }))
    }
    for (const row of pkg.director_run_chapter_cache) {
      const runId = mapped(directorRunMap, row.director_run_link_id)
      if (runId) insertRow(db, 'director_run_chapter_cache', row, { director_run_link_id: runId })
    }
    insertBookRows(db, 'ai_story_fact_proposals', pkg.ai_story_fact_proposals, newBookId)
    insertBookRows(db, 'ai_story_bible_snapshots', pkg.ai_story_bible_snapshots, newBookId)
    insertBookRows(
      db,
      'visual_assets',
      pkg.visual_assets.map((row) => ({ ...row, local_path: '' })),
      newBookId
    )

    return {
      bookId: newBookId,
      title: String(bookRow.title),
      payloadHash: computeBookPayloadHash(exportBookPackageV2(newBookId))
    }
  })()
}

function insertBookRows(db: Database.Database, table: string, rows: Row[], bookId: number) {
  for (const row of rows) insertRow(db, table, row, { book_id: bookId })
}

function deleteRowsForReplace(db: Database.Database, bookId: number) {
  db.prepare('DELETE FROM chapter_templates WHERE book_id = ?').run(bookId)
}

function assertPackage(payload: unknown): DesktopBookPackageV2 {
  if (!payload || typeof payload !== 'object') throw new Error('invalid desktop book package')
  const pkg = payload as Partial<DesktopBookPackageV2>
  if (pkg.export_version !== DESKTOP_BOOK_PACKAGE_VERSION || !pkg.book) {
    throw new Error('unsupported desktop book package')
  }
  const arrayKeys: Array<keyof DesktopBookPackageV2> = [
    'volumes',
    'chapters',
    'characters',
    'character_appearances',
    'character_relations',
    'character_milestones',
    'plotlines',
    'plot_nodes',
    'plot_node_characters',
    'foreshadowings',
    'settings_wiki',
    'notes',
    'citations',
    'snapshots',
    'daily_stats',
    'writing_sessions',
    'achievements',
    'chapter_templates',
    'ai_work_profiles',
    'ai_skill_overrides',
    'ai_conversations',
    'ai_messages',
    'ai_drafts',
    'canon_events',
    'canon_organizations',
    'canon_character_organizations',
    'director_run_links',
    'director_run_chapter_cache',
    'ai_story_fact_proposals',
    'ai_story_bible_snapshots',
    'visual_assets'
  ]
  for (const key of arrayKeys) {
    if (!Array.isArray(pkg[key])) (pkg as Record<string, unknown>)[key] = []
  }
  return pkg as DesktopBookPackageV2
}

function sanitizeBookRow(row: Row): Row {
  const next = { ...row }
  delete next.cloud_book_id
  delete next.cloud_sync_version
  delete next.cloud_payload_hash
  delete next.cloud_updated_at
  delete next.cloud_sync_status
  delete next.archived_at
  if (typeof next.cover_path === 'string' && isAbsolute(next.cover_path)) next.cover_path = null
  return next
}

function normalizePayloadForHash(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
  delete clone.exported_at
  if (clone.book && typeof clone.book === 'object') {
    clone.book = sanitizeBookRow(clone.book as Row)
  }
  return clone
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
}

function selectOne(db: Database.Database, table: string, where: string, params: unknown[]): Row | null {
  return (db.prepare(`SELECT * FROM ${ident(table)} WHERE ${where}`).get(...params) as Row | undefined) ?? null
}

function selectRows(db: Database.Database, table: string, where: string, params: unknown[]): Row[] {
  return db.prepare(`SELECT * FROM ${ident(table)} WHERE ${where} ORDER BY id ASC`).all(...params) as Row[]
}

function selectRowsIn(db: Database.Database, table: string, column: string, values: number[]): Row[] {
  if (values.length === 0) return []
  const placeholders = values.map(() => '?').join(',')
  return db
    .prepare(`SELECT * FROM ${ident(table)} WHERE ${ident(column)} IN (${placeholders}) ORDER BY id ASC`)
    .all(...values) as Row[]
}

function selectRowsByAnyIn(
  db: Database.Database,
  table: string,
  groups: Array<[column: string, values: number[]]>
): Row[] {
  const parts: string[] = []
  const args: number[] = []
  for (const [column, values] of groups) {
    if (values.length === 0) continue
    parts.push(`${ident(column)} IN (${values.map(() => '?').join(',')})`)
    args.push(...values)
  }
  if (parts.length === 0) return []
  return db.prepare(`SELECT * FROM ${ident(table)} WHERE ${parts.join(' OR ')} ORDER BY id ASC`).all(...args) as Row[]
}

function insertRow(
  db: Database.Database,
  table: string,
  row: Row,
  overrides: Row = {},
  options: { omitId?: boolean } = { omitId: true }
): number {
  const merged: Row = { ...row, ...overrides }
  if (options.omitId !== false) delete merged.id
  const entries = Object.entries(merged).filter(([, value]) => value !== undefined)
  const columns = entries.map(([key]) => ident(key))
  const placeholders = entries.map(() => '?')
  const values = entries.map(([, value]) => value)
  const result = db
    .prepare(`INSERT INTO ${ident(table)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`)
    .run(...values)
  return Number(options.omitId === false && merged.id ? merged.id : result.lastInsertRowid)
}

function ids(rows: Row[]): number[] {
  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id))
}

function mapped(map: Map<number, number>, value: unknown): number {
  const next = nullableMapped(map, value)
  if (next === null) throw new Error('desktop book package reference missing')
  return next
}

function nullableMapped(map: Map<number, number>, value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  return map.get(Number(value)) ?? null
}

function remapJsonIdArray(value: unknown, map: Map<number, number>): string {
  let idsValue: unknown = value
  if (typeof value === 'string') {
    try {
      idsValue = JSON.parse(value)
    } catch {
      idsValue = []
    }
  }
  if (!Array.isArray(idsValue)) return '[]'
  return JSON.stringify(idsValue.map((id) => map.get(Number(id))).filter((id): id is number => Boolean(id)))
}

function ident(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`unsafe identifier: ${value}`)
  return value
}

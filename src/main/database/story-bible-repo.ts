import { getDb } from './connection'
import type {
  CaptureStoryFactsInput,
  StoryBibleSnapshot,
  StoryFactKind,
  StoryFactProposal,
  StoryFactProposalStatus
} from '../../shared/story-bible'

type Row = Record<string, unknown>

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? {})
}

function mapProposal(row: Row): StoryFactProposal {
  return {
    id: Number(row.id),
    book_id: Number(row.book_id),
    source_type: String(row.source_type || ''),
    source_ref: String(row.source_ref || ''),
    fact_kind: String(row.fact_kind || 'setting') as StoryFactKind,
    subject: String(row.subject || ''),
    fact_key: String(row.fact_key || ''),
    value: String(row.value || ''),
    evidence: String(row.evidence || ''),
    confidence: Number(row.confidence || 0),
    status: String(row.status || 'pending') as StoryFactProposalStatus,
    chapter_number:
      row.chapter_number === null || row.chapter_number === undefined
        ? null
        : Number(row.chapter_number),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  }
}

function compactEvidence(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function readCharacterCustomFields(raw: string): { motivation?: string; secret?: string } {
  const parsed = parseJson<Record<string, unknown>>(raw, {})
  return {
    motivation: typeof parsed.motivation === 'string' ? parsed.motivation : undefined,
    secret: typeof parsed.secret === 'string' ? parsed.secret : undefined
  }
}

export function listStoryFactProposals(
  bookId: number,
  status: StoryFactProposalStatus | 'all' = 'pending'
): StoryFactProposal[] {
  const db = getDb()
  const rows =
    status === 'all'
      ? db
          .prepare('SELECT * FROM ai_story_fact_proposals WHERE book_id = ? ORDER BY updated_at DESC, id DESC')
          .all(bookId)
      : db
          .prepare(
            'SELECT * FROM ai_story_fact_proposals WHERE book_id = ? AND status = ? ORDER BY updated_at DESC, id DESC'
          )
          .all(bookId, status)
  return rows.map((row) => mapProposal(row as Row))
}

export function buildStoryBible(bookId: number): StoryBibleSnapshot {
  const db = getDb()
  const characters = (
    db
      .prepare(
        `SELECT id, name, faction, status, custom_fields, description
         FROM characters
         WHERE book_id = ? AND deleted_at IS NULL
         ORDER BY id
         LIMIT 80`
      )
      .all(bookId) as Array<{
      id: number
      name: string
      faction: string
      status: string
      custom_fields: string
      description: string
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    faction: row.faction || undefined,
    ...readCharacterCustomFields(row.custom_fields),
    description: row.description || undefined
  }))

  const timeline = (
    db
      .prepare(
        `SELECT id, title, description, chapter_number
         FROM canon_events
         WHERE book_id = ?
         ORDER BY COALESCE(chapter_number, 999999), sort_order, id
         LIMIT 120`
      )
      .all(bookId) as Array<{ id: number; title: string; description: string; chapter_number: number | null }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    chapterNumber: row.chapter_number
  }))

  const settings = (
    db
      .prepare(
        `SELECT id, category, title, content
         FROM settings_wiki
         WHERE book_id = ?
         ORDER BY category, sort_order, id
         LIMIT 120`
      )
      .all(bookId) as Array<{ id: number; category: string; title: string; content: string }>
  ).map((row) => ({
    id: row.id,
    category: row.category || undefined,
    title: row.title,
    content: row.content
  }))

  const foreshadowings = (
    db
      .prepare(
        `SELECT id, text, status, expected_chapter
         FROM foreshadowings
         WHERE book_id = ? AND deleted_at IS NULL
         ORDER BY id
         LIMIT 80`
      )
      .all(bookId) as Array<{ id: number; text: string; status: string; expected_chapter: number | null }>
  ).map((row) => ({
    id: row.id,
    text: row.text,
    status: row.status,
    expectedChapter: row.expected_chapter
  }))

  const plotNodes = (
    db
      .prepare(
        `SELECT id, title, description, chapter_number
         FROM plot_nodes
         WHERE book_id = ?
         ORDER BY chapter_number, sort_order, id
         LIMIT 120`
      )
      .all(bookId) as Array<{ id: number; title: string; description: string; chapter_number: number }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    chapterNumber: row.chapter_number
  }))

  const pendingFacts = listStoryFactProposals(bookId, 'pending')
    .slice(0, 80)
    .map((item) => ({
      id: item.id,
      fact_kind: item.fact_kind,
      subject: item.subject,
      fact_key: item.fact_key,
      value: item.value,
      evidence: item.evidence,
      confidence: item.confidence
    }))

  const snapshot: StoryBibleSnapshot = {
    version: 'story-bible.v1',
    bookId,
    generatedAt: new Date().toISOString(),
    characters,
    timeline,
    settings,
    foreshadowings,
    plotNodes,
    pendingFacts
  }

  db.prepare(
    `INSERT INTO ai_story_bible_snapshots (book_id, compact_json)
     VALUES (?, ?)`
  ).run(bookId, stringify(snapshot))

  return snapshot
}

export function createStoryFactProposal(input: {
  bookId: number
  sourceType: string
  sourceRef?: string
  factKind: StoryFactKind
  subject: string
  factKey: string
  value: string
  evidence: string
  confidence?: number
  chapterNumber?: number | null
}): StoryFactProposal {
  const db = getDb()
  db.prepare(
    `INSERT INTO ai_story_fact_proposals (
       book_id, source_type, source_ref, fact_kind, subject, fact_key, value,
       evidence, confidence, status, chapter_number
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(book_id, source_type, source_ref, fact_kind, subject, fact_key, value)
     DO UPDATE SET
       evidence = excluded.evidence,
       confidence = MAX(ai_story_fact_proposals.confidence, excluded.confidence),
       updated_at = datetime('now','localtime')`
  ).run(
    input.bookId,
    input.sourceType,
    input.sourceRef || '',
    input.factKind,
    input.subject.trim(),
    input.factKey.trim(),
    input.value.trim(),
    compactEvidence(input.evidence),
    input.confidence ?? 0.6,
    input.chapterNumber ?? null
  )

  const row = db
    .prepare(
      `SELECT * FROM ai_story_fact_proposals
       WHERE book_id = ? AND source_type = ? AND source_ref = ? AND fact_kind = ?
         AND subject = ? AND fact_key = ? AND value = ?`
    )
    .get(
      input.bookId,
      input.sourceType,
      input.sourceRef || '',
      input.factKind,
      input.subject.trim(),
      input.factKey.trim(),
      input.value.trim()
    )
  return mapProposal(row as Row)
}

export function captureStoryFacts(input: CaptureStoryFactsInput): StoryFactProposal[] {
  const db = getDb()
  const text = input.text.replace(/\s+/g, ' ').trim()
  if (!text) return []

  const characters = db
    .prepare('SELECT name FROM characters WHERE book_id = ? AND deleted_at IS NULL ORDER BY length(name) DESC')
    .all(input.bookId) as Array<{ name: string }>
  const proposals: StoryFactProposal[] = []

  for (const character of characters) {
    if (!character.name || !text.includes(character.name)) continue
    const idx = text.indexOf(character.name)
    const windowText = text.slice(Math.max(0, idx - 80), Math.min(text.length, idx + 160))
    const status = inferCharacterStatus(windowText)
    if (status) {
      proposals.push(
        createStoryFactProposal({
          bookId: input.bookId,
          sourceType: input.sourceType,
          sourceRef: input.sourceRef,
          factKind: 'character_status',
          subject: character.name,
          factKey: 'status',
          value: status,
          evidence: windowText,
          confidence: 0.72,
          chapterNumber: input.chapterNumber ?? null
        })
      )
    }
  }

  for (const hit of extractTimelineFacts(text)) {
    proposals.push(
      createStoryFactProposal({
        bookId: input.bookId,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        factKind: 'timeline',
        subject: hit.subject,
        factKey: 'relative_time',
        value: hit.value,
        evidence: hit.evidence,
        confidence: 0.64,
        chapterNumber: input.chapterNumber ?? null
      })
    )
  }

  return proposals
}

function inferCharacterStatus(text: string): string | null {
  if (/死亡|死了|死去|遇害|阵亡|毙命/.test(text)) return 'dead'
  if (/失踪|下落不明/.test(text)) return 'missing'
  if (/重伤|昏迷|濒死/.test(text)) return 'injured'
  return null
}

function extractTimelineFacts(text: string): Array<{ subject: string; value: string; evidence: string }> {
  const out: Array<{ subject: string; value: string; evidence: string }> = []
  const pattern = /((?:十|七|三|两|二|一|\d{1,3})年前)[^。！？]{0,80}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const evidence = compactEvidence(match[0] || '')
    if (!evidence) continue
    out.push({
      subject: match[1] || '过去事件',
      value: evidence,
      evidence
    })
  }
  return out.slice(0, 12)
}

export function acceptStoryFactProposals(ids: number[]): StoryFactProposal[] {
  if (ids.length === 0) return []
  const db = getDb()
  const accepted: StoryFactProposal[] = []
  const tx = db.transaction(() => {
    for (const id of ids) {
      const row = db.prepare('SELECT * FROM ai_story_fact_proposals WHERE id = ?').get(id) as Row | undefined
      if (!row) continue
      const proposal = mapProposal(row)
      db.prepare(
        "UPDATE ai_story_fact_proposals SET status = 'accepted', updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(id)
      applyAcceptedProposal(proposal)
      const next = db.prepare('SELECT * FROM ai_story_fact_proposals WHERE id = ?').get(id) as Row
      accepted.push(mapProposal(next))
    }
  })
  tx()
  return accepted
}

export function rejectStoryFactProposals(ids: number[]): StoryFactProposal[] {
  if (ids.length === 0) return []
  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(
    `UPDATE ai_story_fact_proposals
     SET status = 'rejected', updated_at = datetime('now','localtime')
     WHERE id IN (${placeholders})`
  ).run(...ids)
  return db
    .prepare(`SELECT * FROM ai_story_fact_proposals WHERE id IN (${placeholders}) ORDER BY id`)
    .all(...ids)
    .map((row) => mapProposal(row as Row))
}

function applyAcceptedProposal(proposal: StoryFactProposal): void {
  const db = getDb()
  if (proposal.fact_kind === 'character_status' && proposal.fact_key === 'status') {
    db.prepare(
      `UPDATE characters
       SET status = ?, updated_at = datetime('now','localtime')
       WHERE book_id = ? AND name = ? AND deleted_at IS NULL`
    ).run(proposal.value, proposal.book_id, proposal.subject)
    return
  }

  if (proposal.fact_kind === 'timeline') {
    db.prepare(
      `INSERT INTO canon_events (
         book_id, title, description, chapter_number, event_type, importance,
         related_character_ids, metadata, sort_order
       ) VALUES (?, ?, ?, ?, 'plot', 'normal', '[]', ?, 0)`
    ).run(
      proposal.book_id,
      proposal.subject,
      proposal.value,
      proposal.chapter_number,
      stringify({ source: 'story_fact_proposal', proposalId: proposal.id, evidence: proposal.evidence })
    )
    return
  }

  db.prepare(
    `INSERT INTO settings_wiki (book_id, category, title, content)
     VALUES (?, 'Story Bible', ?, ?)`
  ).run(proposal.book_id, proposal.subject || proposal.fact_kind, proposal.value)
}

import { getDb } from './connection'

/**
 * DI-07 v3.2 — canon_character_organizations repo (membership 多对多).
 *
 * 支持按角色看所属组织 + 按组织看成员; CG-A3 OrgChartView 在节点
 * tooltip 里展示成员列表, RelationGraphView 用作角色聚类信号。
 */

export interface CharacterOrgMembership {
  id: number
  character_id: number
  organization_id: number
  role: string
  joined_chapter: number | null
  left_chapter: number | null
  created_at: string
}

export interface CharacterOrgMembershipInput {
  character_id: number
  organization_id: number
  role?: string
  joined_chapter?: number | null
  left_chapter?: number | null
}

interface MembershipRow {
  id: number
  character_id: number
  organization_id: number
  role: string
  joined_chapter: number | null
  left_chapter: number | null
  created_at: string
}

function rowToMembership(row: MembershipRow): CharacterOrgMembership {
  return {
    id: row.id,
    character_id: row.character_id,
    organization_id: row.organization_id,
    role: row.role ?? '',
    joined_chapter: row.joined_chapter,
    left_chapter: row.left_chapter,
    created_at: row.created_at
  }
}

export function listByCharacter(characterId: number): CharacterOrgMembership[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM canon_character_organizations WHERE character_id = ? ORDER BY id ASC`
    )
    .all(characterId) as MembershipRow[]
  return rows.map(rowToMembership)
}

export function listByOrg(organizationId: number): CharacterOrgMembership[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM canon_character_organizations WHERE organization_id = ? ORDER BY id ASC`
    )
    .all(organizationId) as MembershipRow[]
  return rows.map(rowToMembership)
}

export function getById(id: number): CharacterOrgMembership | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM canon_character_organizations WHERE id = ?')
    .get(id) as MembershipRow | undefined
  return row ? rowToMembership(row) : null
}

export function link(input: CharacterOrgMembershipInput): CharacterOrgMembership {
  if (!input.character_id || !input.organization_id) {
    throw new Error('invalid_membership_input')
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO canon_character_organizations
         (character_id, organization_id, role, joined_chapter, left_chapter)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.character_id,
      input.organization_id,
      input.role ?? '',
      input.joined_chapter ?? null,
      input.left_chapter ?? null
    )
  const created = getById(Number(result.lastInsertRowid))
  if (!created) throw new Error('membership_create_failed')
  return created
}

export function unlink(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM canon_character_organizations WHERE id = ?').run(id)
}

export function unlinkByPair(characterId: number, organizationId: number): void {
  const db = getDb()
  db.prepare(
    'DELETE FROM canon_character_organizations WHERE character_id = ? AND organization_id = ?'
  ).run(characterId, organizationId)
}

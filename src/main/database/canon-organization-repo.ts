import { getDb } from './connection'

/**
 * DI-07 v3.2 — canon_organizations repo.
 *
 * Organizations form a tree (parent_id 自引用)。OrgChartView 直接消费
 * getTree 返回的递归结构。删除父节点时, 子节点 parent_id 通过 FK
 * `ON DELETE SET NULL` 自动收编为根节点。
 */

export type CanonOrganizationType = 'group' | 'faction' | 'company' | 'department'

export interface CanonOrganization {
  id: number
  book_id: number
  name: string
  description: string
  parent_id: number | null
  org_type: CanonOrganizationType
  metadata: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CanonOrganizationInput {
  book_id: number
  name: string
  description?: string
  parent_id?: number | null
  org_type?: CanonOrganizationType
  metadata?: Record<string, unknown>
  sort_order?: number
}

export interface CanonOrganizationPatch {
  name?: string
  description?: string
  parent_id?: number | null
  org_type?: CanonOrganizationType
  metadata?: Record<string, unknown>
  sort_order?: number
}

export interface CanonOrganizationTreeNode extends CanonOrganization {
  children: CanonOrganizationTreeNode[]
}

interface CanonOrganizationRow {
  id: number
  book_id: number
  name: string
  description: string
  parent_id: number | null
  org_type: string
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

function rowToOrg(row: CanonOrganizationRow): CanonOrganization {
  return {
    id: row.id,
    book_id: row.book_id,
    name: row.name,
    description: row.description ?? '',
    parent_id: row.parent_id,
    org_type: (row.org_type as CanonOrganizationType) ?? 'group',
    metadata: safeParseJson<Record<string, unknown>>(row.metadata, {}),
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function listByBookId(bookId: number): CanonOrganization[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM canon_organizations
       WHERE book_id = ?
       ORDER BY parent_id IS NOT NULL, sort_order ASC, id ASC`
    )
    .all(bookId) as CanonOrganizationRow[]
  return rows.map(rowToOrg)
}

export function getById(id: number): CanonOrganization | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM canon_organizations WHERE id = ?').get(id) as
    | CanonOrganizationRow
    | undefined
  return row ? rowToOrg(row) : null
}

/**
 * Build a tree of organizations rooted at top-level entries (parent_id IS
 * NULL). Cycle detection: if a parent reference goes missing or self-
 * references, the orphan node is promoted to a root rather than dropped.
 */
export function getTree(bookId: number): CanonOrganizationTreeNode[] {
  const flat = listByBookId(bookId)
  const byId = new Map<number, CanonOrganizationTreeNode>()
  for (const org of flat) {
    byId.set(org.id, { ...org, children: [] })
  }
  const roots: CanonOrganizationTreeNode[] = []
  byId.forEach((node) => {
    if (node.parent_id !== null && byId.has(node.parent_id) && node.parent_id !== node.id) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

export function createOrganization(input: CanonOrganizationInput): CanonOrganization {
  if (!input.book_id || !input.name || !input.name.trim()) {
    throw new Error('invalid_organization_input')
  }
  if (input.parent_id !== undefined && input.parent_id !== null) {
    const parent = getById(input.parent_id)
    if (!parent || parent.book_id !== input.book_id) {
      throw new Error('invalid_parent')
    }
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO canon_organizations
         (book_id, name, description, parent_id, org_type, metadata, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.book_id,
      input.name.trim(),
      input.description ?? '',
      input.parent_id ?? null,
      input.org_type ?? 'group',
      JSON.stringify(input.metadata ?? {}),
      input.sort_order ?? 0
    )
  const created = getById(Number(result.lastInsertRowid))
  if (!created) throw new Error('organization_create_failed')
  return created
}

export function updateOrganization(id: number, patch: CanonOrganizationPatch): void {
  if (Object.keys(patch).length === 0) return
  const db = getDb()
  if (patch.parent_id !== undefined && patch.parent_id !== null && patch.parent_id === id) {
    throw new Error('parent_self_reference')
  }
  const fields: string[] = []
  const values: unknown[] = []
  if (patch.name !== undefined) {
    fields.push('name = ?')
    values.push(patch.name.trim())
  }
  if (patch.description !== undefined) {
    fields.push('description = ?')
    values.push(patch.description)
  }
  if (patch.parent_id !== undefined) {
    fields.push('parent_id = ?')
    values.push(patch.parent_id)
  }
  if (patch.org_type !== undefined) {
    fields.push('org_type = ?')
    values.push(patch.org_type)
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
  db.prepare(`UPDATE canon_organizations SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteOrganization(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM canon_organizations WHERE id = ?').run(id)
}

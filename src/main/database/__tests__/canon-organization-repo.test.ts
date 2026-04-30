import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import { runMigrations } from '../migrations'
import * as connection from '../connection'
import {
  createOrganization,
  deleteOrganization,
  getById,
  getTree,
  listByBookId,
  updateOrganization
} from '../canon-organization-repo'

describe('canon-organization-repo', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(db)
    runMigrations(db)
    db.prepare("INSERT INTO books (id, title, author) VALUES (1, 'demo', '')").run()
    vi.spyOn(connection, 'getDb').mockReturnValue(db)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('creates root + child + grandchild orgs and listByBookId returns flat list', () => {
    const root = createOrganization({ book_id: 1, name: '青云宗' })
    const child = createOrganization({ book_id: 1, name: '内门', parent_id: root.id })
    const grand = createOrganization({ book_id: 1, name: '丹房', parent_id: child.id })

    const flat = listByBookId(1)
    expect(flat.map((o) => o.name)).toContain('青云宗')
    expect(flat.map((o) => o.name)).toContain('丹房')
    expect(grand.parent_id).toBe(child.id)
  })

  it('rejects empty name and unrelated parent', () => {
    const root = createOrganization({ book_id: 1, name: '宗门' })
    db.prepare("INSERT INTO books (id, title, author) VALUES (2, 'other', '')").run()
    expect(() => createOrganization({ book_id: 1, name: ' ' })).toThrow(/invalid_organization_input/)
    expect(() =>
      createOrganization({ book_id: 2, name: 'XX', parent_id: root.id })
    ).toThrow(/invalid_parent/)
  })

  it('builds tree with children attached to their parents', () => {
    const root = createOrganization({ book_id: 1, name: '宗门' })
    const a = createOrganization({ book_id: 1, name: 'A 殿', parent_id: root.id })
    const b = createOrganization({ book_id: 1, name: 'B 殿', parent_id: root.id })
    createOrganization({ book_id: 1, name: 'A1', parent_id: a.id })
    createOrganization({ book_id: 1, name: 'B1', parent_id: b.id })

    const tree = getTree(1)
    expect(tree.length).toBe(1)
    expect(tree[0]?.name).toBe('宗门')
    expect(tree[0]?.children.length).toBe(2)
    const aNode = tree[0]?.children.find((c) => c.name === 'A 殿')
    expect(aNode?.children.length).toBe(1)
    expect(aNode?.children[0]?.name).toBe('A1')
  })

  it('deleting parent SET NULL its children and tree promotes them to roots', () => {
    const root = createOrganization({ book_id: 1, name: '宗门' })
    const child = createOrganization({ book_id: 1, name: '分支', parent_id: root.id })
    deleteOrganization(root.id)

    const reloaded = getById(child.id)
    expect(reloaded?.parent_id).toBeNull()
    const tree = getTree(1)
    expect(tree.map((n) => n.name)).toContain('分支')
  })

  it('rejects self-referential parent on update', () => {
    const root = createOrganization({ book_id: 1, name: '宗门' })
    expect(() => updateOrganization(root.id, { parent_id: root.id })).toThrow(
      /parent_self_reference/
    )
  })

  it('updates partial fields including metadata round-trip', () => {
    const root = createOrganization({ book_id: 1, name: 'X' })
    updateOrganization(root.id, { name: 'Y', metadata: { rank: 'A' } })
    const reloaded = getById(root.id)
    expect(reloaded?.name).toBe('Y')
    expect(reloaded?.metadata).toEqual({ rank: 'A' })
  })
})

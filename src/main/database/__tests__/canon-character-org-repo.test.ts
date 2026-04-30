import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import { runMigrations } from '../migrations'
import * as connection from '../connection'
import { createOrganization } from '../canon-organization-repo'
import {
  link,
  listByCharacter,
  listByOrg,
  unlink,
  unlinkByPair
} from '../canon-character-org-repo'

describe('canon-character-org-repo', () => {
  let db: Database.Database
  let orgId: number
  let charA: number
  let charB: number

  beforeEach(() => {
    db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(db)
    runMigrations(db)
    db.prepare("INSERT INTO books (id, title, author) VALUES (1, 'demo', '')").run()
    db.prepare(
      `INSERT INTO characters (book_id, name, description) VALUES (1, '甲', ''), (1, '乙', '')`
    ).run()
    charA = (db.prepare("SELECT id FROM characters WHERE name = '甲'").get() as { id: number }).id
    charB = (db.prepare("SELECT id FROM characters WHERE name = '乙'").get() as { id: number }).id
    vi.spyOn(connection, 'getDb').mockReturnValue(db)
    orgId = createOrganization({ book_id: 1, name: '青云宗' }).id
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('links character to organization and shows up in both lookups', () => {
    const m = link({ character_id: charA, organization_id: orgId, role: '弟子', joined_chapter: 3 })
    expect(m.id).toBeGreaterThan(0)
    expect(m.role).toBe('弟子')
    expect(m.joined_chapter).toBe(3)

    expect(listByCharacter(charA)).toHaveLength(1)
    expect(listByOrg(orgId)).toHaveLength(1)
  })

  it('rejects invalid input', () => {
    expect(() => link({ character_id: 0, organization_id: orgId })).toThrow(/invalid_membership_input/)
    expect(() => link({ character_id: charA, organization_id: 0 })).toThrow(/invalid_membership_input/)
  })

  it('refuses duplicate (character, organization) pair via UNIQUE constraint', () => {
    link({ character_id: charA, organization_id: orgId })
    expect(() => link({ character_id: charA, organization_id: orgId })).toThrow()
  })

  it('separates members by character vs by org', () => {
    link({ character_id: charA, organization_id: orgId })
    link({ character_id: charB, organization_id: orgId })

    expect(listByCharacter(charA)).toHaveLength(1)
    expect(listByCharacter(charB)).toHaveLength(1)
    expect(listByOrg(orgId)).toHaveLength(2)
  })

  it('unlink by id removes only that membership', () => {
    const m = link({ character_id: charA, organization_id: orgId })
    link({ character_id: charB, organization_id: orgId })
    unlink(m.id)
    expect(listByOrg(orgId).map((r) => r.character_id)).toEqual([charB])
  })

  it('unlinkByPair removes by (characterId, orgId)', () => {
    link({ character_id: charA, organization_id: orgId })
    unlinkByPair(charA, orgId)
    expect(listByCharacter(charA)).toHaveLength(0)
  })

  it('cascades on character delete', () => {
    link({ character_id: charA, organization_id: orgId })
    db.prepare('DELETE FROM characters WHERE id = ?').run(charA)
    expect(listByCharacter(charA)).toHaveLength(0)
  })
})

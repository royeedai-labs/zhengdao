import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSchema } from '../schema'
import { runMigrations } from '../migrations'
import * as connection from '../connection'
import {
  acceptStoryFactProposals,
  buildStoryBible,
  captureStoryFacts,
  listStoryFactProposals
} from '../story-bible-repo'

describe('story-bible-repo', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new BetterSqlite3(':memory:') as Database.Database
    createSchema(db)
    runMigrations(db)
    db.prepare("INSERT INTO books (id, title, author) VALUES (1, 'demo', '')").run()
    db.prepare(
      `INSERT INTO characters (book_id, name, faction, status, custom_fields, description)
       VALUES (1, '林凡', '主角阵营', 'active', ?, '主角')`
    ).run(JSON.stringify({ motivation: '保护妹妹', secret: '知道旧案入口' }))
    db.prepare(
      `INSERT INTO canon_events (book_id, title, description, chapter_number, sort_order)
       VALUES (1, '十年前火灾', '旧案起点', NULL, 0)`
    ).run()
    db.prepare(
      `INSERT INTO settings_wiki (book_id, category, title, content)
       VALUES (1, '刑期', '旧案刑期', '七年')`
    ).run()
    db.prepare(
      `INSERT INTO foreshadowings (book_id, text, expected_chapter, status)
       VALUES (1, '画室墙角半张招生海报', 3, 'pending')`
    ).run()
    db.prepare(
      `INSERT INTO plot_nodes (book_id, chapter_number, title, description)
       VALUES (1, 1, '废弃画室', '发现第一处矛盾')`
    ).run()
    vi.spyOn(connection, 'getDb').mockReturnValue(db)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('builds a compact story bible from confirmed assets and pending facts', () => {
    const proposals = captureStoryFacts({
      bookId: 1,
      sourceType: 'assistant_message',
      sourceRef: 'm1',
      text: '七年前，青阳路画室发生过一次失火。林凡在旧案里已经遇害。',
      chapterNumber: 2
    })

    expect(proposals.map((proposal) => proposal.fact_kind)).toEqual(
      expect.arrayContaining(['character_status', 'timeline'])
    )

    const snapshot = buildStoryBible(1)
    expect(snapshot.characters[0]).toMatchObject({
      name: '林凡',
      status: 'active',
      motivation: '保护妹妹',
      secret: '知道旧案入口'
    })
    expect(snapshot.timeline.map((event) => event.title)).toContain('十年前火灾')
    expect(snapshot.settings[0]).toMatchObject({ title: '旧案刑期', content: '七年' })
    expect(snapshot.foreshadowings[0]?.text).toContain('招生海报')
    expect(snapshot.plotNodes[0]?.title).toBe('废弃画室')
    expect(snapshot.pendingFacts.map((fact) => fact.fact_kind)).toEqual(
      expect.arrayContaining(['character_status', 'timeline'])
    )

    const storedSnapshots = db.prepare('SELECT COUNT(*) AS count FROM ai_story_bible_snapshots').get() as {
      count: number
    }
    expect(storedSnapshots.count).toBe(1)
  })

  it('keeps extracted facts pending until accepted into canonical assets', () => {
    const [statusProposal] = captureStoryFacts({
      bookId: 1,
      sourceType: 'assistant_message',
      sourceRef: 'm2',
      text: '林凡在证词里被标记为遇害，但现场仍有矛盾。',
      chapterNumber: 4
    }).filter((proposal) => proposal.fact_kind === 'character_status')

    expect(statusProposal?.status).toBe('pending')
    expect(listStoryFactProposals(1)).toHaveLength(1)
    expect(db.prepare("SELECT status FROM characters WHERE name = '林凡'").get()).toMatchObject({
      status: 'active'
    })

    acceptStoryFactProposals([statusProposal!.id])

    expect(listStoryFactProposals(1)).toHaveLength(0)
    expect(db.prepare("SELECT status FROM characters WHERE name = '林凡'").get()).toMatchObject({
      status: 'dead'
    })
  })
})

import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations'
import { createSchema } from '../schema'

describe('runMigrations', () => {
  it('does not re-add editor columns already present in fresh schema', () => {
    const db = new BetterSqlite3(':memory:') as Database.Database

    try {
      createSchema(db)

      expect(() => runMigrations(db)).not.toThrow()

      const projectConfigColumns = db.prepare('PRAGMA table_info(project_config)').all() as { name: string }[]

      expect(projectConfigColumns.filter((column) => column.name === 'editor_font')).toHaveLength(1)
      expect(projectConfigColumns.filter((column) => column.name === 'editor_font_size')).toHaveLength(1)
      expect(projectConfigColumns.filter((column) => column.name === 'editor_line_height')).toHaveLength(1)
      expect(projectConfigColumns.filter((column) => column.name === 'editor_width')).toHaveLength(1)

      const appliedVersions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
        version: number
      }[]

      expect(appliedVersions.map((row) => row.version)).toContain(2)
    } finally {
      db.close()
    }
  })

  it('creates AI assistant tables and default skill templates', () => {
    const db = new BetterSqlite3(':memory:') as Database.Database

    try {
      createSchema(db)

      expect(() => runMigrations(db)).not.toThrow()

      const tableRows = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ai_accounts', 'ai_skill_templates', 'ai_work_profiles', 'ai_skill_overrides', 'ai_conversations', 'ai_messages', 'ai_drafts') ORDER BY name"
        )
        .all() as { name: string }[]

      expect(tableRows.map((row) => row.name)).toEqual([
        'ai_accounts',
        'ai_conversations',
        'ai_drafts',
        'ai_messages',
        'ai_skill_overrides',
        'ai_skill_templates',
        'ai_work_profiles'
      ])

      const skillRows = db
        .prepare('SELECT key, name FROM ai_skill_templates ORDER BY sort_order, key')
        .all() as { key: string; name: string }[]

      expect(skillRows.map((row) => row.key)).toEqual([
        'continue_writing',
        'create_chapter',
        'review_chapter',
        'polish_text',
        'create_character',
        'create_wiki_entry',
        'create_foreshadowing',
        'create_plot_node'
      ])
      expect(skillRows[0].name).toBe('续写正文')
    } finally {
      db.close()
    }
  })

  it('migrates legacy per-book AI config into a global account and work profile', () => {
    const db = new BetterSqlite3(':memory:') as Database.Database

    try {
      createSchema(db)
      db.prepare("INSERT INTO books (id, title, author) VALUES (1, '旧书', '')").run()
      db.prepare(
        `INSERT INTO project_config (
          book_id, genre, character_fields, faction_labels, status_labels, emotion_labels,
          daily_goal, sensitive_list, ai_api_key, ai_api_endpoint, ai_model, ai_provider
        ) VALUES (1, 'urban', '[]', '[]', '[]', '[]', 6000, 'default', 'legacy-key', 'https://example.test/v1/chat/completions', 'legacy-model', 'custom')`
      ).run()

      runMigrations(db)
      runMigrations(db)

      const accountRows = db
        .prepare('SELECT id, provider, api_endpoint, model, is_default FROM ai_accounts')
        .all() as Array<{ id: number; provider: string; api_endpoint: string; model: string; is_default: number }>
      expect(accountRows).toHaveLength(1)
      expect(accountRows[0]).toMatchObject({
        provider: 'custom',
        api_endpoint: 'https://example.test/v1/chat/completions',
        model: 'legacy-model',
        is_default: 1
      })

      const profile = db
        .prepare('SELECT book_id, default_account_id, context_policy FROM ai_work_profiles WHERE book_id = 1')
        .get() as { book_id: number; default_account_id: number | null; context_policy: string }
      expect(profile.default_account_id).toBeNull()
      expect(profile.context_policy).toBe('smart_minimal')
    } finally {
      db.close()
    }
  })

  it('normalizes blank migrated work profiles to follow the global default account', () => {
    const db = new BetterSqlite3(':memory:') as Database.Database

    try {
      createSchema(db)
      db.prepare("INSERT INTO books (id, title, author) VALUES (1, '旧书', '')").run()
      db.prepare(
        `INSERT INTO ai_accounts (id, name, provider, api_endpoint, model, credential_ref, is_default, status)
         VALUES
         (1, '旧账号', 'openai', 'https://example.test/v1', 'legacy-model', 'legacy-project-config:1', 0, 'unknown'),
         (2, 'Gemini CLI', 'gemini_cli', '', '', '', 1, 'unknown')`
      ).run()
      db.prepare(
        `INSERT INTO ai_work_profiles (
          book_id, default_account_id, style_guide, genre_rules, content_boundaries, asset_rules, rhythm_rules, context_policy
        ) VALUES (1, 1, '', '', '', '', '', 'smart_minimal')`
      ).run()

      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
      `)
      const insertMigration = db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)')
      for (let version = 1; version <= 15; version += 1) {
        insertMigration.run(version, `migration ${version}`)
      }

      runMigrations(db)

      const profile = db
        .prepare('SELECT default_account_id FROM ai_work_profiles WHERE book_id = 1')
        .get() as { default_account_id: number | null }

      expect(profile.default_account_id).toBeNull()
    } finally {
      db.close()
    }
  })
})

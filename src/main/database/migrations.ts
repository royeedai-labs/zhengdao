import type Database from 'better-sqlite3'
import { SEED_GENRE_TEMPLATES } from '../../shared/genre-template-seeds'

interface Migration {
  version: number
  description: string
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Add performance indexes for foreign keys and common queries',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_volumes_book_id ON volumes(book_id);
        CREATE INDEX IF NOT EXISTS idx_chapters_volume_id ON chapters(volume_id);
        CREATE INDEX IF NOT EXISTS idx_chapters_volume_sort ON chapters(volume_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_characters_book_id ON characters(book_id);
        CREATE INDEX IF NOT EXISTS idx_character_appearances_chapter ON character_appearances(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_character_appearances_character ON character_appearances(character_id);
        CREATE INDEX IF NOT EXISTS idx_plot_nodes_book_id ON plot_nodes(book_id);
        CREATE INDEX IF NOT EXISTS idx_plot_nodes_book_chapter ON plot_nodes(book_id, chapter_number);
        CREATE INDEX IF NOT EXISTS idx_foreshadowings_book_id ON foreshadowings(book_id);
        CREATE INDEX IF NOT EXISTS idx_foreshadowings_status ON foreshadowings(book_id, status);
        CREATE INDEX IF NOT EXISTS idx_settings_wiki_book ON settings_wiki(book_id, category);
        CREATE INDEX IF NOT EXISTS idx_snapshots_chapter ON snapshots(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_chapter_created ON snapshots(chapter_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
      `)
    }
  },
  {
    version: 2,
    description: 'Add editor typography columns to project_config',
    up: (db) => {
      const cols = new Set(
        (db.prepare('PRAGMA table_info(project_config)').all() as { name: string }[]).map((col) => col.name)
      )
      const statements: string[] = []

      if (!cols.has('editor_font')) {
        statements.push(`ALTER TABLE project_config ADD COLUMN editor_font TEXT NOT NULL DEFAULT 'serif'`)
      }
      if (!cols.has('editor_font_size')) {
        statements.push(`ALTER TABLE project_config ADD COLUMN editor_font_size INTEGER NOT NULL DEFAULT 19`)
      }
      if (!cols.has('editor_line_height')) {
        statements.push(`ALTER TABLE project_config ADD COLUMN editor_line_height REAL NOT NULL DEFAULT 2.2`)
      }
      if (!cols.has('editor_width')) {
        statements.push(`ALTER TABLE project_config ADD COLUMN editor_width TEXT NOT NULL DEFAULT 'standard'`)
      }

      if (statements.length === 0) return
      db.exec(statements.join(';\n'))
    }
  },
  {
    version: 3,
    description: 'Add ai_provider to project_config',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(project_config)').all() as { name: string }[]
      if (cols.some((c) => c.name === 'ai_provider')) return
      db.exec(`ALTER TABLE project_config ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'openai'`)
    }
  },
  {
    version: 4,
    description: 'Add chapter summary column',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(chapters)').all() as { name: string }[]
      if (cols.some((c) => c.name === 'summary')) return
      db.exec(`ALTER TABLE chapters ADD COLUMN summary TEXT NOT NULL DEFAULT ''`)
    }
  },
  {
    version: 5,
    description: 'Add sync_queue for Drive upload tracking',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          action TEXT NOT NULL DEFAULT 'upload',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_book_id ON sync_queue(book_id);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      `)
    }
  },
  {
    version: 6,
    description: 'Soft-delete columns for chapters, volumes, characters, foreshadowings',
    up: (db) => {
      const addCol = (table: string, col: string) => {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
        if (cols.some((c) => c.name === col)) return
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT DEFAULT NULL`)
      }
      addCol('chapters', 'deleted_at')
      addCol('volumes', 'deleted_at')
      addCol('characters', 'deleted_at')
      addCol('foreshadowings', 'deleted_at')
    }
  },
  {
    version: 7,
    description: 'Rebuild FTS5 chapter index after schema upgrade',
    up: (db) => {
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chapters_fts'").all() as {
        name: string
      }[]
      if (rows.length === 0) return
      db.exec(`INSERT INTO chapters_fts(chapters_fts) VALUES('rebuild')`)
    }
  },
  {
    version: 8,
    description: 'Add annotations table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS annotations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapter_id INTEGER NOT NULL,
          text_anchor TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        );
      `)
    }
  },
  {
    version: 9,
    description: 'Character relations, milestones, relation indexes',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS character_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          source_id INTEGER NOT NULL,
          target_id INTEGER NOT NULL,
          relation_type TEXT NOT NULL DEFAULT 'ally',
          label TEXT NOT NULL DEFAULT '',
          UNIQUE(source_id, target_id),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES characters(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS character_milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER NOT NULL,
          chapter_number INTEGER NOT NULL,
          label TEXT NOT NULL DEFAULT '',
          value TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_character_relations_book ON character_relations(book_id);
        CREATE INDEX IF NOT EXISTS idx_character_milestones_character ON character_milestones(character_id);
      `)
    }
  },
  {
    version: 10,
    description: 'Plotlines, plot_node_characters, plot_nodes.plotline_id',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS plotlines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#10b981',
          sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS plot_node_characters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plot_node_id INTEGER NOT NULL,
          character_id INTEGER NOT NULL,
          UNIQUE(plot_node_id, character_id),
          FOREIGN KEY (plot_node_id) REFERENCES plot_nodes(id) ON DELETE CASCADE,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_plotlines_book_id ON plotlines(book_id);
        CREATE INDEX IF NOT EXISTS idx_plot_node_characters_node ON plot_node_characters(plot_node_id);
        CREATE INDEX IF NOT EXISTS idx_plot_node_characters_character ON plot_node_characters(character_id);
      `)
      const cols = db.prepare('PRAGMA table_info(plot_nodes)').all() as { name: string }[]
      if (!cols.some((c) => c.name === 'plotline_id')) {
        db.exec(`
          ALTER TABLE plot_nodes ADD COLUMN plotline_id INTEGER DEFAULT NULL REFERENCES plotlines(id) ON DELETE SET NULL
        `)
      }
    }
  },
  {
    version: 11,
    description: 'Writing sessions and achievements tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS writing_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          ended_at TEXT,
          word_count INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          unlocked_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_writing_sessions_book_started ON writing_sessions(book_id, started_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_book_type ON achievements(book_id, type);
      `)
    }
  },
  {
    version: 12,
    description: 'Chapter content templates',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS chapter_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER,
          name TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          is_builtin INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
      `)
    }
  },
  {
    version: 13,
    description: 'Custom keyboard shortcuts table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS custom_shortcuts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL UNIQUE,
          keys TEXT NOT NULL DEFAULT ''
        );
      `)
    }
  },
  {
    version: 14,
    description: 'Add foreshadow auto_suppressed flag',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(foreshadowings)').all() as { name: string }[]
      if (cols.some((col) => col.name === 'auto_suppressed')) return
      db.exec(`ALTER TABLE foreshadowings ADD COLUMN auto_suppressed INTEGER NOT NULL DEFAULT 0`)
    }
  },
  {
    version: 15,
    description: 'AI assistant accounts, skills, profiles, conversations, messages, drafts',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT 'openai',
          api_endpoint TEXT NOT NULL DEFAULT '',
          model TEXT NOT NULL DEFAULT '',
          credential_ref TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'unknown',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS ai_skill_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          system_prompt TEXT NOT NULL DEFAULT '',
          user_prompt_template TEXT NOT NULL DEFAULT '',
          context_policy TEXT NOT NULL DEFAULT 'smart_minimal',
          output_contract TEXT NOT NULL DEFAULT 'plain_text',
          enabled_surfaces TEXT NOT NULL DEFAULT 'assistant',
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_builtin INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS ai_work_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL UNIQUE,
          default_account_id INTEGER,
          style_guide TEXT NOT NULL DEFAULT '',
          genre_rules TEXT NOT NULL DEFAULT '',
          content_boundaries TEXT NOT NULL DEFAULT '',
          asset_rules TEXT NOT NULL DEFAULT '',
          rhythm_rules TEXT NOT NULL DEFAULT '',
          context_policy TEXT NOT NULL DEFAULT 'smart_minimal',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (default_account_id) REFERENCES ai_accounts(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS ai_skill_overrides (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          skill_key TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          system_prompt TEXT NOT NULL DEFAULT '',
          user_prompt_template TEXT NOT NULL DEFAULT '',
          context_policy TEXT NOT NULL DEFAULT '',
          output_contract TEXT NOT NULL DEFAULT '',
          enabled_surfaces TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          UNIQUE(book_id, skill_key),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          title TEXT NOT NULL DEFAULT 'AI 对话',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
          content TEXT NOT NULL DEFAULT '',
          metadata TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_drafts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          conversation_id INTEGER,
          message_id INTEGER,
          kind TEXT NOT NULL CHECK(kind IN ('insert_text','replace_text','create_chapter','update_chapter_summary','create_character','create_wiki_entry','create_plot_node','create_foreshadowing')),
          title TEXT NOT NULL DEFAULT '',
          payload TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','dismissed')),
          target_ref TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL,
          FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ai_accounts_default ON ai_accounts(is_default);
        CREATE INDEX IF NOT EXISTS idx_ai_work_profiles_book ON ai_work_profiles(book_id);
        CREATE INDEX IF NOT EXISTS idx_ai_skill_overrides_book ON ai_skill_overrides(book_id);
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_book ON ai_conversations(book_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_ai_drafts_book_status ON ai_drafts(book_id, status, created_at);
      `)

      const seed = db.prepare(`
        INSERT INTO ai_skill_templates (
          key, name, description, system_prompt, user_prompt_template,
          context_policy, output_contract, enabled_surfaces, sort_order, is_builtin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(key) DO NOTHING
      `)

      const skills: Array<[string, string, string, string, string, string, string, string, number]> = [
        [
          'continue_writing',
          '续写正文',
          '根据当前章节、选中文本和相关资产自然续写。',
          '你是网文续写助手。保持作者现有文风、视角、人物设定和节奏。只给可直接采纳的正文，不解释。',
          '请根据用户要求续写：{{input}}',
          'smart_minimal',
          'plain_text',
          'assistant,editor',
          1
        ],
        [
          'create_chapter',
          '创建章节',
          '生成新章节标题和正文草稿。',
          '你是长篇网文章节策划和正文助手。输出必须适合进入草稿篮，不能直接声称已写入小说。',
          '请生成章节草稿：{{input}}',
          'smart_minimal',
          '{"drafts":[{"kind":"create_chapter","title":"章节标题","content":"<p>章节正文</p>"}]}',
          'assistant',
          2
        ],
        [
          'review_chapter',
          '审核本章',
          '检查剧情、节奏、人物一致性和毒点风险。',
          '你是网文编辑审核助手。指出问题和可执行修改建议，不直接改正文。',
          '请审核当前内容：{{input}}',
          'smart_minimal',
          'plain_text',
          'assistant,editor',
          3
        ],
        [
          'polish_text',
          '润色改写',
          '将选中文本改得更顺但保留原意。',
          '你是网文润色助手。保留剧情事实和人物口吻，只改善表达。',
          '请润色或改写：{{input}}',
          'smart_minimal',
          '{"drafts":[{"kind":"replace_text","content":"改写后的文本"}]}',
          'assistant,editor',
          4
        ],
        [
          'create_character',
          '生成角色',
          '生成角色档案草稿。',
          '你是网文角色设定助手。角色必须服务当前作品冲突和爽点节奏。',
          '请生成角色：{{input}}',
          'smart_minimal',
          '{"drafts":[{"kind":"create_character","name":"角色名","faction":"neutral","status":"active","description":"角色简介","custom_fields":{}}]}',
          'assistant',
          5
        ],
        [
          'create_wiki_entry',
          '生成设定',
          '生成世界观、道具、势力或规则设定草稿。',
          '你是设定维基助手。设定要可长期维护，并避免和已有内容冲突。',
          '请生成设定条目：{{input}}',
          'smart_minimal',
          '{"drafts":[{"kind":"create_wiki_entry","category":"分类","title":"设定标题","content":"设定内容"}]}',
          'assistant',
          6
        ],
        [
          'create_foreshadowing',
          '整理伏笔',
          '从正文或想法中整理伏笔草稿。',
          '你是伏笔管理助手。只提取值得追踪、后续需要回收的线索。',
          '请整理伏笔：{{input}}',
          'smart_minimal',
          '{"drafts":[{"kind":"create_foreshadowing","text":"伏笔描述","expected_chapter":null,"expected_word_count":null}]}',
          'assistant,editor',
          7
        ],
        [
          'create_plot_node',
          '剧情节点建议',
          '生成剧情节点和情绪节奏建议。',
          '你是网文剧情沙盘助手。节点要推动冲突和爽点，不做空泛总结。',
          '请生成剧情节点：{{input}}',
          'smart_minimal',
          '{"drafts":[{"kind":"create_plot_node","chapter_number":0,"title":"节点标题","score":0,"node_type":"main","description":"节点说明"}]}',
          'assistant',
          8
        ]
      ]

      for (const skill of skills) seed.run(...skill)

      const hasAccount = (db.prepare('SELECT COUNT(*) as count FROM ai_accounts').get() as { count: number }).count > 0
      if (!hasAccount) {
        db.prepare(`
          INSERT INTO ai_accounts (name, provider, api_endpoint, model, credential_ref, is_default, status)
          SELECT
            '旧全局模型配置',
            COALESCE(NULLIF(ai_provider, ''), 'openai'),
            COALESCE(ai_api_endpoint, ''),
            COALESCE(ai_model, ''),
            CASE WHEN COALESCE(ai_api_key, '') <> '' THEN 'legacy-project-config:' || book_id ELSE '' END,
            1,
            'unknown'
          FROM project_config
          WHERE COALESCE(ai_provider, '') <> ''
            OR COALESCE(ai_api_key, '') <> ''
            OR COALESCE(ai_api_endpoint, '') <> ''
            OR COALESCE(ai_model, '') <> ''
          ORDER BY book_id
          LIMIT 1
        `).run()
      }

      db.prepare(`
        INSERT OR IGNORE INTO ai_work_profiles (book_id, default_account_id, context_policy)
        SELECT
          pc.book_id,
          (SELECT id FROM ai_accounts ORDER BY is_default DESC, id LIMIT 1),
          'smart_minimal'
        FROM project_config pc
      `).run()
    }
  },
  {
    version: 16,
    description: 'Normalize blank AI work profiles to follow the global default account',
    up: (db) => {
      db.exec(`
        UPDATE ai_work_profiles
        SET
          default_account_id = NULL,
          updated_at = datetime('now','localtime')
        WHERE id IN (
          SELECT profile.id
          FROM ai_work_profiles profile
          JOIN ai_accounts account ON account.id = profile.default_account_id
          WHERE COALESCE(profile.style_guide, '') = ''
            AND COALESCE(profile.genre_rules, '') = ''
            AND COALESCE(profile.content_boundaries, '') = ''
            AND COALESCE(profile.asset_rules, '') = ''
            AND COALESCE(profile.rhythm_rules, '') = ''
            AND COALESCE(profile.context_policy, 'smart_minimal') = 'smart_minimal'
            AND account.credential_ref LIKE 'legacy-project-config:%'
        );
      `)
    }
  },
  {
    version: 17,
    description: 'Genre templates library and project daily goal mode',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS genre_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          character_fields TEXT NOT NULL DEFAULT '[]',
          faction_labels TEXT NOT NULL DEFAULT '[]',
          status_labels TEXT NOT NULL DEFAULT '[]',
          emotion_labels TEXT NOT NULL DEFAULT '[]',
          is_seed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        CREATE INDEX IF NOT EXISTS idx_genre_templates_seed_slug ON genre_templates(is_seed, slug);
      `)

      const projectConfigColumns = db.prepare('PRAGMA table_info(project_config)').all() as { name: string }[]
      if (!projectConfigColumns.some((column) => column.name === 'daily_goal_mode')) {
        db.exec(`ALTER TABLE project_config ADD COLUMN daily_goal_mode TEXT NOT NULL DEFAULT 'follow_system'`)
      }

      db.exec(`
        UPDATE project_config
        SET daily_goal_mode = CASE
          WHEN COALESCE(daily_goal, 6000) = 6000 THEN 'follow_system'
          ELSE 'custom'
        END
      `)

      const insertTemplate = db.prepare(`
        INSERT OR IGNORE INTO genre_templates (
          slug, name, character_fields, faction_labels, status_labels, emotion_labels, is_seed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now','localtime'), datetime('now','localtime'))
      `)

      for (const template of SEED_GENRE_TEMPLATES) {
        insertTemplate.run(
          template.id,
          template.name,
          JSON.stringify(template.character_fields),
          JSON.stringify(template.faction_labels),
          JSON.stringify(template.status_labels),
          JSON.stringify(template.emotion_labels)
        )
      }

      db.prepare(`
        INSERT OR IGNORE INTO app_state (key, value) VALUES ('system_default_daily_goal', '6000')
      `).run()

      const defaultTemplateRow = db
        .prepare("SELECT id FROM genre_templates WHERE slug = 'urban' LIMIT 1")
        .get() as { id: number } | undefined
      if (defaultTemplateRow) {
        db.prepare(`
          INSERT OR IGNORE INTO app_state (key, value) VALUES ('system_default_genre_template_id', ?)
        `).run(String(defaultTemplateRow.id))
      }
    }
  },
  {
    version: 18,
    description: 'Add genre column to ai_work_profiles for 5-genre coverage (webnovel/script/fiction/academic/professional)',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(ai_work_profiles)').all() as { name: string }[]
      if (cols.some((c) => c.name === 'genre')) return
      db.exec(`
        ALTER TABLE ai_work_profiles ADD COLUMN genre TEXT NOT NULL DEFAULT 'webnovel'
          CHECK (genre IN ('webnovel', 'script', 'fiction', 'academic', 'professional'));
        CREATE INDEX IF NOT EXISTS idx_ai_work_profiles_genre ON ai_work_profiles(genre);
      `)
    }
  },
  {
    version: 22,
    description: 'DI-02 v1: create citations table for academic genre — BibTeX-style citation entries scoped per book, unique by citekey',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS citations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          citekey TEXT NOT NULL,
          citation_type TEXT NOT NULL DEFAULT 'other'
            CHECK(citation_type IN ('book','journal','conference','website','thesis','report','other')),
          authors TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          year INTEGER,
          publisher TEXT NOT NULL DEFAULT '',
          journal TEXT NOT NULL DEFAULT '',
          volume TEXT NOT NULL DEFAULT '',
          issue TEXT NOT NULL DEFAULT '',
          pages TEXT NOT NULL DEFAULT '',
          doi TEXT NOT NULL DEFAULT '',
          url TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          UNIQUE(book_id, citekey),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_citations_book ON citations(book_id);
      `)
    }
  },
  {
    version: 21,
    description: 'DI-07 v1: add canon_pack_locks JSON column to ai_work_profiles for manually-locked canon entries (overrides world-consistency Skill defaults)',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(ai_work_profiles)').all() as { name: string }[]
      if (cols.some((c) => c.name === 'canon_pack_locks')) return
      db.exec(`ALTER TABLE ai_work_profiles ADD COLUMN canon_pack_locks TEXT NOT NULL DEFAULT ''`)
    }
  },
  {
    version: 23,
    description: 'Consolidate AI runtime selection into one global configuration',
    up: (db) => {
      const existingGlobal = db.prepare("SELECT value FROM app_state WHERE key = 'ai_global_provider'").get()
      if (!existingGlobal) {
        const thirdPartyEnabled =
          ((db.prepare("SELECT value FROM app_state WHERE key = 'ai_third_party_enabled'").get() as
            | { value?: string }
            | undefined)?.value || '') === '1'
        const account = db
          .prepare(
            `SELECT id, provider, api_endpoint, model, credential_ref
             FROM ai_accounts
             ORDER BY is_default DESC, id
             LIMIT 1`
          )
          .get() as
          | {
              id: number
              provider?: string
              api_endpoint?: string
              model?: string
              credential_ref?: string
            }
          | undefined
        const shouldUseAccount =
          Boolean(account) && (thirdPartyEnabled || (account?.credential_ref || '').startsWith('legacy-project-config:'))

        const putState = db.prepare(
          `INSERT INTO app_state (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )

        if (account && shouldUseAccount) {
          putState.run('ai_global_provider', account.provider || 'openai')
          putState.run('ai_global_api_endpoint', account.api_endpoint || '')
          putState.run('ai_global_model', account.model || '')

          const credentialRef = account.credential_ref || ''
          let secret = ''
          if (credentialRef.startsWith('app-state:')) {
            secret =
              (db.prepare('SELECT value FROM app_state WHERE key = ?').get(credentialRef.slice('app-state:'.length)) as
                | { value?: string }
                | undefined)?.value || ''
          } else if (credentialRef.startsWith('legacy-project-config:')) {
            const bookId = Number(credentialRef.slice('legacy-project-config:'.length))
            if (Number.isFinite(bookId)) {
              secret =
                (db.prepare('SELECT ai_api_key FROM project_config WHERE book_id = ?').get(bookId) as
                  | { ai_api_key?: string }
                  | undefined)?.ai_api_key || ''
            }
          }
          if (secret) putState.run('ai_global_api_key', secret)
        } else {
          putState.run('ai_global_provider', 'zhengdao_official')
          putState.run('ai_global_api_endpoint', '')
          putState.run('ai_global_model', '')
        }
      }

      db.exec(`
        DELETE FROM app_state WHERE key = 'ai_third_party_enabled';

        UPDATE ai_work_profiles
        SET default_account_id = NULL,
            updated_at = datetime('now','localtime')
        WHERE default_account_id IS NOT NULL
      `)
    }
  },
  {
    version: 20,
    description: 'DI-01 v2: add style_fingerprint + genre_meta JSON columns to ai_work_profiles for AI style learning persistence',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(ai_work_profiles)').all() as { name: string }[]
      const has = (n: string) => cols.some((c) => c.name === n)
      if (!has('style_fingerprint')) {
        db.exec(`ALTER TABLE ai_work_profiles ADD COLUMN style_fingerprint TEXT NOT NULL DEFAULT ''`)
      }
      if (!has('genre_meta')) {
        db.exec(`ALTER TABLE ai_work_profiles ADD COLUMN genre_meta TEXT NOT NULL DEFAULT ''`)
      }
    }
  },
  {
    version: 19,
    description: 'Extend ai_drafts.kind whitelist with 5 new genre-specific kinds (academic citations + professional templates)',
    up: (db) => {
      // SQLite 无法 ALTER 已有 CHECK 约束。检查现有表的 CHECK 是否已含新 kinds，否则重建表。
      const tableSql = (
        db
          .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ai_drafts'`)
          .get() as { sql: string } | undefined
      )?.sql
      if (!tableSql || tableSql.includes('create_citation')) return

      db.exec(`
        CREATE TABLE ai_drafts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          conversation_id INTEGER,
          message_id INTEGER,
          kind TEXT NOT NULL CHECK(kind IN ('insert_text','replace_text','create_chapter','update_chapter_summary','create_character','create_wiki_entry','create_plot_node','create_foreshadowing','create_citation','create_reference','create_section_outline','apply_format_template','create_policy_anchor')),
          title TEXT NOT NULL DEFAULT '',
          payload TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','dismissed')),
          target_ref TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL,
          FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE SET NULL
        );

        INSERT INTO ai_drafts_new (id, book_id, conversation_id, message_id, kind, title, payload, status, target_ref, created_at, updated_at)
        SELECT id, book_id, conversation_id, message_id, kind, title, payload, status, target_ref, created_at, updated_at FROM ai_drafts;

        DROP TABLE ai_drafts;
        ALTER TABLE ai_drafts_new RENAME TO ai_drafts;
        CREATE INDEX IF NOT EXISTS idx_ai_drafts_book_status ON ai_drafts(book_id, status, created_at);
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `)

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version)
  )

  const pending = migrations.filter((m) => !applied.has(m.version)).sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    console.log(`[DB] Running migration v${migration.version}: ${migration.description}`)
    db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(
        migration.version,
        migration.description
      )
    })()
  }
}

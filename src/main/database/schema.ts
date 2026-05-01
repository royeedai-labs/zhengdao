import type Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      cover_path TEXT,
      cloud_book_id TEXT UNIQUE,
      cloud_sync_version INTEGER NOT NULL DEFAULT 0,
      cloud_payload_hash TEXT NOT NULL DEFAULT '',
      cloud_updated_at TEXT,
      cloud_sync_status TEXT NOT NULL DEFAULT 'idle'
        CHECK(cloud_sync_status IN ('idle','synced','pending','conflict','error','archived')),
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_books_cloud_book_id ON books(cloud_book_id);
    CREATE INDEX IF NOT EXISTS idx_books_archived_at ON books(archived_at);

    CREATE TABLE IF NOT EXISTS project_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL UNIQUE,
      genre TEXT NOT NULL DEFAULT 'urban',
      character_fields TEXT NOT NULL DEFAULT '[]',
      faction_labels TEXT NOT NULL DEFAULT '[]',
      status_labels TEXT NOT NULL DEFAULT '[]',
      emotion_labels TEXT NOT NULL DEFAULT '[]',
      daily_goal INTEGER NOT NULL DEFAULT 6000,
      daily_goal_mode TEXT NOT NULL DEFAULT 'follow_system' CHECK(daily_goal_mode IN ('follow_system', 'custom')),
      sensitive_list TEXT NOT NULL DEFAULT 'default',
      ai_api_key TEXT NOT NULL DEFAULT '',
      ai_api_endpoint TEXT NOT NULL DEFAULT '',
      ai_model TEXT NOT NULL DEFAULT '',
      ai_provider TEXT NOT NULL DEFAULT 'openai',
      editor_font TEXT NOT NULL DEFAULT 'serif',
      editor_font_size INTEGER NOT NULL DEFAULT 19,
      editor_line_height REAL NOT NULL DEFAULT 2.2,
      editor_width TEXT NOT NULL DEFAULT 'standard',
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

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

    CREATE INDEX IF NOT EXISTS idx_ai_accounts_default ON ai_accounts(is_default);
    CREATE INDEX IF NOT EXISTS idx_ai_work_profiles_book ON ai_work_profiles(book_id);
    CREATE INDEX IF NOT EXISTS idx_ai_skill_overrides_book ON ai_skill_overrides(book_id);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_book ON ai_conversations(book_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_drafts_book_status ON ai_drafts(book_id, status, created_at);

    -- DI-02 v1: 学术引文管理 (与 migration v22 等价的全量 schema)
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

    CREATE TABLE IF NOT EXISTS volumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volume_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      faction TEXT NOT NULL DEFAULT 'neutral',
      status TEXT NOT NULL DEFAULT 'active',
      custom_fields TEXT NOT NULL DEFAULT '{}',
      description TEXT NOT NULL DEFAULT '',
      avatar_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS character_appearances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      chapter_id INTEGER NOT NULL,
      UNIQUE(character_id, chapter_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

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

    CREATE TABLE IF NOT EXISTS plotlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#10b981',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plot_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN -5 AND 5),
      node_type TEXT NOT NULL DEFAULT 'main',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      plotline_id INTEGER DEFAULT NULL REFERENCES plotlines(id) ON DELETE SET NULL,
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

    CREATE TABLE IF NOT EXISTS foreshadowings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter_id INTEGER,
      text TEXT NOT NULL,
      expected_chapter INTEGER,
      expected_word_count INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','warning','resolved')),
      auto_suppressed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings_wiki (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      content TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(book_id, date),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

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

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapter_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      name TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

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

    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS custom_shortcuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL UNIQUE,
      keys TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      text_anchor TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS director_run_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      remote_run_id TEXT NOT NULL UNIQUE,
      seed TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT 'webnovel',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','running','paused','awaiting_accept','completed','failed','cancelled','quota_exceeded')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_director_run_links_book ON director_run_links(book_id, updated_at);

    CREATE TABLE IF NOT EXISTS ai_story_fact_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      source_type TEXT NOT NULL DEFAULT '',
      source_ref TEXT NOT NULL DEFAULT '',
      fact_kind TEXT NOT NULL
        CHECK(fact_kind IN ('character_status','character_motivation','character_secret','timeline','setting','clue','relationship')),
      subject TEXT NOT NULL DEFAULT '',
      fact_key TEXT NOT NULL DEFAULT '',
      value TEXT NOT NULL DEFAULT '',
      evidence TEXT NOT NULL DEFAULT '',
      confidence REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      chapter_number INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(book_id, source_type, source_ref, fact_kind, subject, fact_key, value),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_story_fact_proposals_book_status ON ai_story_fact_proposals(book_id, status, updated_at);

    CREATE TABLE IF NOT EXISTS ai_story_bible_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      compact_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_story_bible_snapshots_book ON ai_story_bible_snapshots(book_id, created_at);

    CREATE TABLE IF NOT EXISTS director_run_chapter_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      director_run_link_id INTEGER NOT NULL,
      remote_chapter_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','accepted','rejected','regenerating')),
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(director_run_link_id, remote_chapter_id),
      FOREIGN KEY (director_run_link_id) REFERENCES director_run_links(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_director_chapter_cache_run ON director_run_chapter_cache(director_run_link_id, chapter_index);

    CREATE TABLE IF NOT EXISTS visual_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      remote_run_id TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      local_path TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT '',
      sha256 TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      prompt_used TEXT NOT NULL DEFAULT '',
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','failed')),
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_visual_assets_book ON visual_assets(book_id, created_at);

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      command TEXT NOT NULL DEFAULT '',
      args TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('disabled','enabled','error')),
      readonly INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS mcp_canon_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      scope TEXT NOT NULL DEFAULT 'canon_pack',
      readonly INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(server_id, book_id, scope),
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mcp_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      book_id INTEGER,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok' CHECK(status IN ('ok','denied','error')),
      detail TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE SET NULL,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_book ON mcp_audit_log(book_id, created_at);

    CREATE TABLE IF NOT EXISTS team_project_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      owner_user_id TEXT NOT NULL DEFAULT '',
      linked_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(team_id, project_id)
    );
    CREATE INDEX IF NOT EXISTS idx_team_project_links_team ON team_project_links(team_id, updated_at);

    CREATE TABLE IF NOT EXISTS chapter_lock_mirrors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      locked_by TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(team_id, project_id, chapter_id)
    );
    CREATE INDEX IF NOT EXISTS idx_chapter_lock_mirrors_project ON chapter_lock_mirrors(project_id, chapter_id);

    CREATE TABLE IF NOT EXISTS chapter_review_mirrors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id TEXT NOT NULL UNIQUE,
      team_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      submitted_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      review_comments TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      decided_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chapter_review_mirrors_project ON chapter_review_mirrors(project_id, chapter_id, status);

    CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(title, content, content='chapters', content_rowid='id');

    CREATE INDEX IF NOT EXISTS idx_genre_templates_seed_slug ON genre_templates(is_seed, slug);

    CREATE TRIGGER IF NOT EXISTS chapters_ai AFTER INSERT ON chapters BEGIN
      INSERT INTO chapters_fts(rowid, title, content) VALUES (new.id, COALESCE(new.title, ''), COALESCE(new.content, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS chapters_ad AFTER DELETE ON chapters BEGIN
      INSERT INTO chapters_fts(chapters_fts, rowid, title, content) VALUES('delete', old.id, COALESCE(old.title, ''), COALESCE(old.content, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS chapters_au AFTER UPDATE ON chapters BEGIN
      INSERT INTO chapters_fts(chapters_fts, rowid, title, content) VALUES('delete', old.id, COALESCE(old.title, ''), COALESCE(old.content, ''));
      INSERT INTO chapters_fts(rowid, title, content) VALUES (new.id, COALESCE(new.title, ''), COALESCE(new.content, ''));
    END;
  `)
}

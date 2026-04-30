/**
 * SPLIT-008 — assistant-workflow public types.
 *
 * Schema rows for skill templates / overrides / work profile mirror the
 * SQLite tables and stay snake_case so callers can pass them straight
 * from window.api.* without re-mapping.
 */

export type AiSkillTemplate = {
  id: number
  key: string
  name: string
  description: string
  system_prompt: string
  user_prompt_template: string
  context_policy: string
  output_contract: string
  enabled_surfaces: string
  sort_order: number
  is_builtin: number
  created_at: string
  updated_at: string
}

export type AiSkillOverride = {
  id: number
  book_id: number
  skill_key: string
  name: string
  description: string
  system_prompt: string
  user_prompt_template: string
  context_policy: string
  output_contract: string
  enabled_surfaces: string
  created_at: string
  updated_at: string
}

export type AiWorkProfile = {
  id: number
  book_id: number
  style_guide: string
  genre_rules: string
  content_boundaries: string
  asset_rules: string
  rhythm_rules: string
  context_policy: string
  /** GP-01 v2 — 5 题材之一: webnovel | script | fiction | academic | professional */
  genre?: string
  /** DI-01 v2 — layer2.style-learning skill 的输出, 字符串化 JSON, 空串表示未学习 */
  style_fingerprint?: string
  /** DI-01 v2 — 题材包定制元数据 (academic 的引文风格 / professional 的归档号格式), 字符串化 JSON */
  genre_meta?: string
  /** DI-07 v1 — 用户手动锁定的关键设定数组, 字符串化 JSON (CanonLockEntry[]) */
  canon_pack_locks?: string
  created_at: string
  updated_at: string
}

/**
 * DI-07 v1 — Canon Pack 手动锁定条目
 *
 * 写作者在 AiSettingsModal "作品上下文" tab 的 CanonLocksSection 里手动维护,
 * world-consistency Skill 在检查时按 priority 决定: critical = 强校验/必抛冲突,
 * high = 警告, medium = 建议, low = 仅记录。
 */
export interface CanonLockEntry {
  id: string
  label: string
  value: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}

export type AiContextChipKind =
  | 'selection'
  | 'chapter'
  | 'characters'
  | 'foreshadowings'
  | 'plot_nodes'
  | 'local_rag'

export type AiContextChip = {
  id: string
  kind: AiContextChipKind
  label: string
  enabled: boolean
}

export type AiContextBlock = {
  chip: AiContextChip
  body: string
}

export type AiAssistantContext = {
  contextText: string
  chips: AiContextChip[]
  blocks?: AiContextBlock[]
}

/**
 * DI-07 v3.3 — Canon Pack contract version bump to v0.2.
 *
 * v0.2 adds three optional asset bundles so CG-A3 visual views and the
 * world-consistency Skill can reason over relationships, timeline events
 * and organization hierarchy. The fields are optional so v0.1 backend
 * Skills (which only inspected `canonPackLocks` on the work profile)
 * still parse a v0.2 pack without changes — they simply ignore unknown
 * keys.
 */
export type AiCanonPackVersion = 'canon-pack.v0.1' | 'canon-pack.v0.2'

export interface AiCanonPackRelation {
  fromId: string
  toId: string
  kind: string
  label?: string
  chapterRange?: [number, number]
  dynamic?: boolean
}

export interface AiCanonPackEvent {
  id: string
  title: string
  description?: string
  chapterNumber?: number
  eventType: 'plot' | 'character' | 'world' | 'foreshadow'
  importance: 'low' | 'normal' | 'high'
  relatedCharacterIds?: string[]
}

export interface AiCanonPackOrganization {
  id: string
  name: string
  description?: string
  parentId?: string
  orgType: 'group' | 'faction' | 'company' | 'department'
  memberIds?: string[]
}

export type AiCanonPack = {
  version: AiCanonPackVersion
  bookId: number
  style: {
    styleGuide?: string
    genreRules?: string
    contentBoundaries?: string
    assetRules?: string
    rhythmRules?: string
  }
  scene: {
    selectedText?: string
    currentChapter?: {
      id: string
      title: string
      excerpt: string
    }
  }
  assets: {
    characters: Array<{ id: string; name: string; description?: string }>
    foreshadowings: Array<{ id: string; text: string; status: string }>
    plotNodes: Array<{ id: string; title: string; description?: string; chapterNumber?: number }>
    /** DI-07 v3.3 — optional in v0.2; absent in v0.1 packs. */
    relations?: AiCanonPackRelation[]
    /** DI-07 v3.3 — optional in v0.2; absent in v0.1 packs. */
    events?: AiCanonPackEvent[]
    /** DI-07 v3.3 — optional in v0.2; absent in v0.1 packs. */
    organizations?: AiCanonPackOrganization[]
  }
  retrieval: {
    mode: 'local_keyword' | 'off'
    citations: Array<{ ref: string; sourceId: string; title?: string; excerpt: string; score?: number }>
  }
  provenance: {
    source: 'desktop-local'
    generatedAt: string
    userConfirmedOnly: boolean
  }
}

export type AiSelectionSnapshot = {
  chapterId: number | null
  text: string
  from: number | null
  to: number | null
}

// 生成 AiDraftKind 时同步更新 src/main/database/schema.ts 的 CHECK 约束与 migration v19。
// 8 类通用虚构创作向 + 5 类 academic/professional 专属（GP-05）。
// academic/professional 专属 kind 在 v1.5.x 仅做 schema/parse 层兼容（让 AI 输出能落库），
// 实际 applyDraft 副作用由 DI-02 引用管理 / DI-05 公文格式模板分别落地。
export type AiDraftKind =
  | 'insert_text'
  | 'replace_text'
  | 'create_chapter'
  | 'update_chapter_summary'
  | 'create_character'
  | 'create_wiki_entry'
  | 'create_plot_node'
  | 'create_foreshadowing'
  | 'create_citation'
  | 'create_reference'
  | 'create_section_outline'
  | 'apply_format_template'
  | 'create_policy_anchor'

export type AiDraftPayload = Record<string, unknown> & {
  kind: AiDraftKind
}

export const ALLOWED_DRAFT_KINDS = new Set<AiDraftKind>([
  'insert_text',
  'replace_text',
  'create_chapter',
  'update_chapter_summary',
  'create_character',
  'create_wiki_entry',
  'create_plot_node',
  'create_foreshadowing',
  'create_citation',
  'create_reference',
  'create_section_outline',
  'apply_format_template',
  'create_policy_anchor'
])

export type AiTextDraftApplicationPlan =
  | {
      kind: 'insert_text'
      content: string
      insertAt: number | null
    }
  | {
      kind: 'replace_text'
      content: string
      chapterId: number
      from: number
      to: number
      expectedText: string
    }
  | {
      kind: 'invalid'
      error: string
    }

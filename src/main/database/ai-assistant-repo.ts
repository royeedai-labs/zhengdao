import { getDb } from './connection'

export type AiDraftStatus = 'pending' | 'applied' | 'dismissed'
export const DEFAULT_AI_CONVERSATION_TITLE = 'AI 对话'
const AI_OFFICIAL_PROFILE_ID_KEY = 'ai_official_profile_id'
const AI_THIRD_PARTY_ENABLED_KEY = 'ai_third_party_enabled'

const DEFAULT_PROFILE = {
  style_guide: '',
  genre_rules: '',
  content_boundaries: '',
  asset_rules: '',
  rhythm_rules: '',
  context_policy: 'smart_minimal'
}

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

type SafeStorageLike = {
  isEncryptionAvailable: () => boolean
  encryptString: (value: string) => Buffer
  decryptString: (buffer: Buffer) => string
}

function getSafeStorage(): SafeStorageLike | null {
  try {
    // Electron safeStorage is only available in the desktop main process.
    // Tests and non-Electron runtimes should transparently fall back.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { safeStorage?: SafeStorageLike }
    return electron.safeStorage || null
  } catch {
    return null
  }
}

function encodeSecret(value: string): string {
  const safeStorage = getSafeStorage()
  if (safeStorage?.isEncryptionAvailable()) {
    try {
      return `safe-storage:${safeStorage.encryptString(value).toString('base64')}`
    } catch {
      return value
    }
  }
  return value
}

function decodeSecret(value: string): string {
  if (!value.startsWith('safe-storage:')) return value

  const safeStorage = getSafeStorage()
  if (!safeStorage?.isEncryptionAvailable()) return ''

  try {
    const encoded = value.slice('safe-storage:'.length)
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return ''
  }
}

function normalizeConversationTitle(title: string): string {
  const oneLine = title.replace(/\s+/g, ' ').trim()
  if (!oneLine) return DEFAULT_AI_CONVERSATION_TITLE
  return oneLine.length > 32 ? `${oneLine.slice(0, 31)}…` : oneLine
}

function deriveAiConversationTitle(content: string): string {
  return normalizeConversationTitle(content)
}

function upsertAppState(key: string, value: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, encodeSecret(value))
}

function getAppState(key: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key) as { value?: string } | undefined
  const raw = row?.value || ''
  const decoded = decodeSecret(raw)
  if (raw && decoded && raw === decoded) {
    const safeStorage = getSafeStorage()
    if (safeStorage?.isEncryptionAvailable()) {
      upsertAppState(key, decoded)
    }
  }
  return decoded
}

function deleteAppState(key: string): void {
  getDb().prepare('DELETE FROM app_state WHERE key = ?').run(key)
}

function resolveCredential(ref: string): string {
  if (!ref) return ''
  if (ref.startsWith('legacy-project-config:')) {
    const bookId = Number(ref.slice('legacy-project-config:'.length))
    if (!Number.isFinite(bookId)) return ''
    const row = getDb().prepare('SELECT ai_api_key FROM project_config WHERE book_id = ?').get(bookId) as
      | { ai_api_key?: string }
      | undefined
    return row?.ai_api_key || ''
  }
  if (ref.startsWith('app-state:')) {
    return getAppState(ref.slice('app-state:'.length))
  }
  return ''
}

export function getAiAccounts() {
  const db = getDb()
  return db
    .prepare(
      `SELECT
        id,
        name,
        provider,
        api_endpoint,
        model,
        status,
        is_default,
        created_at,
        updated_at,
        CASE WHEN credential_ref <> '' THEN 1 ELSE 0 END AS has_secret
       FROM ai_accounts
       ORDER BY is_default DESC, id`
    )
    .all()
}

export function getAiAccountRuntimeConfig(accountId: number) {
  const account = getDb().prepare('SELECT * FROM ai_accounts WHERE id = ?').get(accountId) as
    | {
        id: number
        provider: string
        api_endpoint: string
        model: string
        credential_ref: string
      }
    | undefined

  if (!account) return null
  return {
    ai_provider: account.provider || 'openai',
    ai_api_key: resolveCredential(account.credential_ref || ''),
    ai_api_endpoint: account.api_endpoint || '',
    ai_model: account.model || ''
  }
}

export function saveAiAccount(data: {
  id?: number | null
  name: string
  provider: string
  api_endpoint?: string
  model?: string
  api_key?: string
  is_default?: number | boolean
}) {
  const db = getDb()
  const isDefault = data.is_default ? 1 : 0
  if (isDefault) db.prepare('UPDATE ai_accounts SET is_default = 0').run()

  if (data.id) {
    const existing = db.prepare('SELECT credential_ref FROM ai_accounts WHERE id = ?').get(data.id) as
      | { credential_ref: string }
      | undefined
    const credentialRef = data.api_key
      ? `app-state:ai_account_secret:${data.id}`
      : existing?.credential_ref || ''
    db.prepare(
      `UPDATE ai_accounts SET
        name = ?, provider = ?, api_endpoint = ?, model = ?, credential_ref = ?,
        is_default = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      data.name.trim() || 'AI 账号',
      data.provider || 'openai',
      data.api_endpoint || '',
      data.model || '',
      credentialRef,
      isDefault,
      data.id
    )
    if (data.api_key) upsertAppState(`ai_account_secret:${data.id}`, data.api_key)
    return db.prepare('SELECT * FROM ai_accounts WHERE id = ?').get(data.id)
  }

  const result = db
    .prepare(
      `INSERT INTO ai_accounts (name, provider, api_endpoint, model, credential_ref, is_default, status)
       VALUES (?, ?, ?, ?, '', ?, 'unknown')`
    )
    .run(data.name.trim() || 'AI 账号', data.provider || 'openai', data.api_endpoint || '', data.model || '', isDefault)
  const id = Number(result.lastInsertRowid)
  const credentialRef = data.api_key ? `app-state:ai_account_secret:${id}` : ''
  if (credentialRef) {
    upsertAppState(`ai_account_secret:${id}`, data.api_key || '')
    db.prepare('UPDATE ai_accounts SET credential_ref = ? WHERE id = ?').run(credentialRef, id)
  }
  return db.prepare('SELECT * FROM ai_accounts WHERE id = ?').get(id)
}

export function deleteAiAccount(id: number) {
  const db = getDb()
  const existing = db.prepare('SELECT credential_ref FROM ai_accounts WHERE id = ?').get(id) as
    | { credential_ref?: string }
    | undefined
  const credentialRef = existing?.credential_ref || ''
  if (credentialRef.startsWith('app-state:')) {
    deleteAppState(credentialRef.slice('app-state:'.length))
  }
  db.prepare('UPDATE ai_work_profiles SET default_account_id = NULL WHERE default_account_id = ?').run(id)
  db.prepare('DELETE FROM ai_accounts WHERE id = ?').run(id)
}

export function getAiSkillTemplates() {
  return getDb().prepare('SELECT * FROM ai_skill_templates ORDER BY sort_order, key').all()
}

export function updateAiSkillTemplate(key: string, updates: Record<string, unknown>) {
  const allowed = [
    'name',
    'description',
    'system_prompt',
    'user_prompt_template',
    'context_policy',
    'output_contract',
    'enabled_surfaces'
  ]
  const fields: string[] = []
  const values: unknown[] = []
  for (const field of allowed) {
    if (field in updates) {
      fields.push(`${field} = ?`)
      values.push(updates[field] ?? '')
    }
  }
  if (fields.length === 0) return getDb().prepare('SELECT * FROM ai_skill_templates WHERE key = ?').get(key)
  fields.push("updated_at = datetime('now','localtime')")
  values.push(key)
  getDb().prepare(`UPDATE ai_skill_templates SET ${fields.join(', ')} WHERE key = ?`).run(...values)
  return getDb().prepare('SELECT * FROM ai_skill_templates WHERE key = ?').get(key)
}

export function getAiWorkProfile(bookId: number) {
  const db = getDb()
  let profile = db.prepare('SELECT * FROM ai_work_profiles WHERE book_id = ?').get(bookId)
  if (!profile) {
    db.prepare(
      `INSERT INTO ai_work_profiles (
        book_id, default_account_id, style_guide, genre_rules, content_boundaries,
        asset_rules, rhythm_rules, context_policy
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bookId,
      null,
      DEFAULT_PROFILE.style_guide,
      DEFAULT_PROFILE.genre_rules,
      DEFAULT_PROFILE.content_boundaries,
      DEFAULT_PROFILE.asset_rules,
      DEFAULT_PROFILE.rhythm_rules,
      DEFAULT_PROFILE.context_policy
    )
    profile = db.prepare('SELECT * FROM ai_work_profiles WHERE book_id = ?').get(bookId)
  }
  return profile
}

export function saveAiWorkProfile(bookId: number, updates: Record<string, unknown>) {
  getAiWorkProfile(bookId)
  const allowed = [
    'style_guide',
    'genre_rules',
    'content_boundaries',
    'asset_rules',
    'rhythm_rules',
    'context_policy'
  ]
  const fields: string[] = []
  const values: unknown[] = []
  if ('default_account_id' in updates) {
    fields.push('default_account_id = NULL')
  }
  for (const field of allowed) {
    if (field in updates) {
      fields.push(`${field} = ?`)
      values.push(updates[field] ?? (field === 'context_policy' ? 'smart_minimal' : ''))
    }
  }
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now','localtime')")
    values.push(bookId)
    getDb().prepare(`UPDATE ai_work_profiles SET ${fields.join(', ')} WHERE book_id = ?`).run(...values)
  }
  return getAiWorkProfile(bookId)
}

function getDefaultAiAccountRuntimeConfig() {
  const row = getDb().prepare('SELECT id FROM ai_accounts ORDER BY is_default DESC, id LIMIT 1').get() as
    | { id?: number }
    | undefined
  return row?.id ? getAiAccountRuntimeConfig(row.id) : null
}

export function getAiSkillOverrides(bookId: number) {
  return getDb().prepare('SELECT * FROM ai_skill_overrides WHERE book_id = ? ORDER BY skill_key').all(bookId)
}

export function upsertAiSkillOverride(bookId: number, skillKey: string, updates: Record<string, unknown>) {
  const payload = {
    name: String(updates.name || ''),
    description: String(updates.description || ''),
    system_prompt: String(updates.system_prompt || ''),
    user_prompt_template: String(updates.user_prompt_template || ''),
    context_policy: String(updates.context_policy || ''),
    output_contract: String(updates.output_contract || ''),
    enabled_surfaces: String(updates.enabled_surfaces || '')
  }
  getDb()
    .prepare(
      `INSERT INTO ai_skill_overrides (
        book_id, skill_key, name, description, system_prompt, user_prompt_template,
        context_policy, output_contract, enabled_surfaces
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id, skill_key) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        system_prompt = excluded.system_prompt,
        user_prompt_template = excluded.user_prompt_template,
        context_policy = excluded.context_policy,
        output_contract = excluded.output_contract,
        enabled_surfaces = excluded.enabled_surfaces,
        updated_at = datetime('now','localtime')`
    )
    .run(
      bookId,
      skillKey,
      payload.name,
      payload.description,
      payload.system_prompt,
      payload.user_prompt_template,
      payload.context_policy,
      payload.output_contract,
      payload.enabled_surfaces
    )
  return getDb()
    .prepare('SELECT * FROM ai_skill_overrides WHERE book_id = ? AND skill_key = ?')
    .get(bookId, skillKey)
}

export function deleteAiSkillOverride(bookId: number, skillKey: string) {
  getDb().prepare('DELETE FROM ai_skill_overrides WHERE book_id = ? AND skill_key = ?').run(bookId, skillKey)
}

export function getOrCreateAiConversation(bookId: number) {
  const db = getDb()
  let row = db.prepare('SELECT * FROM ai_conversations WHERE book_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1').get(bookId)
  if (!row) {
    row = createAiConversation(bookId)
  }
  return row
}

export function createAiConversation(bookId: number) {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO ai_conversations (book_id, title) VALUES (?, ?)')
    .run(bookId, DEFAULT_AI_CONVERSATION_TITLE)
  return db.prepare('SELECT * FROM ai_conversations WHERE id = ?').get(result.lastInsertRowid)
}

export function getAiConversations(bookId: number) {
  return getDb()
    .prepare(
      `SELECT
        conversation.*,
        COUNT(message.id) AS message_count
       FROM ai_conversations conversation
       LEFT JOIN ai_messages message ON message.conversation_id = conversation.id
       WHERE conversation.book_id = ?
       GROUP BY conversation.id
       ORDER BY conversation.updated_at DESC, conversation.id DESC`
    )
    .all(bookId)
}

export function clearAiConversation(conversationId: number) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM ai_drafts WHERE conversation_id = ? AND status = 'pending'").run(conversationId)
    db.prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(conversationId)
    db.prepare(
      "UPDATE ai_conversations SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(DEFAULT_AI_CONVERSATION_TITLE, conversationId)
  })
  tx()
}

export function deleteAiConversation(conversationId: number) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM ai_drafts WHERE conversation_id = ?').run(conversationId)
    db.prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(conversationId)
    db.prepare('DELETE FROM ai_conversations WHERE id = ?').run(conversationId)
  })
  tx()
}

export function getAiMessages(conversationId: number) {
  return getDb()
    .prepare('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, id')
    .all(conversationId)
    .map((row: any) => ({ ...row, metadata: parseJson(row.metadata, {}) }))
}

export function addAiMessage(conversationId: number, role: 'user' | 'assistant' | 'system', content: string, metadata?: unknown) {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO ai_messages (conversation_id, role, content, metadata) VALUES (?, ?, ?, ?)')
    .run(conversationId, role, content, stringify(metadata))
  db.prepare("UPDATE ai_conversations SET updated_at = datetime('now','localtime') WHERE id = ?").run(conversationId)
  if (role === 'user') {
    const conversation = db.prepare('SELECT title FROM ai_conversations WHERE id = ?').get(conversationId) as
      | { title?: string }
      | undefined
    const title = conversation?.title?.trim() || ''
    if (!title || title === DEFAULT_AI_CONVERSATION_TITLE) {
      db.prepare(
        "UPDATE ai_conversations SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(deriveAiConversationTitle(content), conversationId)
    }
  }
  return db.prepare('SELECT * FROM ai_messages WHERE id = ?').get(result.lastInsertRowid)
}

export function updateAiConversationTitle(conversationId: number, title: string) {
  const normalized = normalizeConversationTitle(title)
  getDb()
    .prepare("UPDATE ai_conversations SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(normalized, conversationId)
  return getDb().prepare('SELECT * FROM ai_conversations WHERE id = ?').get(conversationId)
}

export function getAiDrafts(
  bookId: number,
  status: AiDraftStatus | 'all' = 'pending',
  conversationId?: number | null
) {
  const filters = ['book_id = ?']
  const args: Array<number | string> = [bookId]
  if (status !== 'all') {
    filters.push('status = ?')
    args.push(status)
  }
  if (conversationId != null) {
    filters.push('conversation_id = ?')
    args.push(conversationId)
  }
  return getDb()
    .prepare(`SELECT * FROM ai_drafts WHERE ${filters.join(' AND ')} ORDER BY created_at DESC, id DESC`)
    .all(...args)
    .map((row: any) => ({ ...row, payload: parseJson(row.payload, {}) }))
}

export function createAiDraft(data: {
  book_id: number
  conversation_id?: number | null
  message_id?: number | null
  kind: string
  title?: string
  payload: unknown
  target_ref?: string
}) {
  const result = getDb()
    .prepare(
      `INSERT INTO ai_drafts (book_id, conversation_id, message_id, kind, title, payload, target_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.book_id,
      data.conversation_id ?? null,
      data.message_id ?? null,
      data.kind,
      data.title || '',
      stringify(data.payload),
      data.target_ref || ''
    )
  const row = getDb().prepare('SELECT * FROM ai_drafts WHERE id = ?').get(result.lastInsertRowid) as any
  return { ...row, payload: parseJson(row.payload, {}) }
}

export function setAiDraftStatus(id: number, status: AiDraftStatus) {
  getDb()
    .prepare("UPDATE ai_drafts SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(status, id)
}

export function getResolvedAiConfigForBook(_bookId: number) {
  const thirdPartyEnabled = getAppState(AI_THIRD_PARTY_ENABLED_KEY) === '1'
  const account = thirdPartyEnabled ? getDefaultAiAccountRuntimeConfig() : null

  if (account) {
    return {
      ai_provider: account.ai_provider,
      ai_api_key: account.ai_api_key,
      ai_api_endpoint: account.ai_api_endpoint,
      ai_model: account.ai_model,
      ai_official_profile_id: ''
    }
  }

  return {
    ai_provider: 'zhengdao_official',
    ai_api_key: '',
    ai_api_endpoint: '',
    ai_model: '',
    ai_official_profile_id: getAppState(AI_OFFICIAL_PROFILE_ID_KEY)
  }
}

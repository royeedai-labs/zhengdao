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
  default_account_id: number | null
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
 * 写作者在 AiSettingsModal "作品 AI 档案" tab 的 CanonLocksSection 里手动维护,
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

export type AiContextChipKind = 'selection' | 'chapter' | 'characters' | 'foreshadowings' | 'plot_nodes' | 'local_rag'

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

export type AiCanonPack = {
  version: 'canon-pack.v0.1'
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

const ALLOWED_DRAFT_KINDS = new Set<AiDraftKind>([
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

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function clip(value: string, maxChars: number): string {
  const text = value.trim()
  if (text.length <= maxChars) return text
  const head = Math.floor(maxChars * 0.35)
  const tail = maxChars - head
  return `${text.slice(0, head)}\n...[已裁剪]...\n${text.slice(-tail)}`
}

function section(title: string, body: string | null | undefined): string {
  if (!nonEmpty(body)) return ''
  return `## ${title}\n${body!.trim()}`
}

function buildContextText(blocks: AiContextBlock[]): string {
  return blocks
    .filter((block) => block.chip.enabled && nonEmpty(block.body))
    .map((block) => block.body)
    .join('\n\n')
}

export function buildDesktopCanonPack(input: {
  bookId: number
  profile?: AiWorkProfile | null
  currentChapter?: { id: number; title: string; plainText: string } | null
  selectedText?: string
  characters?: Array<{ id: number; name: string; description?: string }>
  foreshadowings?: Array<{ id: number; text: string; status: string }>
  plotNodes?: Array<{ id: number; title: string; description?: string; chapter_number?: number }>
  localCitations?: Array<{ ref: string; sourceId: string; title?: string; excerpt: string; score?: number }>
  generatedAt?: string
}): AiCanonPack {
  const profile = input.profile
  return {
    version: 'canon-pack.v0.1',
    bookId: input.bookId,
    style: {
      styleGuide: profile?.style_guide || undefined,
      genreRules: profile?.genre_rules || undefined,
      contentBoundaries: profile?.content_boundaries || undefined,
      assetRules: profile?.asset_rules || undefined,
      rhythmRules: profile?.rhythm_rules || undefined
    },
    scene: {
      selectedText: nonEmpty(input.selectedText) ? clip(input.selectedText || '', 1600) : undefined,
      currentChapter: input.currentChapter
        ? {
            id: String(input.currentChapter.id),
            title: input.currentChapter.title,
            excerpt: clip(input.currentChapter.plainText || '', 2600)
          }
        : undefined
    },
    assets: {
      characters: (input.characters || []).slice(0, 20).map((character) => ({
        id: String(character.id),
        name: character.name,
        description: nonEmpty(character.description) ? character.description : undefined
      })),
      foreshadowings: (input.foreshadowings || []).slice(0, 20).map((item) => ({
        id: String(item.id),
        text: item.text,
        status: item.status
      })),
      plotNodes: (input.plotNodes || []).slice(0, 20).map((node) => ({
        id: String(node.id),
        title: node.title,
        description: nonEmpty(node.description) ? node.description : undefined,
        chapterNumber: node.chapter_number
      }))
    },
    retrieval: {
      mode: (input.localCitations || []).length > 0 ? 'local_keyword' : 'off',
      citations: input.localCitations || []
    },
    provenance: {
      source: 'desktop-local',
      generatedAt: input.generatedAt || new Date().toISOString(),
      userConfirmedOnly: true
    }
  }
}

function normalizeMatchCandidate(value: string, maxLength = 24): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function isMentioned(source: string, candidate: string): boolean {
  const haystack = source.replace(/\s+/g, ' ').trim()
  const needle = normalizeMatchCandidate(candidate)
  if (!haystack || !needle || needle.length < 2) return false
  return haystack.includes(needle)
}

function createContextBlock(input: {
  id: string
  kind: AiContextChipKind
  label: string
  enabled: boolean
  body: string
}): AiContextBlock | null {
  if (!nonEmpty(input.body)) return null
  return {
    chip: {
      id: input.id,
      kind: input.kind,
      label: input.label,
      enabled: input.enabled
    },
    body: input.body
  }
}

export function applyAssistantContextSelection(
  context: AiAssistantContext,
  enabledChipIds: Iterable<string>
): AiAssistantContext {
  if (!context.blocks) return context

  const enabled = new Set(enabledChipIds)
  const blocks = context.blocks.map((block) => ({
    ...block,
    chip: {
      ...block.chip,
      enabled: enabled.has(block.chip.id)
    }
  }))

  return {
    ...context,
    blocks,
    chips: blocks.map((block) => block.chip),
    contextText: buildContextText(blocks)
  }
}

export function resolveSkillForBook(
  base: AiSkillTemplate,
  override?: AiSkillOverride | null
): AiSkillTemplate {
  if (!override) return base
  return {
    ...base,
    name: nonEmpty(override.name) ? override.name : base.name,
    description: nonEmpty(override.description) ? override.description : base.description,
    system_prompt: nonEmpty(override.system_prompt) ? override.system_prompt : base.system_prompt,
    user_prompt_template: nonEmpty(override.user_prompt_template)
      ? override.user_prompt_template
      : base.user_prompt_template,
    context_policy: nonEmpty(override.context_policy) ? override.context_policy : base.context_policy,
    output_contract: nonEmpty(override.output_contract) ? override.output_contract : base.output_contract,
    enabled_surfaces: nonEmpty(override.enabled_surfaces)
      ? override.enabled_surfaces
      : base.enabled_surfaces
  }
}

export function resolveAssistantContextPolicy(
  skill?: Pick<AiSkillTemplate, 'context_policy'> | null,
  profile?: Pick<AiWorkProfile, 'context_policy'> | null
): string {
  if (nonEmpty(skill?.context_policy)) return skill!.context_policy.trim()
  if (nonEmpty(profile?.context_policy)) return profile!.context_policy.trim()
  return 'smart_minimal'
}

export function buildAssistantContext(input: {
  policy: 'smart_minimal' | 'manual' | 'full' | string
  currentChapter?: { id: number; title: string; plainText: string } | null
  selectedText?: string
  characters?: Array<{ id: number; name: string; description?: string }>
  foreshadowings?: Array<{ id: number; text: string; status: string }>
  plotNodes?: Array<{ id: number; title: string; description?: string; chapter_number?: number }>
}): AiAssistantContext {
  const policy = input.policy || 'smart_minimal'
  const maxChapterChars = policy === 'full' ? 16000 : 2600
  const defaultEnabled = policy !== 'manual'
  const referenceText = `${input.selectedText || ''}\n${input.currentChapter?.plainText || ''}`.trim()
  const blocks: AiContextBlock[] = []

  const selectionBlock = createContextBlock({
    id: 'selection',
    kind: 'selection',
    label: '选中文本',
    enabled: defaultEnabled,
    body: section('选中文本', clip(input.selectedText || '', 1600))
  })
  if (selectionBlock) blocks.push(selectionBlock)

  const chapterBlock = input.currentChapter
    ? createContextBlock({
        id: `chapter:${input.currentChapter.id}`,
        kind: 'chapter',
        label: input.currentChapter.title,
        enabled: defaultEnabled,
        body: section(
          `当前章节：${input.currentChapter.title}`,
          clip(input.currentChapter.plainText || '', maxChapterChars)
        )
      })
    : null
  if (chapterBlock) blocks.push(chapterBlock)

  const rawCharacters =
    policy === 'smart_minimal'
      ? (input.characters || []).filter((character) => isMentioned(referenceText, character.name)).slice(0, 10)
      : (input.characters || []).slice(0, policy === 'full' ? 20 : 12)
  const charactersBlock = createContextBlock({
    id: 'characters',
    kind: 'characters',
    label: '角色',
    enabled: defaultEnabled,
    body: section(
      '角色',
      rawCharacters
        .map((character) => `- ${character.name}${character.description ? `：${character.description}` : ''}`)
        .join('\n')
    )
  })
  if (charactersBlock) blocks.push(charactersBlock)

  const rawForeshadowings =
    policy === 'smart_minimal'
      ? (input.foreshadowings || []).filter((item) => isMentioned(referenceText, item.text)).slice(0, 8)
      : (input.foreshadowings || []).slice(0, policy === 'full' ? 16 : 10)
  const foreshadowingsBlock = createContextBlock({
    id: 'foreshadowings',
    kind: 'foreshadowings',
    label: '伏笔',
    enabled: defaultEnabled,
    body: section(
      '伏笔',
      rawForeshadowings
        .map((item) => `- [${item.status}] ${item.text}`)
        .join('\n')
    )
  })
  if (foreshadowingsBlock) blocks.push(foreshadowingsBlock)

  const rawPlotNodes =
    policy === 'smart_minimal'
      ? (input.plotNodes || [])
          .filter((node) => isMentioned(referenceText, node.title) || isMentioned(referenceText, node.description || ''))
          .slice(0, 8)
      : (input.plotNodes || []).slice(0, policy === 'full' ? 16 : 10)
  const plotNodesBlock = createContextBlock({
    id: 'plot_nodes',
    kind: 'plot_nodes',
    label: '剧情节点',
    enabled: defaultEnabled,
    body: section(
      '剧情节点',
      rawPlotNodes
        .map((node) => `- Ch${node.chapter_number ?? '?'} ${node.title}${node.description ? `：${node.description}` : ''}`)
        .join('\n')
    )
  })
  if (plotNodesBlock) blocks.push(plotNodesBlock)

  return {
    blocks,
    chips: blocks.map((block) => block.chip),
    contextText: buildContextText(blocks)
  }
}

export function composeSkillPrompt(input: {
  skill: AiSkillTemplate
  profile?: AiWorkProfile | null
  context: AiAssistantContext
  userInput: string
}): { systemPrompt: string; userPrompt: string } {
  const profile = input.profile
  const systemBlocks = [
    input.skill.system_prompt.trim(),
    section('本作品文风', profile?.style_guide),
    section('题材规则', profile?.genre_rules),
    section('内容边界', profile?.content_boundaries),
    section('资产生成规则', profile?.asset_rules),
    section('章节节奏', profile?.rhythm_rules),
    section('输出契约', input.skill.output_contract)
  ].filter(Boolean)

  const chipLine =
    input.context.chips.length > 0
      ? `已附上下文：${input.context.chips.filter((chip) => chip.enabled).map((chip) => chip.label).join('、')}`
      : ''
  const templated = input.skill.user_prompt_template.replace(/\{\{\s*input\s*\}\}/g, input.userInput.trim())
  const userBlocks = [templated, chipLine, input.context.contextText ? `## 上下文\n${input.context.contextText}` : '']
  if (input.skill.output_contract !== 'plain_text') {
    userBlocks.unshift('请严格只返回一个可解析的 JSON 对象，不要附加解释、标题或 Markdown。')
  }

  return {
    systemPrompt: systemBlocks.join('\n\n'),
    userPrompt: userBlocks.filter(Boolean).join('\n\n')
  }
}

export function composeAssistantChatPrompt(input: {
  profile?: AiWorkProfile | null
  context: AiAssistantContext
  skills?: Array<Pick<AiSkillTemplate, 'name' | 'description'>>
  userInput: string
}): { systemPrompt: string; userPrompt: string } {
  const profile = input.profile
  const skillList = (input.skills || [])
    .filter((skill) => nonEmpty(skill.name))
    .map((skill) => `- ${skill.name}${nonEmpty(skill.description) ? `：${skill.description.trim()}` : ''}`)
    .join('\n')
  const systemBlocks = [
    [
      '你是证道的 AI 创作助手，当前处于普通对话和自动识别模式。',
      '你需要根据用户自然语言自行判断意图，直接回答写作问题、解释配置、给出建议或分析当前上下文。',
      '默认不要直接写入作品，不要声称已经创建章节、正文或小说资产。',
      '如果用户要求生成正文、章节、角色、设定、伏笔或剧情节点，应给出可预览内容，并提醒正式写入仍需草稿篮确认。'
    ].join('\n'),
    section('本作品文风', profile?.style_guide),
    section('题材规则', profile?.genre_rules),
    section('内容边界', profile?.content_boundaries),
    section('可用能力卡', skillList)
  ].filter(Boolean)

  const chipLine =
    input.context.chips.length > 0
      ? `已附上下文：${input.context.chips.filter((chip) => chip.enabled).map((chip) => chip.label).join('、')}`
      : ''
  const userBlocks = [
    input.userInput.trim(),
    chipLine,
    input.context.contextText ? `## 上下文\n${input.context.contextText}` : ''
  ]

  return {
    systemPrompt: systemBlocks.join('\n\n'),
    userPrompt: userBlocks.filter(Boolean).join('\n\n')
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match ? match[1].trim() : trimmed
}

// LB-07: 严格 JSON.parse 优先；失败后用 JSON5 兜底解析（支持 trailing comma /
// 未加引号 key / 嵌入注释等 LLM 常见非严格输出）。
function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text)
  } catch {
    /* fall through to json5 lenient parse */
  }
  try {
    // Lazy import 避免顶部 import 循环和体积负担。
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSON5 = require('json5') as { parse: (input: string) => unknown }
    return JSON5.parse(text)
  } catch {
    return undefined
  }
}

function findEmbeddedJsonCandidate(text: string): string | null {
  for (let start = 0; start < text.length; start += 1) {
    const first = text[start]
    if (first !== '{' && first !== '[') continue

    const stack: string[] = [first]
    let inString = false
    let escaped = false

    for (let cursor = start + 1; cursor < text.length; cursor += 1) {
      const char = text[cursor]

      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (inString) continue

      if (char === '{' || char === '[') {
        stack.push(char)
        continue
      }

      if (char === '}' || char === ']') {
        const last = stack[stack.length - 1]
        if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
          stack.pop()
          if (stack.length === 0) {
            return text.slice(start, cursor + 1)
          }
        } else {
          break
        }
      }
    }
  }

  return null
}

function parseStructuredDraftPayload(text: string): unknown | undefined {
  const direct = tryParseJson(stripCodeFence(text))
  if (direct !== undefined) return direct

  for (const block of text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) {
    const parsed = tryParseJson(block[1].trim())
    if (parsed !== undefined) return parsed
  }

  const embedded = findEmbeddedJsonCandidate(text)
  return embedded ? tryParseJson(embedded) : undefined
}

export function parseAssistantDrafts(text: string): { drafts: AiDraftPayload[]; errors: string[] } {
  const errors: string[] = []
  const data = parseStructuredDraftPayload(text)
  if (data === undefined) {
    return { drafts: [], errors: ['AI 返回内容不是可解析的 JSON 草稿'] }
  }

  const rawDrafts = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { drafts?: unknown[] }).drafts)
      ? (data as { drafts: unknown[] }).drafts
      : []

  const drafts: AiDraftPayload[] = []
  for (const raw of rawDrafts) {
    if (!raw || typeof raw !== 'object') {
      errors.push('AI 草稿格式无效')
      continue
    }
    const draft = raw as Record<string, unknown>
    const kind = draft.kind
    if (typeof kind !== 'string' || !ALLOWED_DRAFT_KINDS.has(kind as AiDraftKind)) {
      errors.push(`不支持的 AI 草稿类型：${String(kind)}`)
      continue
    }
    drafts.push(draft as AiDraftPayload)
  }

  return { drafts, errors }
}

export function attachSelectionMetaToDrafts(
  drafts: AiDraftPayload[],
  selection: AiSelectionSnapshot
): AiDraftPayload[] {
  return drafts.map((draft) => {
    if (draft.kind === 'replace_text') {
      if (
        selection.chapterId == null ||
        selection.from == null ||
        selection.to == null ||
        !nonEmpty(selection.text)
      ) {
        return draft
      }
      return {
        ...draft,
        original_text: selection.text,
        selection_chapter_id: selection.chapterId,
        selection_from: selection.from,
        selection_to: selection.to
      }
    }

    if (draft.kind === 'insert_text') {
      if (selection.chapterId == null || selection.to == null) return draft
      return {
        ...draft,
        selection_chapter_id: selection.chapterId,
        selection_to: selection.to
      }
    }

    return draft
  })
}

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

export function planTextDraftApplication(
  draft: AiDraftPayload,
  currentChapterId: number | null
): AiTextDraftApplicationPlan | null {
  if (draft.kind !== 'insert_text' && draft.kind !== 'replace_text') return null

  const content = String(draft.content || '')
  if (!nonEmpty(content)) {
    return {
      kind: 'invalid',
      error: draft.kind === 'insert_text' ? '草稿正文为空' : '替换正文为空'
    }
  }

  if (draft.kind === 'insert_text') {
    const selectionChapterId = Number(draft.selection_chapter_id)
    const selectionTo = Number(draft.selection_to)
    const insertAt =
      Number.isFinite(selectionChapterId) &&
      Number.isFinite(selectionTo) &&
      currentChapterId != null &&
      selectionChapterId === currentChapterId
        ? selectionTo
        : null
    return { kind: 'insert_text', content, insertAt }
  }

  const selectionChapterId = Number(draft.selection_chapter_id)
  const selectionFrom = Number(draft.selection_from)
  const selectionTo = Number(draft.selection_to)
  const originalText = String(draft.original_text || '')

  if (
    !Number.isFinite(selectionChapterId) ||
    !Number.isFinite(selectionFrom) ||
    !Number.isFinite(selectionTo) ||
    selectionFrom < 0 ||
    selectionTo < selectionFrom ||
    !nonEmpty(originalText)
  ) {
    return {
      kind: 'invalid',
      error: 'AI 草稿缺少原始选区，不能直接替换正文，请重新生成。'
    }
  }

  if (currentChapterId == null || selectionChapterId !== currentChapterId) {
    return {
      kind: 'invalid',
      error: '当前章节与草稿目标不一致，请回到原章节后重新应用。'
    }
  }

  return {
    kind: 'replace_text',
    content,
    chapterId: selectionChapterId,
    from: selectionFrom,
    to: selectionTo,
    expectedText: originalText
  }
}

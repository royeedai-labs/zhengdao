import { coerceGenre, type Genre } from './genre'
import { normalizeRelationType } from './relation-types'

export type AssistantSurface =
  | 'bookshelf'
  | 'book_overview'
  | 'chapter_editor'
  | 'characters'
  | 'wiki'
  | 'foreshadow'
  | 'stats'
  | 'settings'

export type ResolvedAssistantContext = {
  surface: AssistantSurface
  title: string
  description: string
  quickActions: Array<{
    key: string
    label: string
    input: string
    disabled?: boolean
  }>
}

export type AssistantCreationBrief = {
  seedIdea?: string
  title?: string
  author?: string
  productGenre?: Genre
  genreTheme?: string
  coreConflict?: string
  targetLength?: string
  chapterPlan?: string
  characterPlan?: string
  styleAudiencePlatform?: string
  worldbuilding?: string
  boundaries?: string
  otherRequirements?: string
  confirmed?: boolean
}

export type AiBookCreationPackage = {
  book: {
    title: string
    author?: string
  }
  workProfile?: {
    productGenre?: Genre
    styleGuide?: string
    genreRules?: string
    contentBoundaries?: string
    assetRules?: string
    rhythmRules?: string
  }
  volumes: Array<{
    title: string
    chapters: Array<{
      title: string
      content: string
      summary?: string
    }>
  }>
  characters: Array<{
    name: string
    faction?: string
    status?: string
    description?: string
    customFields?: Record<string, string>
  }>
  relations?: AiBookCreationRelation[]
  wikiEntries: Array<{
    category: string
    title: string
    content: string
  }>
  plotNodes: Array<{
    chapterNumber?: number
    title: string
    score?: number
    nodeType?: 'main' | 'branch'
    description?: string
  }>
  foreshadowings: Array<{
    text: string
    expectedChapter?: number | null
    expectedWordCount?: number | null
  }>
}

export type AiBookCreationRelation = {
  sourceName?: string
  targetName?: string
  fromName?: string
  toName?: string
  source?: string
  target?: string
  from?: string
  to?: string
  relationType?: string
  relation_type?: string
  kind?: string
  type?: string
  label?: string
  note?: string
  remark?: string
  description?: string
}

export type NormalizedCreationRelation = {
  sourceName: string
  targetName: string
  relationType: string
  label: string
}

export const AI_BOOK_CREATION_MIN_CHAPTERS = 3
export const AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS = 2
export const AI_BOOK_CREATION_MIN_WIKI_ENTRIES = 2
export const AI_BOOK_CREATION_MIN_PLOT_NODES = 3
export const AI_BOOK_CREATION_MIN_FORESHADOWINGS = 1

export type AiBookCreationValidationOptions = {
  minCharacters?: number
  minChapters?: number
  minWikiEntries?: number
  minPlotNodes?: number
  minForeshadowings?: number
}

export type CreationBriefField = {
  key: keyof AssistantCreationBrief
  label: string
  prompt: string
  required: boolean
  multiSelect?: boolean
  quickOptions: string[]
}

export const CREATION_BRIEF_FIELDS: CreationBriefField[] = [
  {
    key: 'title',
    label: '书名（可选）',
    prompt: '已有书名就填写；没有就留空，AI 会先给暂定名。',
    required: false,
    quickOptions: ['AI 起暂定名', '先不定名', '我稍后改名']
  },
  {
    key: 'genreTheme',
    label: '题材与核心冲突（可选）',
    prompt: '写题材、主题、主角目标或主要冲突；不确定就让 AI 给方向。',
    required: false,
    multiSelect: true,
    quickOptions: ['现实生活', '都市职场', '重生逆袭', '悬疑推理', '家庭情感', 'AI 给方向']
  },
  {
    key: 'targetLength',
    label: '篇幅目标（可选）',
    prompt: '已有字数目标就填写；没有就让 AI 按题材估算。',
    required: false,
    quickOptions: ['10 万字以内', '10-30 万字', '30-100 万字', '100 万字以上', 'AI 估算篇幅']
  },
  {
    key: 'chapterPlan',
    label: '章节节奏（可选）',
    prompt: '说明章节数、单章字数或分卷节奏；不确定可留空。',
    required: false,
    quickOptions: ['10 章左右', '20 章左右', '25-30 章', '按篇幅自动规划', 'AI 规划章节']
  },
  {
    key: 'characterPlan',
    label: '人物关系（可选）',
    prompt: '说明主要人物、关系或角色功能；不确定可让 AI 写人物组。',
    required: false,
    multiSelect: true,
    quickOptions: ['普通中年男性', '退休老人', '创业者', '女性主角', '群像', 'AI 写人物组']
  },
  {
    key: 'styleAudiencePlatform',
    label: '风格与读者（可选）',
    prompt: '说明文风、目标读者或平台倾向；不确定可让 AI 给建议。',
    required: false,
    multiSelect: true,
    quickOptions: ['轻松治愈', '现实厚重', '强情节爽感', '悬疑反转', '女频向', '男频向', 'AI 建议平台']
  },
  {
    key: 'worldbuilding',
    label: '背景设定（可选）',
    prompt: '说明时代、地点、行业或特殊设定；现实题材可留空。',
    required: false,
    multiSelect: true,
    quickOptions: ['现实城市', '小镇熟人社会', '职场行业', '家庭社区', '轻幻想元素', 'AI 补设定']
  },
  {
    key: 'boundaries',
    label: '内容边界（可选）',
    prompt: '说明不想写的内容或尺度要求；没有可选“无明显禁区”。',
    required: false,
    multiSelect: true,
    quickOptions: ['无明显禁区', '不写血腥', '不写露骨内容', '不写真实机构', '不写过度苦情', '按平台规避']
  },
  {
    key: 'otherRequirements',
    label: '补充要求（可选）',
    prompt: '补充特殊要求；没有可留空。',
    required: false,
    multiSelect: true,
    quickOptions: ['无', '先让 AI 发挥', '需要强反转', '需要爽点密集', '需要现实质感']
  }
]

const SEED_IDEA_LABELS = ['故事灵感', '一句话灵感', '新作品灵感', '作品想法', '起书想法']

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBriefKey(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function cleanBriefField(raw: Record<string, unknown>, key: keyof AssistantCreationBrief): string {
  const direct = cleanText(raw[key])
  if (direct) return direct

  const field = CREATION_BRIEF_FIELDS.find((item) => item.key === key)
  if (!field) return ''
  const labelKey = normalizeBriefKey(field.label)
  const match = Object.entries(raw).find(([rawKey]) => normalizeBriefKey(rawKey) === labelKey)
  return cleanText(match?.[1])
}

function cleanSeedIdea(raw: Record<string, unknown>): string {
  const direct = cleanText(raw.seedIdea)
  if (direct) return direct
  const labels = new Set(SEED_IDEA_LABELS.map(normalizeBriefKey))
  const match = Object.entries(raw).find(([rawKey]) => labels.has(normalizeBriefKey(rawKey)))
  return cleanText(match?.[1])
}

export function normalizeCreationBrief(value: unknown): AssistantCreationBrief {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    seedIdea: cleanSeedIdea(raw),
    title: cleanBriefField(raw, 'title'),
    author: cleanBriefField(raw, 'author'),
    productGenre: raw.productGenre ? coerceGenre(raw.productGenre) : undefined,
    genreTheme: cleanBriefField(raw, 'genreTheme'),
    coreConflict: cleanBriefField(raw, 'coreConflict'),
    targetLength: cleanBriefField(raw, 'targetLength'),
    chapterPlan: cleanBriefField(raw, 'chapterPlan'),
    characterPlan: cleanBriefField(raw, 'characterPlan'),
    styleAudiencePlatform: cleanBriefField(raw, 'styleAudiencePlatform'),
    worldbuilding: cleanBriefField(raw, 'worldbuilding'),
    boundaries: cleanBriefField(raw, 'boundaries'),
    otherRequirements: cleanBriefField(raw, 'otherRequirements'),
    confirmed: raw.confirmed === true
  }
}

export function getCreationBriefMissingFields(brief: AssistantCreationBrief): CreationBriefField[] {
  const normalized = normalizeCreationBrief(brief)
  return CREATION_BRIEF_FIELDS.filter((field) => field.required).filter((field) => {
    const value = normalized[field.key]
    return typeof value !== 'string' || value.trim().length === 0
  })
}

export function hasCreationBriefInput(brief: AssistantCreationBrief): boolean {
  const normalized = normalizeCreationBrief(brief)
  if (String(normalized.seedIdea || '').trim()) return true
  return CREATION_BRIEF_FIELDS.some((field) => {
    const value = normalized[field.key]
    return typeof value === 'string' && value.trim().length > 0
  })
}

export function isCreationBriefComplete(brief: AssistantCreationBrief): boolean {
  return hasCreationBriefInput(brief)
}

export function isCreationBriefConfirmed(brief: AssistantCreationBrief): boolean {
  return isCreationBriefComplete(brief) && brief.confirmed === true
}

const CHINESE_NUMBER_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
}

function parseChineseSmallNumber(value: string): number {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  if (value === '十') return 10
  if (value.startsWith('十')) {
    return 10 + (CHINESE_NUMBER_MAP[value.slice(1)] || 0)
  }
  if (value.endsWith('十')) {
    return (CHINESE_NUMBER_MAP[value[0]] || 0) * 10
  }
  const tenIndex = value.indexOf('十')
  if (tenIndex > 0) {
    const high = CHINESE_NUMBER_MAP[value.slice(0, tenIndex)] || 0
    const low = CHINESE_NUMBER_MAP[value.slice(tenIndex + 1)] || 0
    return high * 10 + low
  }
  return CHINESE_NUMBER_MAP[value] || 0
}

function extractCharacterCountFromText(text: string): number {
  let count = 0
  const patterns = [
    /(\d+|[一二两三四五六七八九十]{1,3})\s*(?:个|位|名)\s*(?:关键|主要|核心|重要)?\s*(?:人|人物|角色|主角|配角|反派|老人|小伙|女性|男性)?/g,
    /(\d+|[一二两三四五六七八九十]{1,3})\s*(?:人|人物|角色|主角|配角|反派)/g
  ]
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseChineseSmallNumber(match[1] || '')
      if (parsed > count) count = parsed
    }
  }
  return count
}

export function extractCharacterPlanItems(value: string | undefined): string[] {
  const text = String(value || '')
    .replace(/让\s*AI\s*(?:写|生成|评估|发挥|代写).*/gi, '')
    .replace(/不确定.*/g, '')
    .trim()
  if (!text) return []

  return text
    .split(/[、,，/；;和与及+]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const numeric = /^(\d+|[一二两三四五六七八九十]{1,3})\s*(?:个|位|名)\s*(.+)$/.exec(item)
      if (!numeric) return [item]
      const count = parseChineseSmallNumber(numeric[1] || '')
      const label = (numeric[2] || '角色').replace(/^(?:关键|主要)?/, '').trim() || '角色'
      return Array.from({ length: Math.max(1, count) }, (_, index) =>
        count === 1 ? label : `${label}${index + 1}`
      )
    })
    .filter((item) => !/^(无|没有|暂无)$/.test(item))
}

export function getMinimumCharacterCount(briefInput?: AssistantCreationBrief | null): number {
  const brief = normalizeCreationBrief(briefInput || {})
  const characterPlan = String(brief.characterPlan || '').trim()
  const explicitCount = extractCharacterCountFromText(characterPlan)
  const itemCount = extractCharacterPlanItems(characterPlan).length
  const groupCount = /群像|人物组|角色组/.test(characterPlan) ? 4 : 0
  return Math.max(
    AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS,
    explicitCount,
    itemCount,
    groupCount
  )
}

function relationEndpoint(
  relation: AiBookCreationRelation,
  keys: Array<keyof AiBookCreationRelation>
): string {
  for (const key of keys) {
    const value = cleanOptionalText(relation[key])
    if (value) return value
  }
  return ''
}

function matchCharacterName(value: string, characterNames: string[]): string {
  const clean = value.trim()
  if (!clean) return ''
  const exact = characterNames.find((name) => name === clean)
  if (exact) return exact
  const lower = clean.toLowerCase()
  return characterNames.find((name) => name.toLowerCase() === lower) || ''
}

export function normalizeCreationRelation(
  relation: AiBookCreationRelation | null | undefined,
  characterNames: string[]
): NormalizedCreationRelation | null {
  if (!relation || typeof relation !== 'object') return null
  const source = matchCharacterName(
    relationEndpoint(relation, ['sourceName', 'fromName', 'source', 'from']),
    characterNames
  )
  const target = matchCharacterName(
    relationEndpoint(relation, ['targetName', 'toName', 'target', 'to']),
    characterNames
  )
  if (!source || !target || source === target) return null
  return {
    sourceName: source,
    targetName: target,
    relationType: normalizeRelationType(
      relation.relationType ?? relation.relation_type ?? relation.kind ?? relation.type
    ),
    label:
      cleanOptionalText(relation.label) ||
      cleanOptionalText(relation.note) ||
      cleanOptionalText(relation.remark) ||
      cleanOptionalText(relation.description)
  }
}

export function normalizeCreationRelations(
  relations: AiBookCreationRelation[] | null | undefined,
  characterNames: string[]
): NormalizedCreationRelation[] {
  if (!Array.isArray(relations)) return []
  const result: NormalizedCreationRelation[] = []
  const seen = new Set<string>()
  for (const relation of relations) {
    const normalized = normalizeCreationRelation(relation, characterNames)
    if (!normalized) continue
    const key = `${normalized.sourceName}->${normalized.targetName}:${normalized.relationType}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

export function validateBookCreationPackage(
  pkg: AiBookCreationPackage | null | undefined,
  options: AiBookCreationValidationOptions = {}
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const minCharacters = Math.max(
    AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS,
    Math.round(options.minCharacters || 0)
  )
  const minChapters = Math.max(AI_BOOK_CREATION_MIN_CHAPTERS, Math.round(options.minChapters || 0))
  const minWikiEntries = Math.max(
    AI_BOOK_CREATION_MIN_WIKI_ENTRIES,
    Math.round(options.minWikiEntries || 0)
  )
  const minPlotNodes = Math.max(AI_BOOK_CREATION_MIN_PLOT_NODES, Math.round(options.minPlotNodes || 0))
  const minForeshadowings = Math.max(
    AI_BOOK_CREATION_MIN_FORESHADOWINGS,
    Math.round(options.minForeshadowings || 0)
  )
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, errors: ['起书方案为空'] }
  }
  if (!pkg.book?.title?.trim()) errors.push('缺少作品名')
  if (!Array.isArray(pkg.volumes) || pkg.volumes.length === 0) errors.push('缺少分卷')
  const chapters = Array.isArray(pkg.volumes)
    ? pkg.volumes.flatMap((volume) => Array.isArray(volume.chapters) ? volume.chapters : [])
    : []
  if (chapters.length === 0) errors.push('缺少章节草稿')
  if (chapters.length > 0 && chapters.length < minChapters) {
    errors.push(`章节规划不足：至少需要 ${minChapters} 章`)
  }
  if (!Array.isArray(pkg.characters) || pkg.characters.length === 0) {
    errors.push('缺少人物')
  } else if (pkg.characters.length < minCharacters) {
    errors.push(`人物不足：至少需要 ${minCharacters} 个`)
  }
  const characterNames = Array.isArray(pkg.characters)
    ? pkg.characters.map((character) => cleanText(character?.name)).filter(Boolean)
    : []
  if (characterNames.length >= 2 && normalizeCreationRelations(pkg.relations, characterNames).length === 0) {
    errors.push('缺少有效人物关系')
  }
  if (!Array.isArray(pkg.wikiEntries)) {
    errors.push('设定条目格式无效')
  } else if (pkg.wikiEntries.length < minWikiEntries) {
    errors.push(`设定条目不足：至少需要 ${minWikiEntries} 条`)
  }
  if (!Array.isArray(pkg.plotNodes)) {
    errors.push('剧情节点格式无效')
  } else if (pkg.plotNodes.length < minPlotNodes) {
    errors.push(`剧情/爽点节点不足：至少需要 ${minPlotNodes} 个`)
  }
  if (!Array.isArray(pkg.foreshadowings)) {
    errors.push('伏笔格式无效')
  } else if (pkg.foreshadowings.length < minForeshadowings) {
    errors.push(`伏笔不足：至少需要 ${minForeshadowings} 条`)
  }
  return { ok: errors.length === 0, errors }
}

export function stripBookCreationChapterContent(pkg: AiBookCreationPackage): AiBookCreationPackage {
  return {
    ...pkg,
    volumes: pkg.volumes.map((volume) => ({
      ...volume,
      chapters: volume.chapters.map((chapter) => ({
        ...chapter,
        content: ''
      }))
    }))
  }
}

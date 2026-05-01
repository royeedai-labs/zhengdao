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

export type AiBookCreationRequirements = {
  volumeCount: number
  totalChapters: number
  minCharacters: number
  protagonistCount: number
  minWikiEntries: number
  minPlotNodes: number
  minForeshadowings: number
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
export const AI_BOOK_CREATION_MAX_AUTO_CHAPTERS = 60
export const AI_BOOK_CREATION_MAX_AUTO_VOLUMES = 12

export const AI_BOOK_CREATION_CHARACTER_FIELDS = [
  { key: 'role', label: '角色功能', type: 'text' },
  { key: 'personality', label: '性格标签', type: 'text' },
  { key: 'goal', label: '目标动机', type: 'text' },
  { key: 'specialty', label: '能力/资源', type: 'text' },
  { key: 'arc', label: '成长弧光', type: 'text' }
] as const

export const AI_BOOK_CREATION_FACTION_LABELS = [
  { value: 'protagonist', label: '主角', color: 'indigo' },
  { value: 'ally', label: '盟友/同行', color: 'emerald' },
  { value: 'rival', label: '竞争者', color: 'amber' },
  { value: 'antagonist', label: '对手/阻力', color: 'red' },
  { value: 'neutral', label: '中立/工具人', color: 'slate' }
] as const

export const AI_BOOK_CREATION_STATUS_LABELS = [
  { value: 'active', label: '活跃' },
  { value: 'hidden', label: '暗线' },
  { value: 'conflicted', label: '摇摆/冲突中' },
  { value: 'resolved', label: '阶段完成' }
] as const

export const AI_BOOK_CREATION_EMOTION_LABELS = [
  { score: 5, label: '爆爽 / 高潮兑现' },
  { score: 4, label: '大爽 / 反击成功' },
  { score: 3, label: '爽点 / 优势确立' },
  { score: 2, label: '小爽 / 线索落地' },
  { score: 1, label: '期待 / 钩子铺垫' },
  { score: 0, label: '平衡 / 过渡推进' },
  { score: -1, label: '微压 / 小阻力' },
  { score: -2, label: '压力 / 危机升级' },
  { score: -3, label: '重压 / 判断受挫' },
  { score: -4, label: '险局 / 代价显现' },
  { score: -5, label: '毒点预警 / 极压' }
] as const

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
  零: 0,
  〇: 0,
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
  if (value.includes('百')) {
    const [highRaw, restRaw = ''] = value.split('百')
    const high = highRaw ? parseChineseSmallNumber(highRaw) : 1
    return high * 100 + parseChineseSmallNumber(restRaw)
  }
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

const COUNT_TOKEN = String.raw`(\d+|[零〇一二两三四五六七八九十百]{1,8})`
const COUNT_QUALIFIER = String.raw`(超(?:过)?|大于|多于|至少|不少于|不低于|>=|>|＞)?`

function applyCountQualifier(value: number, qualifier: string | undefined): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (qualifier && /超|大于|多于|>|＞/.test(qualifier)) return value + 1
  return value
}

function parseCountMatch(value: string | undefined, qualifier?: string): number {
  return applyCountQualifier(parseChineseSmallNumber(value || ''), qualifier)
}

function clampCount(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function getCreationPlanningText(brief: AssistantCreationBrief): string {
  const normalized = normalizeCreationBrief(brief)
  return [
    normalized.seedIdea,
    normalized.chapterPlan,
    normalized.characterPlan,
    normalized.otherRequirements
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('；')
}

function extractMaxCount(text: string, pattern: RegExp): number {
  let max = 0
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const parsed = parseCountMatch(match[2], match[1])
    if (parsed > max) max = parsed
  }
  return max
}

function extractVolumeCountFromText(text: string): number {
  return extractMaxCount(text, new RegExp(`${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*卷`, 'g'))
}

function extractTotalChapterCountFromText(text: string, volumeCount: number): number {
  const volumeAndTotal = new RegExp(
    `${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*卷\\s*(?:共|总共|总计|一共)?\\s*${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*章`,
    'g'
  )
  volumeAndTotal.lastIndex = 0
  let combinedMax = 0
  let match: RegExpExecArray | null
  while ((match = volumeAndTotal.exec(text)) !== null) {
    const parsed = parseCountMatch(match[4], match[3])
    if (parsed > combinedMax) combinedMax = parsed
  }
  if (combinedMax > 0) return combinedMax

  const perVolume = extractMaxCount(text, new RegExp(`${COUNT_QUALIFIER}\\s*每\\s*卷\\s*${COUNT_TOKEN}\\s*章`, 'g'))
  if (perVolume > 0 && volumeCount > 0) return perVolume * volumeCount

  return extractMaxCount(text, new RegExp(`${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*章`, 'g'))
}

function extractCharacterCountFromText(text: string): number {
  let count = 0
  const patterns = [
    new RegExp(`${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*(?:个|位|名)\\s*(?:关键|主要|核心|重要)?\\s*(?:人|人物|角色|主角|配角|反派|老人|小伙|女性|男性)?`, 'g'),
    new RegExp(`${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*(?:人|人物|角色|主角|配角|反派)`, 'g')
  ]
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseCountMatch(match[2], match[1])
      if (parsed > count) count = parsed
    }
  }
  return count
}

function extractProtagonistCountFromText(text: string): number {
  return extractMaxCount(
    text,
    new RegExp(`${COUNT_QUALIFIER}\\s*${COUNT_TOKEN}\\s*(?:个|位|名)?\\s*(?:主角|主人公|主线主角)`, 'g')
  )
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
  const planningText = getCreationPlanningText(brief)
  const explicitCount = extractCharacterCountFromText(planningText)
  const itemCount = extractCharacterPlanItems(characterPlan).length
  const groupCount = /群像|人物组|角色组/.test(planningText) ? 4 : 0
  return Math.max(
    AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS,
    explicitCount,
    itemCount,
    groupCount
  )
}

export function getAiBookCreationRequirements(
  briefInput?: AssistantCreationBrief | null
): AiBookCreationRequirements {
  const brief = normalizeCreationBrief(briefInput || {})
  const planningText = getCreationPlanningText(brief)
  const volumeCount = clampCount(
    extractVolumeCountFromText(planningText) || 1,
    1,
    AI_BOOK_CREATION_MAX_AUTO_VOLUMES
  )
  const totalChapters = clampCount(
    extractTotalChapterCountFromText(planningText, volumeCount) || AI_BOOK_CREATION_MIN_CHAPTERS,
    AI_BOOK_CREATION_MIN_CHAPTERS,
    AI_BOOK_CREATION_MAX_AUTO_CHAPTERS
  )
  const minCharacters = getMinimumCharacterCount(brief)
  const protagonistCount = clampCount(
    extractProtagonistCountFromText(planningText) || 1,
    1,
    Math.max(1, minCharacters)
  )

  return {
    volumeCount,
    totalChapters,
    minCharacters,
    protagonistCount,
    minWikiEntries: Math.max(
      AI_BOOK_CREATION_MIN_WIKI_ENTRIES,
      Math.min(4, Math.ceil(totalChapters / 2))
    ),
    minPlotNodes: Math.max(AI_BOOK_CREATION_MIN_PLOT_NODES, totalChapters),
    minForeshadowings: Math.max(
      AI_BOOK_CREATION_MIN_FORESHADOWINGS,
      totalChapters >= 6 ? 2 : 1
    )
  }
}

export function distributeBookCreationChapters(totalChapters: number, volumeCount: number): number[] {
  const safeTotal = clampCount(totalChapters, AI_BOOK_CREATION_MIN_CHAPTERS, AI_BOOK_CREATION_MAX_AUTO_CHAPTERS)
  const safeVolumes = clampCount(volumeCount, 1, Math.min(AI_BOOK_CREATION_MAX_AUTO_VOLUMES, safeTotal))
  const base = Math.floor(safeTotal / safeVolumes)
  const remainder = safeTotal % safeVolumes
  return Array.from({ length: safeVolumes }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function isBookCreationRequirementEcho(value: unknown): boolean {
  const text = cleanOptionalText(value)
  if (!text) return false
  return /(?:用户|沟通|聊天|字段|需求|要求|已确认需求|章节规则|人物规则)/.test(text) ||
    /(?:要|共|总共|一共|规划|目标)?\s*(?:\d+|[零〇一二两三四五六七八九十百]{1,8})\s*卷\s*(?:\d+|[零〇一二两三四五六七八九十百]{1,8})?\s*章/.test(text) ||
    /(?:超(?:过)?|至少|不少于|不低于)?\s*(?:\d+|[零〇一二两三四五六七八九十百]{1,8})\s*(?:个|位|名)?\s*(?:人|人物|角色|主角)/.test(text)
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
  const chapterRange = Math.max(minChapters, chapters.length)
  if (chapters.length === 0) errors.push('缺少章节草稿')
  if (chapters.length > 0 && chapters.length < minChapters) {
    errors.push(`章节规划不足：至少需要 ${minChapters} 章`)
  }
  chapters.forEach((chapter, index) => {
    const summary = cleanText(chapter?.summary)
    if (!summary) {
      errors.push(`第 ${index + 1} 章缺少真实摘要`)
    } else if (isBookCreationRequirementEcho(summary)) {
      errors.push(`第 ${index + 1} 章摘要像是在复述起书需求`)
    }
  })
  if (!Array.isArray(pkg.characters) || pkg.characters.length === 0) {
    errors.push('缺少人物')
  } else if (pkg.characters.length < minCharacters) {
    errors.push(`人物不足：至少需要 ${minCharacters} 个`)
  }
  if (Array.isArray(pkg.characters) && minCharacters > AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS) {
    pkg.characters.forEach((character, index) => {
      if (!cleanText(character?.description)) errors.push(`第 ${index + 1} 个人物缺少人设备注`)
      const fields = character?.customFields || {}
      for (const requiredField of AI_BOOK_CREATION_CHARACTER_FIELDS) {
        if (!cleanText(fields[requiredField.key])) {
          errors.push(`第 ${index + 1} 个人物缺少${requiredField.label}`)
          break
        }
      }
    })
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
  } else {
    pkg.wikiEntries.forEach((entry, index) => {
      if (!cleanText(entry?.title) || !cleanText(entry?.content)) {
        errors.push(`第 ${index + 1} 条设定缺少可写作使用的标题或内容`)
      }
    })
  }
  if (!Array.isArray(pkg.plotNodes)) {
    errors.push('剧情节点格式无效')
  } else if (pkg.plotNodes.length < minPlotNodes) {
    errors.push(`剧情/爽点节点不足：至少需要 ${minPlotNodes} 个`)
  } else {
    const coveredChapters = new Set<number>()
    pkg.plotNodes.forEach((node, index) => {
      const chapterNumber = Number(node?.chapterNumber)
      if (!Number.isFinite(chapterNumber) || chapterNumber < 1 || chapterNumber > chapterRange) {
        errors.push(`第 ${index + 1} 个剧情节点章节号超出范围`)
      } else {
        coveredChapters.add(Math.round(chapterNumber))
      }
      if (!cleanText(node?.description)) {
        errors.push(`第 ${index + 1} 个剧情节点缺少爽点/悬念说明`)
      } else if (isBookCreationRequirementEcho(node.description)) {
        errors.push(`第 ${index + 1} 个剧情节点像是在复述起书需求`)
      }
    })
    if (minPlotNodes >= minChapters) {
      const missing = Array.from({ length: minChapters }, (_, index) => index + 1)
        .filter((chapterNumber) => !coveredChapters.has(chapterNumber))
      if (missing.length > 0) errors.push(`剧情节点未覆盖章节：${missing.join('、')}`)
    }
  }
  if (!Array.isArray(pkg.foreshadowings)) {
    errors.push('伏笔格式无效')
  } else if (pkg.foreshadowings.length < minForeshadowings) {
    errors.push(`伏笔不足：至少需要 ${minForeshadowings} 条`)
  } else {
    pkg.foreshadowings.forEach((item, index) => {
      const expected = item?.expectedChapter == null ? null : Number(item.expectedChapter)
      if (expected != null && (!Number.isFinite(expected) || expected < 1 || expected > chapterRange)) {
        errors.push(`第 ${index + 1} 条伏笔预计回收章节超出范围`)
      }
    })
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

import { coerceGenre, type Genre } from './genre'

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
    label: '作品名或暂定名',
    prompt: '可填作品名、暂定名，或写“让 AI 起名”。',
    required: true,
    quickOptions: ['让 AI 起名', '先用暂定名', '我稍后改名']
  },
  {
    key: 'genreTheme',
    label: '题材 / 主题 / 核心冲突',
    prompt: '说明题材、主题和核心冲突；可混选方向。',
    required: true,
    multiSelect: true,
    quickOptions: ['现实生活', '都市职场', '重生逆袭', '悬疑推理', '家庭情感', '让 AI 评估题材']
  },
  {
    key: 'targetLength',
    label: '目标总字数或篇幅范围',
    prompt: '说明篇幅目标，或写“让 AI 评估篇幅”。',
    required: true,
    quickOptions: ['10 万字以内', '10-30 万字', '30-100 万字', '100 万字以上', '让 AI 评估篇幅']
  },
  {
    key: 'chapterPlan',
    label: '章节规划',
    prompt: '说明章节数、单章字数或分卷节奏；不确定可交给 AI。',
    required: false,
    quickOptions: ['10 章左右', '20 章左右', '25-30 章', '按篇幅自动规划', '让 AI 评估章节']
  },
  {
    key: 'characterPlan',
    label: '人物要求',
    prompt: '说明主要人物和关系；不确定可让 AI 写人物组。',
    required: false,
    multiSelect: true,
    quickOptions: ['普通中年男性', '退休老人', '创业者', '女性主角', '群像', '让 AI 写人物组']
  },
  {
    key: 'styleAudiencePlatform',
    label: '风格 / 受众 / 平台倾向',
    prompt: '说明风格、目标读者和平台；不确定可让 AI 评估。',
    required: false,
    multiSelect: true,
    quickOptions: ['轻松治愈', '现实厚重', '强情节爽感', '悬疑反转', '女频向', '男频向', '让 AI 评估平台']
  },
  {
    key: 'worldbuilding',
    label: '世界观 / 设定方向',
    prompt: '说明时代、地点、行业或特殊设定；现实题材可交给 AI 补足。',
    required: false,
    multiSelect: true,
    quickOptions: ['现实城市', '小镇熟人社会', '职场行业', '家庭社区', '轻幻想元素', '让 AI 补设定']
  },
  {
    key: 'boundaries',
    label: '禁区 / 雷点 / 尺度边界',
    prompt: '说明不想写的内容；没有可填“无明显禁区”。',
    required: false,
    multiSelect: true,
    quickOptions: ['无明显禁区', '不写血腥', '不写露骨内容', '不写真实机构', '不写过度苦情', '让 AI 按平台规避']
  },
  {
    key: 'otherRequirements',
    label: '其他特殊要求',
    prompt: '补充特殊要求；没有可留空或填“无”。',
    required: false,
    multiSelect: true,
    quickOptions: ['无', '先让 AI 发挥', '需要强反转', '需要爽点密集', '需要现实质感']
  }
]

function cleanText(value: unknown): string {
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

export function normalizeCreationBrief(value: unknown): AssistantCreationBrief {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
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

export function isCreationBriefComplete(brief: AssistantCreationBrief): boolean {
  return getCreationBriefMissingFields(brief).length === 0
}

export function isCreationBriefConfirmed(brief: AssistantCreationBrief): boolean {
  return isCreationBriefComplete(brief) && brief.confirmed === true
}

export function validateBookCreationPackage(
  pkg: AiBookCreationPackage | null | undefined
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, errors: ['筹备包为空'] }
  }
  if (!pkg.book?.title?.trim()) errors.push('缺少作品名')
  if (!Array.isArray(pkg.volumes) || pkg.volumes.length === 0) errors.push('缺少分卷')
  const chapters = Array.isArray(pkg.volumes)
    ? pkg.volumes.flatMap((volume) => Array.isArray(volume.chapters) ? volume.chapters : [])
    : []
  if (chapters.length === 0) errors.push('缺少章节草稿')
  if (!Array.isArray(pkg.characters) || pkg.characters.length === 0) errors.push('缺少人物')
  if (!Array.isArray(pkg.wikiEntries)) errors.push('设定条目格式无效')
  if (!Array.isArray(pkg.plotNodes)) errors.push('剧情节点格式无效')
  if (!Array.isArray(pkg.foreshadowings)) errors.push('伏笔格式无效')
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

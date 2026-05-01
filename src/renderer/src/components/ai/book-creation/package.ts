import {
  AI_BOOK_CREATION_CHARACTER_FIELDS,
  AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS,
  AI_BOOK_CREATION_EMOTION_LABELS,
  AI_BOOK_CREATION_FACTION_LABELS,
  AI_BOOK_CREATION_STATUS_LABELS,
  distributeBookCreationChapters,
  extractCharacterPlanItems,
  getAiBookCreationRequirements,
  isBookCreationRequirementEcho,
  normalizeCreationRelations,
  normalizeCreationBrief,
  type AiBookCreationPackage,
  type AiBookCreationRelation,
  type AssistantCreationBrief
} from '../../../../../shared/ai-book-creation'
import { normalizeRelationType } from '../../../../../shared/relation-types'
import { ensureHtmlContent } from '../ai-assistant-helpers'

/**
 * SPLIT-006 — book-creation package coercion + fallback + DB writer.
 *
 * The AI returns a "AiBookCreationPackage" (volumes / chapters /
 * characters / wiki / plot / foreshadow) but the shape is brittle —
 * model wraps it in `{ data: {...} }`, drops fields, returns a single
 * volume with no chapters, etc. These helpers deal with the noise:
 *   - `coerceBookCreationPackage`: unwraps any of the common envelopes.
 *   - `mergeBookCreationPackageWithFallback`: fills in missing fields
 *     from a deterministic fallback so the panel always has a renderable
 *     preview.
 *   - `buildFallbackBookCreationPackage`: deterministic skeleton built
 *     from the user's confirmed brief alone.
 *   - `createBookFromPackageThroughExistingApi`: legacy DB-write path
 *     used when the new `window.api.createBookFromAiPackage` IPC is not
 *     available (tier mismatch / older builds).
 */

export interface AiBookCreationResult {
  book?: { id: number }
  firstChapterId?: number | null
}

export function coerceBookCreationPackage(value: unknown): AiBookCreationPackage | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<AiBookCreationPackage>
  if (raw.book && Array.isArray(raw.volumes)) return raw as AiBookCreationPackage
  const wrapped = value as {
    package?: unknown
    bookPackage?: unknown
    book_creation_package?: unknown
    creationPackage?: unknown
    data?: unknown
    result?: unknown
  }
  if (wrapped.package && typeof wrapped.package === 'object')
    return wrapped.package as AiBookCreationPackage
  if (wrapped.bookPackage && typeof wrapped.bookPackage === 'object')
    return wrapped.bookPackage as AiBookCreationPackage
  if (wrapped.book_creation_package && typeof wrapped.book_creation_package === 'object') {
    return wrapped.book_creation_package as AiBookCreationPackage
  }
  if (wrapped.creationPackage && typeof wrapped.creationPackage === 'object') {
    return wrapped.creationPackage as AiBookCreationPackage
  }
  if (wrapped.data && typeof wrapped.data === 'object')
    return coerceBookCreationPackage(wrapped.data)
  if (wrapped.result && typeof wrapped.result === 'object')
    return coerceBookCreationPackage(wrapped.result)
  return null
}

export function mergeBookCreationPackageWithFallback(
  pkg: AiBookCreationPackage | null,
  fallback: AiBookCreationPackage
): AiBookCreationPackage {
  if (!pkg) return fallback
  const minCharacters = Math.max(
    AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS,
    fallback.characters.length
  )
  const volumes = mergeVolumesWithFallback(
    Array.isArray(pkg.volumes) ? pkg.volumes : [],
    fallback
  )
  const packageCharacters = Array.isArray(pkg.characters) ? pkg.characters : []
  const mergedCharacterList =
    packageCharacters.length === 1 && isGenericMergedCharacter(packageCharacters[0])
      ? mergeListWithFallback([], fallback.characters, minCharacters, (character) => character.name)
      : mergeListWithFallback(packageCharacters, fallback.characters, minCharacters, (character) => character.name)
  const characters = mergedCharacterList.map((character, index) =>
    mergeCharacterWithFallback(character, fallback.characters[index], index)
  )
  const relations = mergeRelationsWithFallback(readPackageRelations(pkg), fallback.relations || [], characters)

  return {
    book: {
      title: String(pkg.book?.title || fallback.book.title),
      author: String(pkg.book?.author || fallback.book.author || '')
    },
    workProfile: {
      ...fallback.workProfile,
      ...(pkg.workProfile || {})
    },
    volumes,
    characters,
    wikiEntries: mergeWikiEntriesWithFallback(Array.isArray(pkg.wikiEntries) ? pkg.wikiEntries : [], fallback),
    relations,
    plotNodes: mergePlotNodesWithFallback(Array.isArray(pkg.plotNodes) ? pkg.plotNodes : [], fallback),
    foreshadowings: mergeForeshadowingsWithFallback(Array.isArray(pkg.foreshadowings) ? pkg.foreshadowings : [], fallback)
  }
}

function countChapters(volumes: AiBookCreationPackage['volumes']): number {
  return volumes.reduce(
    (total, volume) => total + (Array.isArray(volume.chapters) ? volume.chapters.length : 0),
    0
  )
}

function isUsableText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && !isBookCreationRequirementEcho(value)
}

function mergeVolumesWithFallback(
  primary: AiBookCreationPackage['volumes'],
  fallback: AiBookCreationPackage
): AiBookCreationPackage['volumes'] {
  return fallback.volumes.map((fallbackVolume, volumeIndex) => {
    const sourceVolume = primary[volumeIndex]
    const sourceChapters = Array.isArray(sourceVolume?.chapters) ? sourceVolume.chapters : []
    return {
      title: String(sourceVolume?.title || fallbackVolume.title || `第${volumeIndex + 1}卷`),
      chapters: fallbackVolume.chapters.map((fallbackChapter, chapterIndex) => {
        const sourceChapter = sourceChapters[chapterIndex]
        return {
          title: String(sourceChapter?.title || fallbackChapter.title || `第${chapterIndex + 1}章`),
          summary: isUsableText(sourceChapter?.summary)
            ? String(sourceChapter?.summary).trim()
            : fallbackChapter.summary,
          content: ''
        }
      })
    }
  }).filter((volume) => volume.chapters.length > 0)
}

function normalizeCreationFaction(value: unknown, fallback = 'neutral'): string {
  const text = String(value || fallback || '').trim().toLowerCase()
  if (/protagonist|main|主角|主/.test(text)) return 'protagonist'
  if (/ally|friend|同行|盟|友/.test(text)) return 'ally'
  if (/rival|竞争|对照/.test(text)) return 'rival'
  if (/enemy|antagonist|反派|敌|阻力|对手/.test(text)) return 'antagonist'
  return ['protagonist', 'ally', 'rival', 'antagonist', 'neutral'].includes(text) ? text : 'neutral'
}

function normalizeCreationStatus(value: unknown, fallback = 'active'): string {
  const text = String(value || fallback || '').trim().toLowerCase()
  if (/hidden|暗线/.test(text)) return 'hidden'
  if (/conflict|摇摆|冲突/.test(text)) return 'conflicted'
  if (/resolved|完成|收束/.test(text)) return 'resolved'
  return ['active', 'hidden', 'conflicted', 'resolved'].includes(text) ? text : 'active'
}

function fallbackCharacterCustomFields(name: string, index: number, protagonistCount = 1): Record<string, string> {
  const role =
    index < protagonistCount
      ? protagonistCount > 1 ? `第${formatChineseOrdinal(index + 1)}主角` : '主角'
      : index === protagonistCount
        ? '关键同行或线索人物'
        : index === protagonistCount + 1
          ? '主要对手或压力源'
          : index === protagonistCount + 2
            ? '现实压力与情感牵引'
            : '线索、资源或阶段性阻力角色'
  return {
    role,
    personality: index < 2 ? '目标感强，遇事会主动做选择' : '立场清楚，能制造信息差或选择压力',
    goal: index < 2 ? '解决开篇核心事件并守住个人底线' : '推动主线冲突升级或提供关键线索',
    specialty: index < 2 ? '行动判断、专业经验或关键资源' : '掌握局部信息、人脉资源或反向阻力',
    arc: `${name}需要在前期事件中完成一次立场、关系或能力变化。`
  }
}

function mergeCharacterWithFallback(
  character: AiBookCreationPackage['characters'][number],
  fallback: AiBookCreationPackage['characters'][number] | undefined,
  index: number
): AiBookCreationPackage['characters'][number] {
  const name = String(character?.name || fallback?.name || `关键人物${index + 1}`).trim()
  const defaultFields = fallbackCharacterCustomFields(name, index)
  const customFields = {
    ...defaultFields,
    ...(fallback?.customFields || {}),
    ...(character?.customFields || {})
  }
  for (const field of AI_BOOK_CREATION_CHARACTER_FIELDS) {
    if (!String(customFields[field.key] || '').trim()) {
      customFields[field.key] = defaultFields[field.key]
    }
  }
  return {
    name,
    faction: normalizeCreationFaction(character?.faction, fallback?.faction),
    status: normalizeCreationStatus(character?.status, fallback?.status),
    description: isUsableText(character?.description)
      ? String(character.description).trim()
      : fallback?.description || buildFallbackCharacterDescription(name, index, '作品主线'),
    customFields
  }
}

function mergeWikiEntriesWithFallback(
  primary: AiBookCreationPackage['wikiEntries'],
  fallback: AiBookCreationPackage
): AiBookCreationPackage['wikiEntries'] {
  const merged = mergeListWithFallback(
    primary,
    fallback.wikiEntries,
    fallback.wikiEntries.length,
    (entry) => `${entry.category}:${entry.title}`
  )
  return fallback.wikiEntries.map((fallbackEntry, index) => {
    const entry = merged[index] || fallbackEntry
    return {
      category: String(entry.category || fallbackEntry.category || 'AI 设定'),
      title: String(entry.title || fallbackEntry.title || `设定${index + 1}`),
      content: isUsableText(entry.content) ? String(entry.content).trim() : fallbackEntry.content
    }
  })
}

function mergePlotNodesWithFallback(
  primary: AiBookCreationPackage['plotNodes'],
  fallback: AiBookCreationPackage
): AiBookCreationPackage['plotNodes'] {
  const fallbackTotal = countChapters(fallback.volumes)
  const byChapter = new Map<number, AiBookCreationPackage['plotNodes'][number]>()
  primary.forEach((node) => {
    const chapterNumber = Number(node?.chapterNumber)
    if (Number.isFinite(chapterNumber) && chapterNumber >= 1 && chapterNumber <= fallbackTotal) {
      byChapter.set(Math.round(chapterNumber), node)
    }
  })
  return fallback.plotNodes.map((fallbackNode, index) => {
    const chapterNumber = Number(fallbackNode.chapterNumber || index + 1)
    const node = byChapter.get(chapterNumber) || primary[index] || fallbackNode
    return {
      chapterNumber,
      title: String(node.title || fallbackNode.title || `第${chapterNumber}章剧情节点`),
      score: clampPlotScore(node.score ?? fallbackNode.score),
      nodeType: node.nodeType === 'branch' ? 'branch' : 'main',
      description: isUsableText(node.description) ? String(node.description).trim() : fallbackNode.description
    }
  })
}

function mergeForeshadowingsWithFallback(
  primary: AiBookCreationPackage['foreshadowings'],
  fallback: AiBookCreationPackage
): AiBookCreationPackage['foreshadowings'] {
  const totalChapters = countChapters(fallback.volumes)
  const merged = mergeListWithFallback(primary, fallback.foreshadowings, fallback.foreshadowings.length, (item) => item.text)
  return fallback.foreshadowings.map((fallbackItem, index) => {
    const item = merged[index] || fallbackItem
    const expected = Number(item.expectedChapter)
    return {
      text: isUsableText(item.text) ? String(item.text).trim() : fallbackItem.text,
      expectedChapter: Number.isFinite(expected) && expected >= 1 && expected <= totalChapters
        ? Math.round(expected)
        : fallbackItem.expectedChapter ?? null,
      expectedWordCount: item.expectedWordCount ?? fallbackItem.expectedWordCount ?? null
    }
  })
}

function mergeListWithFallback<T>(
  primary: T[],
  fallback: T[],
  minimum: number,
  keyOf: (item: T) => string
): T[] {
  const result = primary.filter(Boolean)
  const seen = new Set(
    result
      .map((item) => keyOf(item).trim())
      .filter(Boolean)
  )
  for (const item of fallback) {
    if (result.length >= minimum) break
    const key = keyOf(item).trim()
    if (key && seen.has(key)) continue
    result.push(item)
    if (key) seen.add(key)
  }
  return result.length > 0 ? result : fallback.slice(0, minimum)
}

function isGenericMergedCharacter(character: AiBookCreationPackage['characters'][number]): boolean {
  const name = String(character?.name || '').trim()
  if (!/^(主角|主人公|角色|人物|主线人物)$/.test(name)) return false
  const customText = Object.values(character?.customFields || {}).join(' ')
  const text = `${character?.description || ''} ${customText}`
  return /[、,，/；;]/.test(text) || extractCharacterPlanItems(text).length >= 2
}

function readPackageRelations(pkg: AiBookCreationPackage): AiBookCreationRelation[] {
  const raw = pkg as AiBookCreationPackage & {
    characterRelations?: AiBookCreationRelation[]
    character_relations?: AiBookCreationRelation[]
  }
  if (Array.isArray(raw.relations)) return raw.relations
  if (Array.isArray(raw.characterRelations)) return raw.characterRelations
  if (Array.isArray(raw.character_relations)) return raw.character_relations
  return []
}

function mergeRelationsWithFallback(
  primary: AiBookCreationRelation[],
  fallback: AiBookCreationRelation[],
  characters: AiBookCreationPackage['characters']
): AiBookCreationRelation[] {
  const characterNames = characters.map((character) => String(character.name || '').trim()).filter(Boolean)
  const merged = normalizeCreationRelations([...primary, ...fallback], characterNames)
  if (merged.length === 0 && characterNames.length >= 2) {
    return [{
      sourceName: characterNames[0],
      targetName: characterNames[1],
      relationType: 'ally',
      label: '初始人物关系，后续写作中可继续细化。'
    }]
  }
  return merged.map((relation) => ({
    sourceName: relation.sourceName,
    targetName: relation.targetName,
    relationType: relation.relationType,
    label: relation.label
  }))
}

function pickFirstBriefPart(value: string | undefined, fallback: string): string {
  const first = String(value || '')
    .split(/[、,，/；;]/)
    .map((part) => part.trim())
    .find(Boolean)
  return first || fallback
}

const CHINESE_ORDINALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function formatChineseOrdinal(value: number): string {
  if (value > 0 && value <= 10) return CHINESE_ORDINALS[value]
  return String(value)
}

function stripPlanningFragments(value: string): string {
  return value
    .replace(/(?:要|共|总共|一共|规划)?\s*\d+\s*卷\s*\d+\s*章/g, '')
    .replace(/(?:要|共|总共|一共|规划)?\s*[零〇一二两三四五六七八九十百]+\s*卷\s*[零〇一二两三四五六七八九十百]*\s*章/g, '')
    .replace(/(?:超(?:过)?|至少|不少于|不低于)?\s*\d+\s*(?:个|位|名)?\s*(?:人|人物|角色|主角)/g, '')
    .replace(/(?:超(?:过)?|至少|不少于|不低于)?\s*[零〇一二两三四五六七八九十百]+\s*(?:个|位|名)?\s*(?:人|人物|角色|主角)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveFallbackStoryTheme(brief: AssistantCreationBrief): string {
  const candidate = stripPlanningFragments(
    String(brief.genreTheme || brief.coreConflict || brief.seedIdea || '').trim()
  )
  return pickFirstBriefPart(candidate, '作品主线')
}

function clampPlotScore(value: unknown): number {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.max(-5, Math.min(5, Math.round(score)))
}

function resolveFallbackBookTitle(brief: AssistantCreationBrief): string {
  const title = String(brief.title || '').trim()
  if (title && !/AI 起名|暂定名|稍后改名/.test(title)) return title
  const seedIdea = stripPlanningFragments(String(brief.seedIdea || '').trim())
  const genre = resolveFallbackStoryTheme(brief)
  if ((seedIdea + genre).includes('现实')) return '平凡日子里的光'
  if ((seedIdea + genre).includes('职场')) return '逆风向上'
  if ((seedIdea + genre).includes('悬疑')) return '沉默的真相'
  if (seedIdea) return `${seedIdea.slice(0, 8)}新篇`
  return `${genre}新篇`
}

function buildChapterArc(chapterNumber: number, totalChapters: number, protagonist: string, partner: string) {
  const finalChapter = chapterNumber === totalChapters
  const blueprints = [
    {
      title: '异常出现',
      summary: `建立${protagonist}的日常压力和专业处境，抛出第一个不合常理的事件，让主线问题必须被追下去。`,
      score: 1,
      nodeTitle: '开篇钩子',
      description: '读者收益是快速进入人物处境和核心疑问，避免空泛铺垫。'
    },
    {
      title: '线索牵引',
      summary: `${partner}带出第一条可验证线索或现实压力，逼迫${protagonist}做出继续追查的选择。`,
      score: 2,
      nodeTitle: '线索落地',
      description: '让主角获得可行动的信息或短暂优势，同时扩大信息差。'
    },
    {
      title: '小胜兑现',
      summary: `${protagonist}用判断或经验解决一个局部难题，兑现一次小爽点，并暴露更大的异常。`,
      score: 3,
      nodeTitle: '阶段小爽点',
      description: '用局部成功证明主角能力，随后打开更深层矛盾。'
    },
    {
      title: '第一次反转',
      summary: '回收前几章的线索，反转读者对事件成因的判断，让第一卷矛盾升级到更危险层级。',
      score: -1,
      nodeTitle: '认知反转',
      description: '用压力和反转制造追读，不让爽点停留在表面解决。'
    },
    {
      title: '主动入局',
      summary: `${protagonist}从被动应对转为主动布局，锁定新的目标、阻力和需要争取的关键人物。`,
      score: 1,
      nodeTitle: '主动权建立',
      description: '读者看到主角开始掌控节奏，同时新的风险浮出水面。'
    },
    {
      title: '压力升级',
      summary: '对手或现实规则形成合围，主角的方案付出代价，迫使人物关系发生一次明确变化。',
      score: -2,
      nodeTitle: '危机加压',
      description: '压力节点服务后续反击，规避无意义虐主和拖延。'
    },
    {
      title: '反击前夜',
      summary: `${partner}补齐关键证据或资源，${protagonist}完成反击准备，同时埋下终章回收点。`,
      score: 2,
      nodeTitle: '反击蓄势',
      description: '把前期伏笔整理成可兑现的行动方案，制造高潮期待。'
    },
    {
      title: '阶段高潮',
      summary: `${protagonist}完成一次公开或关键场景中的兑现，回收主线伏笔，并留下下一阶段更大的悬念。`,
      score: 4,
      nodeTitle: '阶段兑现',
      description: '给读者明确高潮回报，同时为后续卷章保留升级空间。'
    }
  ]
  if (finalChapter && totalChapters > 3) return blueprints[7]
  return blueprints[(chapterNumber - 1) % blueprints.length]
}

function buildFallbackVolumes(
  requirements: ReturnType<typeof getAiBookCreationRequirements>,
  protagonist: string,
  partner: string
): AiBookCreationPackage['volumes'] {
  const distribution = distributeBookCreationChapters(requirements.totalChapters, requirements.volumeCount)
  let chapterNumber = 1
  return distribution.map((chapterCount, volumeIndex) => ({
    title: `第${formatChineseOrdinal(volumeIndex + 1)}卷 ${volumeIndex === 0 ? '开篇入局' : '升级反转'}`,
    chapters: Array.from({ length: chapterCount }, () => {
      const arc = buildChapterArc(chapterNumber, requirements.totalChapters, protagonist, partner)
      const chapter = {
        title: `第${formatChineseOrdinal(chapterNumber)}章 ${arc.title}`,
        summary: arc.summary,
        content: ''
      }
      chapterNumber += 1
      return chapter
    })
  }))
}

function buildFallbackPlotNodes(
  requirements: ReturnType<typeof getAiBookCreationRequirements>,
  protagonist: string,
  partner: string
): AiBookCreationPackage['plotNodes'] {
  return Array.from({ length: requirements.totalChapters }, (_, index) => {
    const chapterNumber = index + 1
    const arc = buildChapterArc(chapterNumber, requirements.totalChapters, protagonist, partner)
    return {
      chapterNumber,
      title: arc.nodeTitle,
      score: arc.score,
      nodeType: 'main' as const,
      description: arc.description
    }
  })
}

export function buildFallbackBookCreationPackage(
  briefInput: AssistantCreationBrief
): AiBookCreationPackage {
  const brief = normalizeCreationBrief(briefInput)
  const requirements = getAiBookCreationRequirements(brief)
  const title = resolveFallbackBookTitle(brief)
  const genreTheme = resolveFallbackStoryTheme(brief)
  const targetLength = brief.targetLength || '让 AI 评估篇幅'
  const chapterPlan = brief.chapterPlan || '按篇幅自动规划'
  const characterPlan = brief.characterPlan || '让 AI 写人物组'
  const style = brief.styleAudiencePlatform || '让 AI 评估平台'
  const world = brief.worldbuilding || '现实城市'
  const boundaries = brief.boundaries || '无明显禁区'
  const minimumCharacters = requirements.minCharacters
  const characterNames = buildFallbackCharacterNames(characterPlan, minimumCharacters, requirements.protagonistCount)
  const protagonist = characterNames[0] || '主角'
  const partner = characterNames[1] || '关键同行'
  const volumes = buildFallbackVolumes(requirements, protagonist, partner)
  const plotNodes = buildFallbackPlotNodes(requirements, protagonist, partner)
  const firstPayoffChapter = Math.min(3, requirements.totalChapters)
  const finalPayoffChapter = requirements.totalChapters

  return {
    book: {
      title,
      author: brief.author || ''
    },
    workProfile: {
      productGenre: brief.productGenre || 'webnovel',
      styleGuide: style,
      genreRules: genreTheme,
      contentBoundaries: boundaries,
      assetRules: `人物方向：${characterPlan}`,
      rhythmRules: `篇幅：${targetLength}；章节：${chapterPlan}`
    },
    volumes,
    characters: characterNames.map((name, index) => ({
      name,
      faction: index < requirements.protagonistCount ? 'protagonist' : index === 1 ? 'ally' : 'neutral',
      status: 'active',
      description: buildFallbackCharacterDescription(name, index, genreTheme, requirements.protagonistCount),
      customFields: fallbackCharacterCustomFields(name, index, requirements.protagonistCount)
    })),
    relations: buildFallbackCharacterRelations(characterNames, genreTheme, requirements.protagonistCount),
    wikiEntries: [
      {
        category: '世界观',
        title: world,
        content: `初始设定方向：${world}。所有异常、规则或行业细节都需要服务主线悬念与人物选择。`
      },
      {
        category: '主线冲突',
        title: '核心矛盾',
        content: `以${genreTheme}为主线，推动${protagonist}从被动卷入到主动追查，并让${partner}承担线索推进或压力放大的作用。`
      },
      {
        category: '节奏规则',
        title: '读者收益与压力比例',
        content: '每章都要提供清晰读者收益：线索落地、局部兑现、关系变化或悬念升级；压力节点必须服务后续反击。'
      },
      {
        category: '创作边界',
        title: '内容边界',
        content: boundaries
      }
    ].slice(0, requirements.minWikiEntries),
    plotNodes,
    foreshadowings: [
      {
        text: `第一章异常事件中埋入一个与${world}规则相关的细节，第${firstPayoffChapter}章前后完成第一次回收。`,
        expectedChapter: firstPayoffChapter,
        expectedWordCount: null
      },
      {
        text: `中段人物选择埋下阶段高潮的反击依据，第${finalPayoffChapter}章完成回收或升级为下一阶段悬念。`,
        expectedChapter: finalPayoffChapter,
        expectedWordCount: null
      }
    ].slice(0, requirements.minForeshadowings)
  }
}

function buildFallbackCharacterRelations(
  characterNames: string[],
  genreTheme: string,
  protagonistCount = 1
): AiBookCreationRelation[] {
  const [protagonist, partner, antagonist, familyOrPressure, support] = characterNames
  const relations: AiBookCreationRelation[] = []
  if (protagonist && partner) {
    relations.push({
      sourceName: protagonist,
      targetName: partner,
      relationType: 'ally',
      label: protagonistCount > 1
        ? '双主角关系，需要互补能力、不同立场和阶段性分歧。'
        : `共同推动${genreTheme}主线，一人承担行动压力，一人补足信息差。`
    })
  }
  if (protagonist && antagonist) {
    relations.push({
      sourceName: protagonist,
      targetName: antagonist,
      relationType: /反派|敌|仇|压力/.test(antagonist) ? 'enemy' : 'rival',
      label: '主要冲突关系，负责制造阶段性阻力和反转空间。'
    })
  }
  if (protagonist && familyOrPressure) {
    relations.push({
      sourceName: protagonist,
      targetName: familyOrPressure,
      relationType: /家人|父|母|姐|妹|兄|弟|亲/.test(familyOrPressure) ? 'family' : 'rival',
      label: '情感或现实压力来源，推动主角做出选择。'
    })
  }
  if (partner && support) {
    relations.push({
      sourceName: partner,
      targetName: support,
      relationType: 'ally',
      label: '辅助线索与资源连接，服务开篇推进。'
    })
  }
  return relations
}

function buildFallbackCharacterNames(characterPlan: string, minimum: number, protagonistCount = 1): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const item of extractCharacterPlanItems(characterPlan)) {
    const name = item
      .replace(/^(?:主要|关键|核心)/, '')
      .replace(/(?:一个|一位|一名)$/, '')
      .trim()
    if (!name || /^(?:个人|人|人物|角色|个人\d+|人物\d+|角色\d+)$/.test(name)) continue
    if (/(?:卷|章)/.test(name)) continue
    if (/^(?:超(?:过)?|至少|不少于|不低于)?\s*(?:\d+|[零〇一二两三四五六七八九十百]+)\s*(?:个|位|名)?\s*(?:人|人物|角色)$/.test(name)) continue
    if (seen.has(name)) continue
    names.push(name)
    seen.add(name)
  }
  const protagonistNames = protagonistCount > 1
    ? Array.from({ length: protagonistCount }, (_, index) => `主角${formatChineseOrdinal(index + 1)}`)
    : ['主角']
  const genericNames = [
    ...protagonistNames,
    '关键同行',
    '主要对手',
    '现实压力者',
    '线索人物',
    '资源人物',
    '见证者',
    '隐患制造者',
    '情感牵引者',
    '阶段性盟友',
    '制度阻力者',
    '最终线索人'
  ]
  for (const name of genericNames) {
    if (names.length >= minimum) break
    if (seen.has(name)) continue
    names.push(name)
    seen.add(name)
  }
  return names.slice(0, Math.max(minimum, names.length))
}

function buildFallbackCharacterDescription(
  name: string,
  index: number,
  genreTheme: string,
  protagonistCount = 1
): string {
  if (index < protagonistCount) {
    return `${name}是${genreTheme}主线的主要承压者，从被动卷入转向主动追查或解决问题。`
  }
  if (index === protagonistCount) {
    return `${name}是关键同行或线索人物，负责带出信息差、行动压力和阶段性爽点。`
  }
  return `${name}是${genreTheme}中的功能角色，负责制造选择、阻力或后续反转空间。`
}

export async function createBookFromPackageThroughExistingApi(
  briefInput: AssistantCreationBrief,
  pkg: AiBookCreationPackage
): Promise<AiBookCreationResult> {
  const brief = normalizeCreationBrief(briefInput)
  const book = (await window.api.createBook({
    title: String(pkg.book.title || brief.title || 'AI 新作品'),
    author: String(pkg.book.author || brief.author || ''),
    productGenre: pkg.workProfile?.productGenre || brief.productGenre || 'webnovel'
  })) as { id: number }
  if (!book?.id) throw new Error('创建作品失败：缺少作品 ID')

  if (typeof window.api.saveConfig === 'function') {
    await window.api.saveConfig(book.id, {
      genre: 'AI 起书',
      character_fields: AI_BOOK_CREATION_CHARACTER_FIELDS.map((field) => ({ ...field })),
      faction_labels: AI_BOOK_CREATION_FACTION_LABELS.map((label) => ({ ...label })),
      status_labels: AI_BOOK_CREATION_STATUS_LABELS.map((label) => ({ ...label })),
      emotion_labels: AI_BOOK_CREATION_EMOTION_LABELS.map((label) => ({ ...label })),
      daily_goal: 6000,
      daily_goal_mode: 'follow_system',
      sensitive_list: 'default'
    })
  }

  if (typeof window.api.aiSaveWorkProfile === 'function') {
    await window.api.aiSaveWorkProfile(book.id, {
      genre: pkg.workProfile?.productGenre || brief.productGenre || 'webnovel',
      style_guide: pkg.workProfile?.styleGuide || '',
      genre_rules: pkg.workProfile?.genreRules || '',
      content_boundaries: pkg.workProfile?.contentBoundaries || '',
      asset_rules: pkg.workProfile?.assetRules || '',
      rhythm_rules: pkg.workProfile?.rhythmRules || ''
    })
  }

  let firstChapterId: number | null = null
  for (const [volumeIndex, volume] of pkg.volumes.entries()) {
    const createdVolume = (await window.api.createVolume({
      book_id: book.id,
      title: String(volume.title || `第${volumeIndex + 1}卷`)
    })) as { id: number }
    for (const [chapterIndex, chapter] of volume.chapters.entries()) {
      const createdChapter = (await window.api.createChapter({
        volume_id: createdVolume.id,
        title: String(chapter.title || `第${chapterIndex + 1}章`),
        content: ensureHtmlContent(String(chapter.content || '')),
        summary: String(chapter.summary || '')
      })) as { id: number }
      firstChapterId ??= createdChapter.id
    }
  }

  const createdCharactersByName = new Map<string, number>()
  for (const character of pkg.characters) {
    const name = String(character.name || '未命名角色')
    const created = (await window.api.createCharacter({
      book_id: book.id,
      name,
      faction: character.faction || 'neutral',
      status: character.status || 'active',
      description: character.description || '',
      custom_fields: character.customFields || {}
    })) as { id?: number }
    if (created?.id && !createdCharactersByName.has(name)) {
      createdCharactersByName.set(name, created.id)
    }
  }

  const normalizedRelations = normalizeCreationRelations(pkg.relations, [...createdCharactersByName.keys()])
  for (const relation of normalizedRelations) {
    const sourceId = createdCharactersByName.get(relation.sourceName)
    const targetId = createdCharactersByName.get(relation.targetName)
    if (!sourceId || !targetId) continue
    await window.api.createRelation(
      book.id,
      sourceId,
      targetId,
      normalizeRelationType(relation.relationType),
      relation.label
    )
  }

  for (const [index, entry] of pkg.wikiEntries.entries()) {
    await window.api.createWikiEntry({
      book_id: book.id,
      category: entry.category || 'AI 设定',
      title: entry.title || '未命名设定',
      content: entry.content || '',
      sort_order: index
    })
  }

  for (const [index, node] of pkg.plotNodes.entries()) {
    await window.api.createPlotNode({
      book_id: book.id,
      chapter_number: Number.isFinite(Number(node.chapterNumber))
        ? Number(node.chapterNumber)
        : 0,
      title: node.title || '剧情节点',
      score: clampPlotScore(node.score),
      node_type: node.nodeType === 'branch' ? 'branch' : 'main',
      description: node.description || '',
      sort_order: index
    })
  }

  for (const item of pkg.foreshadowings) {
    await window.api.createForeshadowing({
      book_id: book.id,
      chapter_id: firstChapterId,
      text: item.text || 'AI 伏笔',
      expected_chapter: item.expectedChapter ?? null,
      expected_word_count: item.expectedWordCount ?? null
    })
  }

  return { book, firstChapterId }
}

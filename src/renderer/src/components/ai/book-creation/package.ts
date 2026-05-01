import {
  AI_BOOK_CREATION_DEFAULT_MIN_CHARACTERS,
  AI_BOOK_CREATION_MIN_CHAPTERS,
  AI_BOOK_CREATION_MIN_FORESHADOWINGS,
  AI_BOOK_CREATION_MIN_PLOT_NODES,
  AI_BOOK_CREATION_MIN_WIKI_ENTRIES,
  extractCharacterPlanItems,
  getMinimumCharacterCount,
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
  const volumes = Array.isArray(pkg.volumes)
    ? pkg.volumes
        .map((volume, index) => ({
          title: String(volume?.title || fallback.volumes[index]?.title || `第${index + 1}卷`),
          chapters:
            Array.isArray(volume?.chapters) && volume.chapters.length > 0
              ? volume.chapters.map((chapter, chapterIndex) => ({
                  title: String(
                    chapter?.title ||
                      fallback.volumes[index]?.chapters[chapterIndex]?.title ||
                      `第${chapterIndex + 1}章`
                  ),
                  summary: String(
                    chapter?.summary ||
                      fallback.volumes[index]?.chapters[chapterIndex]?.summary ||
                      ''
                  ),
                  content: String(
                    chapter?.content ||
                      fallback.volumes[index]?.chapters[chapterIndex]?.content ||
                      ''
                  )
                }))
              : fallback.volumes[index]?.chapters || fallback.volumes[0].chapters
        }))
        .filter((volume) => volume.chapters.length > 0)
    : []
  const packageCharacters = Array.isArray(pkg.characters) ? pkg.characters : []
  const characters =
    packageCharacters.length === 1 && isGenericMergedCharacter(packageCharacters[0])
      ? mergeListWithFallback([], fallback.characters, minCharacters, (character) => character.name)
      : mergeListWithFallback(packageCharacters, fallback.characters, minCharacters, (character) => character.name)
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
    volumes: ensureMinimumChapters(
      volumes.length > 0 ? volumes : fallback.volumes,
      fallback,
      AI_BOOK_CREATION_MIN_CHAPTERS
    ),
    characters,
    wikiEntries: mergeListWithFallback(
      Array.isArray(pkg.wikiEntries) ? pkg.wikiEntries : [],
      fallback.wikiEntries,
      AI_BOOK_CREATION_MIN_WIKI_ENTRIES,
      (entry) => `${entry.category}:${entry.title}`
    ),
    relations,
    plotNodes: mergeListWithFallback(
      Array.isArray(pkg.plotNodes) ? pkg.plotNodes : [],
      fallback.plotNodes,
      AI_BOOK_CREATION_MIN_PLOT_NODES,
      (node) => `${node.chapterNumber || 0}:${node.title}`
    ),
    foreshadowings: mergeListWithFallback(
      Array.isArray(pkg.foreshadowings) ? pkg.foreshadowings : [],
      fallback.foreshadowings,
      AI_BOOK_CREATION_MIN_FORESHADOWINGS,
      (item) => item.text
    )
  }
}

function countChapters(volumes: AiBookCreationPackage['volumes']): number {
  return volumes.reduce(
    (total, volume) => total + (Array.isArray(volume.chapters) ? volume.chapters.length : 0),
    0
  )
}

function ensureMinimumChapters(
  volumesInput: AiBookCreationPackage['volumes'],
  fallback: AiBookCreationPackage,
  minimum: number
): AiBookCreationPackage['volumes'] {
  const volumes = volumesInput.map((volume) => ({
    title: volume.title,
    chapters: volume.chapters.map((chapter) => ({
      title: chapter.title,
      summary: chapter.summary || '',
      content: ''
    }))
  }))
  if (volumes.length === 0) {
    volumes.push({ title: fallback.volumes[0]?.title || '第一卷', chapters: [] })
  }
  if (countChapters(volumes) >= minimum) return volumes

  const targetVolume = volumes[0]
  const seenTitles = new Set(
    volumes.flatMap((volume) => volume.chapters.map((chapter) => String(chapter.title || '').trim()))
  )
  const fallbackChapters = fallback.volumes.flatMap((volume) => volume.chapters)
  for (const chapter of fallbackChapters) {
    if (countChapters(volumes) >= minimum) break
    const title = String(chapter.title || '').trim()
    if (title && seenTitles.has(title)) continue
    targetVolume.chapters.push({
      title: title || `第${countChapters(volumes) + 1}章`,
      summary: chapter.summary || '',
      content: ''
    })
    if (title) seenTitles.add(title)
  }
  while (countChapters(volumes) < minimum) {
    const next = countChapters(volumes) + 1
    targetVolume.chapters.push({
      title: `第${next}章 后续推进`,
      summary: '承接上一章矛盾，推进人物选择、线索升级和一次明确爽点兑现。',
      content: ''
    })
  }
  return volumes
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

function clampPlotScore(value: unknown): number {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.max(-5, Math.min(5, Math.round(score)))
}

function resolveFallbackBookTitle(brief: AssistantCreationBrief): string {
  const title = String(brief.title || '').trim()
  if (title && !/AI 起名|暂定名|稍后改名/.test(title)) return title
  const seedIdea = String(brief.seedIdea || '').trim()
  const genre = pickFirstBriefPart(brief.genreTheme || seedIdea, '新作品')
  if ((seedIdea + genre).includes('现实')) return '平凡日子里的光'
  if ((seedIdea + genre).includes('职场')) return '逆风向上'
  if ((seedIdea + genre).includes('悬疑')) return '沉默的真相'
  if (seedIdea) return `${seedIdea.slice(0, 8)}新篇`
  return `${genre}新篇`
}

export function buildFallbackBookCreationPackage(
  briefInput: AssistantCreationBrief
): AiBookCreationPackage {
  const brief = normalizeCreationBrief(briefInput)
  const title = resolveFallbackBookTitle(brief)
  const seedIdea = brief.seedIdea || ''
  const genreTheme = brief.genreTheme || seedIdea || '让 AI 评估题材'
  const targetLength = brief.targetLength || '让 AI 评估篇幅'
  const chapterPlan = brief.chapterPlan || '按篇幅自动规划'
  const characterPlan = brief.characterPlan || '让 AI 写人物组'
  const style = brief.styleAudiencePlatform || '让 AI 评估平台'
  const world = brief.worldbuilding || '现实城市'
  const boundaries = brief.boundaries || '无明显禁区'
  const minimumCharacters = getMinimumCharacterCount(brief)
  const characterNames = buildFallbackCharacterNames(characterPlan, minimumCharacters)
  const protagonist = characterNames[0] || '主角'
  const partner = characterNames[1] || '关键同行'

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
    volumes: [
      {
        title: '第一卷',
        chapters: [
          {
            title: '第一章 异常出现',
            summary: `围绕${genreTheme}展开开篇，建立${protagonist}的现实处境，并用一个不合常理的事件把故事推入主线。篇幅目标为${targetLength}，章节节奏暂按"${chapterPlan}"推进。`,
            content: ''
          },
          {
            title: '第二章 线索牵引',
            summary: `${partner}带出第一条关键线索或现实压力，让${protagonist}必须继续调查，并安排一次小爽点或线索确认。`,
            content: ''
          },
          {
            title: '第三章 第一次反转',
            summary: `回收前两章的异常与线索，制造第一次认知反转，明确后续更大的矛盾、爽点目标和潜在毒点边界。`,
            content: ''
          }
        ]
      }
    ],
    characters: characterNames.map((name, index) => ({
      name,
      faction: index === 0 ? 'main' : 'neutral',
      status: 'active',
      description: buildFallbackCharacterDescription(name, index, genreTheme),
      customFields: {}
    })),
    relations: buildFallbackCharacterRelations(characterNames, genreTheme),
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
        category: '创作边界',
        title: '内容边界',
        content: boundaries
      }
    ],
    plotNodes: [
      {
        chapterNumber: 1,
        title: '异常钩子',
        score: 1,
        nodeType: 'main',
        description: `建立${protagonist}的日常处境后，用一个异常事件制造开篇钩子，爽点是读者立刻看到“平静被打破”。`
      },
      {
        chapterNumber: 2,
        title: '线索推进爽点',
        score: 2,
        nodeType: 'main',
        description: `${partner}推动第一条线索落地，让主角得到可验证的信息或短暂优势，避免原地猜谜。`
      },
      {
        chapterNumber: 3,
        title: '第一次反转爽点',
        score: 3,
        nodeType: 'main',
        description: '回收开篇异常并反转读者判断，让主线问题升级，同时规避无意义误会和拖延。'
      }
    ],
    foreshadowings: [
      {
        text: `第一章异常事件中埋入一个与${world}规则相关的细节，第三章前后完成第一次回收。`,
        expectedChapter: 3,
        expectedWordCount: null
      }
    ]
  }
}

function buildFallbackCharacterRelations(
  characterNames: string[],
  genreTheme: string
): AiBookCreationRelation[] {
  const [protagonist, partner, antagonist, familyOrPressure, support] = characterNames
  const relations: AiBookCreationRelation[] = []
  if (protagonist && partner) {
    relations.push({
      sourceName: protagonist,
      targetName: partner,
      relationType: 'ally',
      label: `共同推动${genreTheme}主线，一人承担行动压力，一人补足信息差。`
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

function buildFallbackCharacterNames(characterPlan: string, minimum: number): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const item of extractCharacterPlanItems(characterPlan)) {
    const name = item
      .replace(/^(?:主要|关键|核心)/, '')
      .replace(/(?:一个|一位|一名)$/, '')
      .trim()
    if (!name || /^(?:个人|人|人物|角色|个人\d+|人物\d+|角色\d+)$/.test(name)) continue
    if (seen.has(name)) continue
    names.push(name)
    seen.add(name)
  }
  const genericNames = ['主角', '关键同行', '对手', '家人', '线索人物', '压力人物']
  for (const name of genericNames) {
    if (names.length >= minimum) break
    if (seen.has(name)) continue
    names.push(name)
    seen.add(name)
  }
  return names.slice(0, Math.max(minimum, names.length))
}

function buildFallbackCharacterDescription(name: string, index: number, genreTheme: string): string {
  if (index === 0) {
    return `${name}是${genreTheme}主线的主要承压者，从被动卷入转向主动追查或解决问题。`
  }
  if (index === 1) {
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

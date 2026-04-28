import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Bot, Check, ClipboardCheck, Loader2, MessageSquare, MessageSquarePlus, MessagesSquare, Plus, Send, Settings2, ShieldCheck, Sparkles, Trash2, Users, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore, type AiChapterDraft, type InlineAiDraft } from '@/stores/ui-store'
import { useWikiStore } from '@/stores/wiki-store'
import { aiPromptStream, getResolvedGlobalAiConfig, isAiConfigReady, type AiCallerConfig } from '@/utils/ai'
import {
  applyAssistantContextSelection,
  attachSelectionMetaToDrafts,
  buildAssistantContext,
  composeAssistantChatPrompt,
  composeSkillPrompt,
  createChapterDraftFromAssistantResponse,
  parseAssistantDrafts,
  planTextDraftApplication,
  resolveAssistantContextPolicy,
  type AiAssistantContext,
  type AiDraftPayload,
  type AiSkillOverride,
  type AiSkillTemplate,
  type AiWorkProfile
} from '@/utils/ai/assistant-workflow'
import { stripHtmlToText } from '@/utils/html-to-text'
import { getActiveEditor } from '@/components/editor/active-editor'
import { applyProfessionalTemplate, getProfessionalTemplate } from '../../../../shared/professional-templates'
import { buildConversationListItems, pickConversationAfterDelete } from './conversation-list'
import { buildChapterEditorQuickActions, isBlankChapterContent } from './chapter-quick-actions'
import {
  resolveAssistantIntent,
  resolveAssistantSkillSelection
} from './conversation-mode'
import { shouldSubmitAiAssistantInput } from './input-behavior'
import { buildDraftPreviewModel } from './draft-preview'
import { DEFAULT_CONTINUE_INPUT, toAiChapterDraft, toInlineAiDraft } from './inline-draft'
import { buildAssistantMessageDisplay } from './message-display'
import { translateAiAssistantLauncherPosition } from './panel-layout'
import {
  appendAssistantStreamToken,
  completeAssistantStreamMessage,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  getAssistantStreamEmptyError,
  replaceAssistantStreamContent
} from './streaming-message'
import { resolveAssistantContext } from '@/utils/ai/assistant-context'
import {
  CREATION_BRIEF_FIELDS,
  getCreationBriefMissingFields,
  isCreationBriefComplete,
  normalizeCreationBrief,
  stripBookCreationChapterContent,
  validateBookCreationPackage,
  type AiBookCreationPackage,
  type AssistantCreationBrief,
  type CreationBriefField
} from '../../../../shared/ai-book-creation'

type AiMessage = {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

type AiConversationRow = {
  id: number
  title: string
  updated_at: string
  message_count?: number
}

type AiDraftRow = {
  id: number
  conversation_id?: number | null
  kind: string
  title: string
  payload: Record<string, unknown>
  status: 'pending' | 'applied' | 'dismissed'
  target_ref?: string
}

type AiBookCreationResult = { book?: { id: number }; firstChapterId?: number | null }

function plainToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function ensureHtmlContent(text: string): string {
  const value = text.trim()
  if (!value) return ''
  return /<\/?[a-z][^>]*>/i.test(value) ? value : plainToHtml(value)
}

function draftTitle(draft: AiDraftPayload): string {
  if (typeof draft.title === 'string' && draft.title.trim()) return draft.title
  if (typeof draft.name === 'string' && draft.name.trim()) return draft.name
  switch (draft.kind) {
    case 'insert_text':
      return '插入正文'
    case 'replace_text':
      return '替换正文'
    case 'create_chapter':
      return '创建章节'
    case 'update_chapter_summary':
      return '更新章节摘要'
    case 'create_character':
      return '创建角色'
    case 'create_wiki_entry':
      return '创建设定'
    case 'create_plot_node':
      return '创建剧情节点'
    case 'create_foreshadowing':
      return '创建伏笔'
    default:
      return 'AI 草稿'
  }
}

function normalizeAssistantDrafts(skill: AiSkillTemplate, content: string): { drafts: AiDraftPayload[]; errors: string[] } {
  if (skill.output_contract === 'plain_text') {
    if (skill.key === 'continue_writing') {
      return { drafts: [{ kind: 'insert_text', content }], errors: [] }
    }
    return { drafts: [], errors: [] }
  }
  const parsed = parseAssistantDrafts(content)
  if (skill.key === 'create_chapter' && parsed.drafts.length === 0) {
    const draft = createChapterDraftFromAssistantResponse(content, 'AI 新章节', {
      allowPlainTextFallback: true
    })
    if (draft) return { drafts: [draft], errors: [] }
  }
  return parsed
}

function withLocalRagChip(context: AiAssistantContext): AiAssistantContext {
  if (context.chips.some((chip) => chip.id === 'local_rag')) return context
  return {
    ...context,
    chips: [
      ...context.chips,
      {
        id: 'local_rag',
        kind: 'local_rag',
        label: '本地片段',
        enabled: true
      }
    ]
  }
}

function formatProviderLabel(provider?: string | null): string {
  switch (provider) {
    case 'zhengdao_official':
      return '官方 AI'
    case 'openai':
      return 'OpenAI 兼容'
    case 'gemini':
      return 'Gemini API'
    case 'gemini_cli':
      return 'Gemini CLI'
    case 'ollama':
      return 'Ollama'
    case 'custom_openai':
      return '自定义兼容'
    default:
      return '未配置'
  }
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const candidate = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function mergeCreationBrief(current: AssistantCreationBrief, incoming: unknown): AssistantCreationBrief {
  const normalized = normalizeCreationBrief(incoming)
  const next: AssistantCreationBrief = { ...current }
  const writable = next as Record<string, unknown>
  for (const field of CREATION_BRIEF_FIELDS) {
    const value = normalized[field.key]
    if (typeof value === 'string' && value.trim()) {
      writable[field.key] = value
    }
  }
  if (normalized.author) next.author = normalized.author
  if (normalized.productGenre) next.productGenre = normalized.productGenre
  return { ...next, confirmed: false }
}

function formatBriefForPrompt(brief: AssistantCreationBrief): string {
  const normalized = normalizeCreationBrief(brief)
  return CREATION_BRIEF_FIELDS
    .map((field) => {
      const value = String(normalized[field.key] || '').trim()
      const fallback = field.required ? '未确认' : '可由 AI 评估/代写'
      return `${field.required ? '必填' : '可选'}｜${field.label}: ${value || fallback}`
    })
    .join('\n')
}

function formatCreationBriefFieldGuide(): string {
  return CREATION_BRIEF_FIELDS
    .map((field, index) => {
      const options = field.quickOptions.map((option, optionIndex) => `${optionIndex + 1}) ${option}`).join('；')
      return `${index + 1}. ${field.required ? '必填' : '可选'}${field.multiSelect ? '｜可多选' : ''}｜${field.label}：${options}`
    })
    .join('\n')
}

function buildBookshelfBriefSystemPrompt(): string {
  return [
    '你是证道的唯一 AI 创作助手，现在处于书架页的新作品沟通模式。',
    '你的目标是快速收束起书需求，而不是一项一项审问用户。',
    '核心必填只有：作品名或暂定名、题材/主题/核心冲突、目标总字数或篇幅范围。其余字段都是可选项；用户没填时，可以引导用户选择“让 AI 评估”“让 AI 写”“先按默认”。',
    '不要一轮只追问一个字段。除非用户明确只讨论某一项，否则 assistant_message 只用 1-2 句告诉用户可以在输入框上方点选多项，也可以直接输入其他想法。',
    '选项由界面提供，不要在 assistant_message 里输出编号清单、Markdown 标题、粗体、项目符号或长列表。',
    '支持用户一次性回复多个编号、多个短语或自然语言，例如：“1 现实生活，2 10万字内，章节让AI评估，人物让AI写”。',
    '只把用户明确说出的内容、用户选择的候选项，或用户明确授权 AI 评估/代写的内容写入 brief。用户只说不确定时，不要替用户写死方向，要把对应字段写成“让 AI 评估”或继续给组合选择。',
    'brief 只能使用这些英文 key：title, genreTheme, targetLength, chapterPlan, characterPlan, styleAudiencePlatform, worldbuilding, boundaries, otherRequirements, author, productGenre。',
    '请严格返回 JSON，不要 Markdown，不要额外解释。格式：{"assistant_message":"给用户看的回复","brief":{...},"suggestions":[{"field":"字段名","options":["选项1","选项2"]}]}。'
  ].join('\n')
}

function buildBookshelfBriefUserPrompt(input: {
  brief: AssistantCreationBrief
  userInput: string
  messages: AiMessage[]
}): string {
  const recent = input.messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
  return [
    `当前已确认需求：\n${formatBriefForPrompt(input.brief)}`,
    `字段规则与可选答案：\n${formatCreationBriefFieldGuide()}`,
    recent ? `最近对话：\n${recent}` : '',
    `用户新输入：\n${input.userInput}`,
    '请更新 brief。assistant_message 不要列选项，只提示用户使用输入框上方选项区或直接输入其他内容；如果核心必填已齐，就提示用户可生成筹备包预览或继续补可选项。'
  ].filter(Boolean).join('\n\n')
}

function buildBookPackagePrompt(brief: AssistantCreationBrief): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: [
      '你是长篇小说开书策划助手。',
      '你只能依据用户已确认的核心起书需求生成筹备包，不能新增未经确认的核心方向。',
      '对用户留空或写明“让 AI 评估/让 AI 写/先按默认”的可选字段，你可以按题材常规和平台安全边界合理补全。',
      '必须返回一个完整 JSON 对象。不要写章节正文，所有 chapters.content 必须是空字符串；用 summary 和 plotNodes 表达开篇规划。',
      '请严格返回 JSON，不要 Markdown，不要解释。'
    ].join('\n'),
    userPrompt: [
      `已确认需求：\n${formatBriefForPrompt(brief)}`,
      [
        '请生成 AiBookCreationPackage JSON，字段如下：',
        '{"book":{"title":"","author":""},"workProfile":{"productGenre":"webnovel","styleGuide":"","genreRules":"","contentBoundaries":"","assetRules":"","rhythmRules":""},"volumes":[{"title":"第一卷","chapters":[{"title":"第一章","summary":"","content":""}]}],"characters":[{"name":"","faction":"neutral","status":"active","description":"","customFields":{}}],"wikiEntries":[{"category":"","title":"","content":""}],"plotNodes":[{"chapterNumber":1,"title":"","score":0,"nodeType":"main","description":""}],"foreshadowings":[{"text":"","expectedChapter":null,"expectedWordCount":null}]}',
        '要求：1 个分卷，3-5 个章节规划；每章 content 都留空；人物 2-4 个；设定 2-4 条；剧情节点 3-6 个；伏笔 1-3 个。'
      ].join('\n')
    ].join('\n\n')
  }
}

function coerceBookCreationPackage(value: unknown): AiBookCreationPackage | null {
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
  if (wrapped.package && typeof wrapped.package === 'object') return wrapped.package as AiBookCreationPackage
  if (wrapped.bookPackage && typeof wrapped.bookPackage === 'object') return wrapped.bookPackage as AiBookCreationPackage
  if (wrapped.book_creation_package && typeof wrapped.book_creation_package === 'object') {
    return wrapped.book_creation_package as AiBookCreationPackage
  }
  if (wrapped.creationPackage && typeof wrapped.creationPackage === 'object') {
    return wrapped.creationPackage as AiBookCreationPackage
  }
  if (wrapped.data && typeof wrapped.data === 'object') return coerceBookCreationPackage(wrapped.data)
  if (wrapped.result && typeof wrapped.result === 'object') return coerceBookCreationPackage(wrapped.result)
  return null
}

function mergeBookCreationPackageWithFallback(
  pkg: AiBookCreationPackage | null,
  fallback: AiBookCreationPackage
): AiBookCreationPackage {
  if (!pkg) return fallback
  const volumes = Array.isArray(pkg.volumes)
    ? pkg.volumes
        .map((volume, index) => ({
          title: String(volume?.title || fallback.volumes[index]?.title || `第${index + 1}卷`),
          chapters: Array.isArray(volume?.chapters) && volume.chapters.length > 0
            ? volume.chapters.map((chapter, chapterIndex) => ({
                title: String(chapter?.title || fallback.volumes[index]?.chapters[chapterIndex]?.title || `第${chapterIndex + 1}章`),
                summary: String(chapter?.summary || fallback.volumes[index]?.chapters[chapterIndex]?.summary || ''),
                content: String(chapter?.content || fallback.volumes[index]?.chapters[chapterIndex]?.content || '')
              }))
            : fallback.volumes[index]?.chapters || fallback.volumes[0].chapters
        }))
        .filter((volume) => volume.chapters.length > 0)
    : []

  return {
    book: {
      title: String(pkg.book?.title || fallback.book.title),
      author: String(pkg.book?.author || fallback.book.author || '')
    },
    workProfile: {
      ...fallback.workProfile,
      ...(pkg.workProfile || {})
    },
    volumes: volumes.length > 0 ? volumes : fallback.volumes,
    characters: Array.isArray(pkg.characters) && pkg.characters.length > 0 ? pkg.characters : fallback.characters,
    wikiEntries: Array.isArray(pkg.wikiEntries) ? pkg.wikiEntries : fallback.wikiEntries,
    plotNodes: Array.isArray(pkg.plotNodes) ? pkg.plotNodes : fallback.plotNodes,
    foreshadowings: Array.isArray(pkg.foreshadowings) ? pkg.foreshadowings : fallback.foreshadowings
  }
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
  const genre = pickFirstBriefPart(brief.genreTheme, '新作品')
  if (genre.includes('现实')) return '平凡日子里的光'
  if (genre.includes('职场')) return '逆风向上'
  if (genre.includes('悬疑')) return '沉默的真相'
  return `${genre}新篇`
}

function buildFallbackBookCreationPackage(briefInput: AssistantCreationBrief): AiBookCreationPackage {
  const brief = normalizeCreationBrief(briefInput)
  const title = resolveFallbackBookTitle(brief)
  const genreTheme = brief.genreTheme || '让 AI 评估题材'
  const targetLength = brief.targetLength || '让 AI 评估篇幅'
  const chapterPlan = brief.chapterPlan || '按篇幅自动规划'
  const characterPlan = brief.characterPlan || '让 AI 写人物组'
  const style = brief.styleAudiencePlatform || '让 AI 评估平台'
  const world = brief.worldbuilding || '现实城市'
  const boundaries = brief.boundaries || '无明显禁区'
  const protagonist = characterPlan.includes('老王') ? '老王' : '主角'

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
            title: '第一章 开始',
            summary: `围绕${genreTheme}展开开篇，建立${protagonist}的现实处境、生活压力和主要矛盾。篇幅目标为${targetLength}，章节节奏暂按“${chapterPlan}”推进。`,
            content: ''
          }
        ]
      }
    ],
    characters: [
      {
        name: protagonist,
        faction: 'main',
        status: 'active',
        description: characterPlan
      }
    ],
    wikiEntries: [
      {
        category: '世界观',
        title: world,
        content: `初始设定方向：${world}`
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
        title: '开篇处境',
        score: 1,
        nodeType: 'main',
        description: `建立${protagonist}的日常处境和核心矛盾。`
      },
      {
        chapterNumber: 1,
        title: '变化发生',
        score: 2,
        nodeType: 'main',
        description: '用一个明确事件推动故事进入主线。'
      }
    ],
    foreshadowings: [
      {
        text: '第一章埋下后续转折的线索。',
        expectedChapter: 3,
        expectedWordCount: null
      }
    ]
  }
}

async function createBookFromPackageThroughExistingApi(
  briefInput: AssistantCreationBrief,
  pkg: AiBookCreationPackage
): Promise<AiBookCreationResult> {
  const brief = normalizeCreationBrief(briefInput)
  const book = (await window.api.createBook({
    title: String(pkg.book.title || brief.title || 'AI 新作品'),
    author: String(pkg.book.author || brief.author || '')
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

  for (const character of pkg.characters) {
    await window.api.createCharacter({
      book_id: book.id,
      name: String(character.name || '未命名角色'),
      faction: character.faction || 'neutral',
      status: character.status || 'active',
      description: character.description || '',
      custom_fields: character.customFields || {}
    })
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
      chapter_number: Number.isFinite(Number(node.chapterNumber)) ? Number(node.chapterNumber) : 0,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeJsonStringFragment(fragment: string): string {
  const safeFragment = fragment
    .replace(/\\u[0-9a-fA-F]{0,3}$/, '')
    .replace(/\\$/, '')

  try {
    return JSON.parse(`"${safeFragment}"`) as string
  } catch {
    return safeFragment
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function extractStreamingJsonStringProperty(text: string, key: string): string | null {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`).exec(text)
  const value = match ? decodeJsonStringFragment(match[1]).trim() : ''
  return value || null
}

function extractAssistantMessageFromStructuredStream(text: string): string | null {
  const parsed = extractJsonObject(text) as { assistant_message?: unknown } | null
  if (typeof parsed?.assistant_message === 'string' && parsed.assistant_message.trim()) {
    return parsed.assistant_message.trim()
  }
  return extractStreamingJsonStringProperty(text, 'assistant_message')
}

function looksLikeJsonResponse(text: string): boolean {
  const trimmed = text.trim()
  return /^(?:```json\s*)?\{/.test(trimmed) || trimmed.includes('"assistant_message"') || trimmed.includes('"brief"')
}

function buildBookshelfBriefFallbackContent(brief: AssistantCreationBrief): string {
  const missing = getCreationBriefMissingFields(brief)
  if (missing.length > 0) {
    return `还缺 ${missing.length} 个核心必填项：${missing.map((field) => field.label).join('、')}。可以在输入框上方点选，或直接输入其他内容。`
  }
  return '核心需求已齐，可以生成筹备包预览；也可以继续在输入框上方补充可选项。'
}

function buildBookshelfBriefFinalContent(rawStream: string, brief: AssistantCreationBrief): string {
  const assistantMessage = extractAssistantMessageFromStructuredStream(rawStream)
  if (assistantMessage) return assistantMessage

  if (looksLikeJsonResponse(rawStream)) {
    return buildBookshelfBriefFallbackContent(brief)
  }

  return rawStream.trim() || buildBookshelfBriefFallbackContent(brief)
}

function countStreamingMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length || 0
}

function formatBookPackageSummary(pkg: AiBookCreationPackage, title = '筹备包结构已解析'): string {
  const chapterCount = pkg.volumes.reduce(
    (total, volume) => total + (Array.isArray(volume.chapters) ? volume.chapters.length : 0),
    0
  )
  return [
    title,
    `作品：《${pkg.book.title || '未命名'}》`,
    `分卷 ${pkg.volumes.length} · 章节 ${chapterCount}`,
    `人物 ${pkg.characters.length} · 设定 ${pkg.wikiEntries.length}`,
    `剧情 ${pkg.plotNodes.length} · 伏笔 ${pkg.foreshadowings.length}`
  ].join('\n')
}

function buildBookshelfBriefStreamContent(rawStream: string): string {
  const assistantMessage = extractAssistantMessageFromStructuredStream(rawStream)
  if (assistantMessage) return assistantMessage

  const trimmed = rawStream.trim()
  if (!trimmed || looksLikeJsonResponse(trimmed)) return ''
  return trimmed
}

function buildBookPackageStreamContent(rawStream: string): string {
  const pkg = coerceBookCreationPackage(extractJsonObject(rawStream))
  if (pkg) return formatBookPackageSummary(pkg)

  const bookTitle = extractStreamingJsonStringProperty(rawStream, 'title')
  const volumeCount = countStreamingMatches(rawStream, /"chapters"\s*:/g)
  const chapterCount = countStreamingMatches(rawStream, /"summary"\s*:/g)
  const characterCount = countStreamingMatches(rawStream, /"name"\s*:/g)
  const wikiCount = countStreamingMatches(rawStream, /"category"\s*:/g)
  const plotCount = countStreamingMatches(rawStream, /"nodeType"\s*:/g)
  const foreshadowCount = countStreamingMatches(rawStream, /"expectedChapter"\s*:/g)
  const counts = [
    volumeCount ? `分卷 ${volumeCount}` : '',
    chapterCount ? `章节 ${chapterCount}` : '',
    characterCount ? `人物 ${characterCount}` : '',
    wikiCount ? `设定 ${wikiCount}` : '',
    plotCount ? `剧情 ${plotCount}` : '',
    foreshadowCount ? `伏笔 ${foreshadowCount}` : ''
  ].filter(Boolean)

  return [
    '正在解析筹备包结构...',
    bookTitle ? `作品：《${bookTitle}》` : '',
    counts.length > 0 ? `已识别：${counts.join(' · ')}` : ''
  ].filter(Boolean).join('\n')
}

function BookshelfCreationAssistantPanel() {
  const closeAiAssistant = useUIStore((s) => s.closeAiAssistant)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)
  const aiAssistantCommand = useUIStore((s) => s.aiAssistantCommand)
  const consumeAiAssistantCommand = useUIStore((s) => s.consumeAiAssistantCommand)
  const loadBooks = useBookStore((s) => s.loadBooks)
  const openBook = useBookStore((s) => s.openBook)
  const selectChapter = useChapterStore((s) => s.selectChapter)
  const [brief, setBrief] = useState<AssistantCreationBrief>({})
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [customOptionInputs, setCustomOptionInputs] = useState<Record<string, string>>({})
  const [packageDraft, setPackageDraft] = useState<AiBookCreationPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nextLocalMessageIdRef = useRef(-1)
  const sendCommandRef = useRef<(text: string) => void>(() => {})
  const missingFields = useMemo(() => getCreationBriefMissingFields(brief), [brief])
  const packageValidation = useMemo(() => validateBookCreationPackage(packageDraft), [packageDraft])
  const canConfirmBrief = isCreationBriefComplete(brief)
  const canGeneratePackage = canConfirmBrief && !loading
  const canCreate = packageValidation.ok && !creating
  const composerOptionFields = useMemo(() => {
    const normalized = normalizeCreationBrief(brief)
    const missingRequired = CREATION_BRIEF_FIELDS.filter((field) => field.required && !String(normalized[field.key] || '').trim())
    const otherFields = CREATION_BRIEF_FIELDS.filter((field) => !missingRequired.some((missing) => missing.key === field.key))
    return [...missingRequired, ...otherFields]
  }, [brief])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, loading])

  useEffect(() => {
    if (!aiAssistantCommand || aiAssistantCommand.surface !== 'bookshelf') return
    consumeAiAssistantCommand(aiAssistantCommand.id)
    if (!aiAssistantCommand.input.trim()) return
    setInput(aiAssistantCommand.input)
    if (aiAssistantCommand.autoSend) {
      window.setTimeout(() => sendCommandRef.current(aiAssistantCommand.input), 0)
    }
  }, [aiAssistantCommand, consumeAiAssistantCommand])

  const addLocalMessage = (role: AiMessage['role'], content: string, metadata?: Record<string, unknown>) => {
    const message: AiMessage = {
      id: nextLocalMessageIdRef.current,
      role,
      content,
      metadata
    }
    nextLocalMessageIdRef.current -= 1
    setMessages((current) => [...current, message])
    return message
  }

  const updateBriefField = (key: keyof AssistantCreationBrief, value: string) => {
    setBrief((current) => ({ ...current, [key]: value, confirmed: false }))
    setPackageDraft(null)
  }

  const applyBriefOption = (field: CreationBriefField, option: string, toggleSelected: boolean) => {
    setBrief((current) => {
      const currentValue = String(current[field.key] || '').trim()
      const values = currentValue.split(/[、,，]/).map((value) => value.trim()).filter(Boolean)
      const nextValue = field.multiSelect
        ? (values.includes(option) && toggleSelected
            ? values.filter((value) => value !== option).join('、')
            : values.includes(option)
              ? values.join('、')
              : [...values, option].join('、'))
        : option
      return { ...current, [field.key]: nextValue, confirmed: false }
    })
    setPackageDraft(null)
  }

  const applyBriefQuickOption = (field: CreationBriefField, option: string) => {
    applyBriefOption(field, option, true)
  }

  const updateCustomOptionInput = (field: CreationBriefField, value: string) => {
    setCustomOptionInputs((current) => ({ ...current, [field.key]: value }))
  }

  const applyCustomOptionInput = (field: CreationBriefField) => {
    const option = String(customOptionInputs[field.key] || '').trim()
    if (!option) return
    applyBriefOption(field, option, false)
    setCustomOptionInputs((current) => ({ ...current, [field.key]: '' }))
  }

  const isBriefQuickOptionSelected = (field: CreationBriefField, option: string) => {
    const value = String(brief[field.key] || '').trim()
    if (!value) return false
    const values = value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    return field.multiSelect ? values.includes(option) : value === option
  }

  const send = async (explicitInput?: string) => {
    const text = (explicitInput ?? input).trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setLoading(true)
    addLocalMessage('user', text)
    const pendingId = nextLocalMessageIdRef.current
    nextLocalMessageIdRef.current -= 1
    setMessages((current) => [
      ...current,
      createPendingAssistantStreamMessage(pendingId, 'AI 正在整理起书需求...')
    ])

    try {
      const config = await getResolvedGlobalAiConfig()
      const aiConfig = config ? ({ ...(config as AiCallerConfig), ragMode: 'off' as const }) : null
      if (!isAiConfigReady(aiConfig)) {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
        setError('请先在应用设置 / AI 与模型中完成全局 AI 配置，或完成 Gemini CLI / Ollama 设置')
        return
      }
      let streamedContent = ''
      let streamError = ''
      const queue = createAssistantStreamChunkQueue(() => {
        setMessages((current) =>
          replaceAssistantStreamContent(current, pendingId, buildBookshelfBriefStreamContent(streamedContent))
        )
      })
      await aiPromptStream(
        aiConfig,
        buildBookshelfBriefSystemPrompt(),
        buildBookshelfBriefUserPrompt({ brief, userInput: text, messages }),
        {
          onToken: (token) => {
            streamedContent += token
            queue.push(token)
          },
          onComplete: (content) => {
            streamedContent = content || streamedContent
          },
          onError: (message) => {
            streamError = message
          }
        },
        1400,
        0.55
      )
      await queue.drain()
      if (streamError) {
        setError(streamError)
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId ? { ...message, streaming: false, content: message.content || '生成失败' } : message
          )
        )
        return
      }
      const parsed = extractJsonObject(streamedContent) as
        | { assistant_message?: string; brief?: unknown; package?: unknown; bookPackage?: unknown }
        | null
      const nextBrief = parsed?.brief ? mergeCreationBrief(brief, parsed.brief) : brief
      const assistantText = buildBookshelfBriefFinalContent(streamedContent, nextBrief)
      if (parsed?.brief) {
        setBrief((current) => mergeCreationBrief(current, parsed.brief))
        setPackageDraft(null)
      }
      const maybePackage = coerceBookCreationPackage(parsed)
      if (maybePackage && isCreationBriefComplete(nextBrief)) {
        setPackageDraft(stripBookCreationChapterContent(maybePackage))
      }
      setMessages((current) =>
        completeAssistantStreamMessage(current, pendingId, Math.abs(pendingId), assistantText)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 请求失败')
      setMessages((current) => current.filter((message) => message.id !== pendingId))
    } finally {
      setLoading(false)
    }
  }

  const generatePackage = async () => {
    if (!canGeneratePackage || loading) {
      setError('请先补齐作品名、题材和篇幅这 3 个核心必填项。')
      return
    }
    setError(null)
    setLoading(true)
    setPackageDraft(null)
    setBrief((current) => ({ ...current, confirmed: true }))
    const pendingId = nextLocalMessageIdRef.current
    nextLocalMessageIdRef.current -= 1
    addLocalMessage('user', '请基于核心需求生成筹备包预览。')
    setMessages((current) => [
      ...current,
      createPendingAssistantStreamMessage(pendingId, 'AI 正在生成筹备包...')
    ])

    try {
      const config = await getResolvedGlobalAiConfig()
      const aiConfig = config ? ({ ...(config as AiCallerConfig), ragMode: 'off' as const }) : null
      if (!isAiConfigReady(aiConfig)) {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
        setError('请先在应用设置 / AI 与模型中完成全局 AI 配置，或完成 Gemini CLI / Ollama 设置')
        return
      }
      const prompt = buildBookPackagePrompt(brief)
      let streamedContent = ''
      let streamError = ''
      const queue = createAssistantStreamChunkQueue(() => {
        setMessages((current) =>
          replaceAssistantStreamContent(current, pendingId, buildBookPackageStreamContent(streamedContent))
        )
      })
      await aiPromptStream(
        aiConfig,
        prompt.systemPrompt,
        prompt.userPrompt,
        {
          onToken: (token) => {
            streamedContent += token
            queue.push(token)
          },
          onComplete: (content) => {
            streamedContent = content || streamedContent
          },
          onError: (message) => {
            streamError = message
          }
        },
        3200,
        0.72
      )
      await queue.drain()
      if (streamError) {
        setError(streamError)
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId ? { ...message, streaming: false, content: message.content || '生成失败' } : message
          )
        )
        return
      }
      const parsed = extractJsonObject(streamedContent)
      const aiPackage = coerceBookCreationPackage(parsed)
      const pkg = stripBookCreationChapterContent(
        mergeBookCreationPackageWithFallback(aiPackage, buildFallbackBookCreationPackage(brief))
      )
      const validation = validateBookCreationPackage(pkg)
      if (!validation.ok) {
        setError(validation.errors.join('；') || 'AI 返回的筹备包格式无效，请重试。')
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId ? { ...message, streaming: false, content: '筹备包格式无效，请重试。' } : message
          )
        )
        return
      }
      setPackageDraft(pkg)
      setMessages((current) =>
        completeAssistantStreamMessage(current, pendingId, Math.abs(pendingId), '筹备包预览已生成，请在右侧确认后创建作品。')
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成筹备包失败')
      setMessages((current) => current.filter((message) => message.id !== pendingId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    sendCommandRef.current = (text) => {
      void send(text)
    }
  })

  const createBookFromPackage = async () => {
    if (!packageDraft || !canCreate) return
    const packageForCreation = stripBookCreationChapterContent(packageDraft)
    setCreating(true)
    setError(null)
    try {
      const result = typeof window.api.createBookFromAiPackage === 'function'
        ? ((await window.api.createBookFromAiPackage({
            brief,
            package: packageForCreation,
            messages: messages
              .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
              .map((message) => ({
                role: message.role,
                content: message.content,
                metadata: message.metadata
              }))
          })) as AiBookCreationResult)
        : await createBookFromPackageThroughExistingApi(brief, packageForCreation)
      await loadBooks()
      if (result.book?.id) {
        openBook(result.book.id)
        if (result.firstChapterId) await selectChapter(result.firstChapterId)
        openAiAssistant()
      }
      useToastStore.getState().addToast('success', 'AI 筹备包已创建为新作品')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建作品失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-secondary)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Bot size={17} className="text-[var(--accent-primary)]" />
          <span>AI 创作助手 · 新作品</span>
        </div>
        <button
          type="button"
          onClick={closeAiAssistant}
          title="收起 AI 助手"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col border-r border-[var(--border-primary)]">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 select-text">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                  把你的脑洞直接发给我。你可以一次性回答多个方向，也可以写“章节让 AI 评估”“人物让 AI 写”；只有作品名、题材和篇幅会卡住确认。
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {resolveAssistantContext({ currentBookId: null, requestedSurface: 'bookshelf' }).quickActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => void send(action.input)}
                      className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-left transition hover:border-[var(--accent-border)]"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Sparkles size={13} className="text-[var(--accent-primary)]" /> {action.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'ml-8 border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]'
                    : 'mr-8 border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
                }`}
              >
                {message.streaming && (
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--accent-secondary)]">
                    <Loader2 size={11} className="animate-spin" />
                    <span>{message.streamingLabel || 'AI 正在回复...'}</span>
                  </div>
                )}
                {message.content}
              </div>
            ))}

            {error && (
              <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-surface)] p-2 text-xs text-[var(--danger-primary)]">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <div className="mb-2 max-h-[220px] overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-[var(--text-primary)]">快速选择</div>
                <div className="text-[10px] text-[var(--text-muted)]">可点选 / 可多选，也可输入其他</div>
              </div>
              <div className="space-y-2">
                {composerOptionFields.map((field) => {
                  const currentValue = String(brief[field.key] || '').trim()
                  return (
                    <div key={`composer-${field.key}`} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="font-semibold text-[var(--text-secondary)]">{field.label}</span>
                        <span
                          className={`rounded border px-1 py-0.5 ${
                            field.required
                              ? 'border-[var(--accent-border)] text-[var(--accent-secondary)]'
                              : 'border-[var(--border-primary)] text-[var(--text-muted)]'
                          }`}
                        >
                          {field.required ? '必填' : '可选'}
                        </span>
                        {field.multiSelect && <span className="text-[var(--text-muted)]">可多选</span>}
                        {currentValue && <span className="min-w-0 max-w-[180px] truncate text-[var(--success-primary)]">已选：{currentValue}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {field.quickOptions.map((option) => {
                          const selected = isBriefQuickOptionSelected(field, option)
                          return (
                            <button
                              key={`composer-${field.key}-${option}`}
                              type="button"
                              onClick={() => applyBriefQuickOption(field, option)}
                              className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                                selected
                                  ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                                  : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)]'
                              }`}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={customOptionInputs[field.key] || ''}
                          onChange={(event) => updateCustomOptionInput(field, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              applyCustomOptionInput(field)
                            }
                          }}
                          placeholder={`输入其他${field.label}`}
                          className="field h-7 min-w-0 flex-1 px-2 py-1 text-[10px]"
                        />
                        <button
                          type="button"
                          disabled={!String(customOptionInputs[field.key] || '').trim()}
                          onClick={() => applyCustomOptionInput(field)}
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[var(--border-primary)] px-2 text-[10px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)] disabled:opacity-40"
                          title={`加入其他${field.label}`}
                        >
                          <Plus size={11} />
                          加入
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (shouldSubmitAiAssistantInput(event)) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="描述新作品想法，或一次性回答多个编号 / 让 AI 评估"
                className="field resize-none text-xs"
              />
              <button
                type="button"
                disabled={!input.trim() || loading}
                onClick={() => void send()}
                className="primary-btn self-stretch px-3"
                title="发送"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col bg-[var(--bg-primary)]">
          <div className="border-b border-[var(--border-primary)] p-3">
            <div className="text-xs font-bold text-[var(--text-primary)]">起书需求清单</div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
              {missingFields.length === 0 ? '核心必填已齐；可选项可以留给 AI 评估。' : `还缺 ${missingFields.length} 个核心必填项。`}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {CREATION_BRIEF_FIELDS.map((field) => {
              const value = String(brief[field.key] || '')
              const complete = value.trim().length > 0
              return (
                <div key={field.key} className="block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 text-[11px] font-semibold text-[var(--text-primary)]">{field.label}</span>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                        field.required
                          ? 'border-[var(--accent-border)] text-[var(--accent-secondary)]'
                          : 'border-[var(--border-primary)] text-[var(--text-muted)]'
                      }`}
                    >
                      {field.required ? '必填' : '可选'}
                    </span>
                    {complete ? <Check size={12} className="shrink-0 text-[var(--success-primary)]" /> : null}
                  </div>
                  <textarea
                    rows={2}
                    value={value}
                    onChange={(event) => updateBriefField(field.key, event.target.value)}
                    placeholder={field.prompt}
                    className="field min-h-[54px] resize-none text-[11px]"
                  />
                </div>
              )
            })}

            <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
              <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                第一步生成筹备包预览；第二步确认预览后创建作品。
              </div>
              <button
                type="button"
                disabled={!canGeneratePackage}
                onClick={() => void generatePackage()}
                className="primary-btn w-full justify-center text-xs disabled:opacity-40"
              >
                {packageDraft ? '重新生成筹备包预览' : '确认并生成筹备包预览'}
              </button>
            </div>

            {packageDraft && (
              <div className="space-y-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-xs">
                <div className="font-bold text-[var(--warning-primary)]">筹备包预览</div>
                <div className="text-[var(--text-primary)]">《{packageDraft.book.title}》</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                  <div>分卷 {packageDraft.volumes.length}</div>
                  <div>章节 {packageDraft.volumes.flatMap((volume) => volume.chapters).length}</div>
                  <div>人物 {packageDraft.characters.length}</div>
                  <div>设定 {packageDraft.wikiEntries.length}</div>
                  <div>剧情 {packageDraft.plotNodes.length}</div>
                  <div>伏笔 {packageDraft.foreshadowings.length}</div>
                  <div className="col-span-2">正文待 AI 起草</div>
                </div>
                {packageValidation.errors.length > 0 && (
                  <div className="text-[var(--danger-primary)]">{packageValidation.errors.join('；')}</div>
                )}
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={() => void createBookFromPackage()}
                  className="primary-btn mt-2 w-full justify-center text-xs disabled:opacity-40"
                >
                  {creating ? '创建中...' : '创建作品'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AiAssistantPanel() {
  const bookId = useBookStore((s) => s.currentBookId)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const volumes = useChapterStore((s) => s.volumes)
  const createVolume = useChapterStore((s) => s.createVolume)
  const createChapter = useChapterStore((s) => s.createChapter)
  const selectChapter = useChapterStore((s) => s.selectChapter)
  const updateChapterContent = useChapterStore((s) => s.updateChapterContent)
  const updateChapterSummary = useChapterStore((s) => s.updateChapterSummary)
  const characters = useCharacterStore((s) => s.characters)
  const createCharacter = useCharacterStore((s) => s.createCharacter)
  const foreshadowings = useForeshadowStore((s) => s.foreshadowings)
  const createForeshadowing = useForeshadowStore((s) => s.createForeshadowing)
  const plotNodes = usePlotStore((s) => s.plotNodes)
  const createPlotNode = usePlotStore((s) => s.createPlotNode)
  const createWikiEntry = useWikiStore((s) => s.createEntry)
  const {
    aiAssistantSelectionText,
    aiAssistantSelectionChapterId,
    aiAssistantSelectionFrom,
    aiAssistantSelectionTo,
    aiAssistantCommand,
    closeAiAssistant,
    consumeAiAssistantCommand,
    setInlineAiDraft,
    clearInlineAiDraft,
    setAiChapterDraft,
    clearAiChapterDraft,
    openModal,
    activeModal
  } = useUIStore()

  const [conversationId, setConversationId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<AiConversationRow[]>([])
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [drafts, setDrafts] = useState<AiDraftRow[]>([])
  const [skills, setSkills] = useState<AiSkillTemplate[]>([])
  const [overrides, setOverrides] = useState<AiSkillOverride[]>([])
  const [profile, setProfile] = useState<AiWorkProfile | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationListOpen, setConversationListOpen] = useState(false)
  const [enabledContextChipIds, setEnabledContextChipIds] = useState<string[]>([])
  const [providerLabel, setProviderLabel] = useState('未配置')
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRequestAbortRef = useRef<AbortController | null>(null)
  const sendCommandRef = useRef<(text: string) => void>(() => {})

  const assistantIntent = useMemo(
    () =>
      resolveAssistantIntent({
        skills,
        userInput: input,
        selectedText: aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
        hasCurrentChapter: Boolean(currentChapter),
        hasVolumes: volumes.length > 0
      }),
    [aiAssistantSelectionChapterId, aiAssistantSelectionText, currentChapter, input, skills, volumes.length]
  )
  const selectedSkill = useMemo(() => {
    return resolveAssistantSkillSelection(skills, overrides, assistantIntent.skillKey)
  }, [skills, overrides, assistantIntent.skillKey])
  const contextPolicy = useMemo(
    () => resolveAssistantContextPolicy(selectedSkill, profile),
    [profile, selectedSkill]
  )
  const conversationItems = useMemo(
    () => buildConversationListItems(conversations, conversationId),
    [conversations, conversationId]
  )
  const baseContext = useMemo<AiAssistantContext>(() => {
    const chapterPlain = currentChapter?.content ? stripHtmlToText(currentChapter.content) : ''
    return buildAssistantContext({
      policy: contextPolicy,
      currentChapter: currentChapter
        ? { id: currentChapter.id, title: currentChapter.title, plainText: chapterPlain, summary: currentChapter.summary }
        : null,
      selectedText: aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
      characters: characters.map((character) => ({
        id: character.id,
        name: character.name,
        description: character.description
      })),
      foreshadowings: foreshadowings.map((item) => ({
        id: item.id,
        text: item.text,
        status: item.status
      })),
      plotNodes: plotNodes.map((node) => ({
        id: node.id,
        title: node.title,
        description: node.description,
        chapter_number: node.chapter_number
      }))
    })
  }, [
    aiAssistantSelectionChapterId,
    aiAssistantSelectionText,
    characters,
    currentChapter,
    foreshadowings,
    plotNodes,
    contextPolicy
  ])
  const contextDefaultsKey = useMemo(
    () => baseContext.chips.map((chip) => `${chip.id}:${chip.enabled ? '1' : '0'}`).join('|'),
    [baseContext]
  )
  const context = useMemo(
    () => applyAssistantContextSelection(baseContext, enabledContextChipIds),
    [baseContext, enabledContextChipIds]
  )
  const resolvedPanelContext = useMemo(
    () =>
      resolveAssistantContext({
        currentBookId: bookId,
        currentChapterTitle: currentChapter?.title,
        hasSelection: aiAssistantSelectionChapterId === currentChapter?.id && Boolean(aiAssistantSelectionText.trim()),
        activeModal
      }),
    [activeModal, aiAssistantSelectionChapterId, aiAssistantSelectionText, bookId, currentChapter?.id, currentChapter?.title]
  )
  const hasCurrentSelection = aiAssistantSelectionChapterId === currentChapter?.id && Boolean(aiAssistantSelectionText.trim())
  const currentChapterIsBlank = Boolean(currentChapter && isBlankChapterContent(currentChapter.content))

  const refreshConversation = useCallback(async (targetConversationId?: number | null) => {
    if (!bookId) return
    const conversation = targetConversationId
      ? ({ id: targetConversationId } as { id: number })
      : ((await window.api.aiGetOrCreateConversation(bookId)) as { id: number })
    const [conversationRows, messageRows, draftRows] = await Promise.all([
      window.api.aiGetConversations(bookId),
      window.api.aiGetMessages(conversation.id),
      window.api.aiGetDrafts(bookId, 'pending', conversation.id)
    ])
    const allDrafts = draftRows as AiDraftRow[]
    const inlineDraft = allDrafts.reduce<InlineAiDraft | null>(
      (found, draft) => found ?? toInlineAiDraft(draft, currentChapter?.id),
      null
    )
    const chapterDraft = allDrafts.reduce<AiChapterDraft | null>(
      (found, draft) => found ?? toAiChapterDraft(draft),
      null
    )
    const hiddenDraftIds = new Set(
      [inlineDraft?.id, chapterDraft?.id].filter((id): id is number => typeof id === 'number')
    )
    setMessages(messageRows as AiMessage[])
    setConversations(conversationRows as AiConversationRow[])
    setDrafts(allDrafts.filter((draft) => !hiddenDraftIds.has(draft.id)))
    if (inlineDraft) {
      setInlineAiDraft(inlineDraft)
    } else {
      clearInlineAiDraft()
    }
    if (chapterDraft) {
      const currentDraft = useUIStore.getState().aiChapterDraft
      if (currentDraft?.id !== chapterDraft.id) setAiChapterDraft(chapterDraft)
    } else {
      clearAiChapterDraft()
    }
    setConversationId(conversation.id)
  }, [bookId, clearAiChapterDraft, clearInlineAiDraft, currentChapter?.id, setAiChapterDraft, setInlineAiDraft])

  const refreshConfig = useCallback(async () => {
    if (!bookId) return
    const [skillRows, overrideRows, profileRow] = await Promise.all([
      window.api.aiGetSkillTemplates(),
      window.api.aiGetSkillOverrides(bookId),
      window.api.aiGetWorkProfile(bookId)
    ])
    setSkills(skillRows as AiSkillTemplate[])
    setOverrides(overrideRows as AiSkillOverride[])
    setProfile(profileRow as AiWorkProfile)
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    const loadAssistantState = async () => {
      const [skillRows, overrideRows, profileRow] = await Promise.all([
        window.api.aiGetSkillTemplates(),
        window.api.aiGetSkillOverrides(bookId),
        window.api.aiGetWorkProfile(bookId)
      ])
      const conversation = (await window.api.aiGetOrCreateConversation(bookId)) as { id: number }
      const [conversationRows, messageRows, draftRows] = await Promise.all([
        window.api.aiGetConversations(bookId),
        window.api.aiGetMessages(conversation.id),
        window.api.aiGetDrafts(bookId, 'pending', conversation.id)
      ])
      if (cancelled) return
      const allDrafts = draftRows as AiDraftRow[]
      const inlineDraft = allDrafts.reduce<InlineAiDraft | null>(
        (found, draft) => found ?? toInlineAiDraft(draft, currentChapter?.id),
        null
      )
      const chapterDraft = allDrafts.reduce<AiChapterDraft | null>(
        (found, draft) => found ?? toAiChapterDraft(draft),
        null
      )
      const hiddenDraftIds = new Set(
        [inlineDraft?.id, chapterDraft?.id].filter((id): id is number => typeof id === 'number')
      )
      setSkills(skillRows as AiSkillTemplate[])
      setOverrides(overrideRows as AiSkillOverride[])
      setProfile(profileRow as AiWorkProfile)
      setConversations(conversationRows as AiConversationRow[])
      setMessages(messageRows as AiMessage[])
      setDrafts(allDrafts.filter((draft) => !hiddenDraftIds.has(draft.id)))
      if (inlineDraft) {
        setInlineAiDraft(inlineDraft)
      } else {
        clearInlineAiDraft()
      }
      if (chapterDraft) {
        const currentDraft = useUIStore.getState().aiChapterDraft
        if (currentDraft?.id !== chapterDraft.id) setAiChapterDraft(chapterDraft)
      } else {
        clearAiChapterDraft()
      }
      setConversationId(conversation.id)
    }

    void loadAssistantState()
    return () => {
      cancelled = true
    }
  }, [bookId, clearAiChapterDraft, clearInlineAiDraft, currentChapter?.id, setAiChapterDraft, setInlineAiDraft])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    void getResolvedGlobalAiConfig()
      .then((config) => {
        if (!cancelled) setProviderLabel(formatProviderLabel(config?.ai_provider))
      })
      .catch(() => {
        if (!cancelled) setProviderLabel('未配置')
      })
    return () => {
      cancelled = true
    }
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    void refreshConfig()
    void refreshConversation(conversationId)
  }, [bookId, conversationId, refreshConfig, refreshConversation])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, drafts.length, loading])

  useEffect(() => {
    setEnabledContextChipIds(
      baseContext.chips.filter((chip) => chip.enabled).map((chip) => chip.id)
    )
  }, [contextDefaultsKey, baseContext])

  useEffect(() => {
    return () => {
      activeRequestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!bookId || !aiAssistantCommand || !conversationId || loading || skills.length === 0) return
    const { id, input: commandInput, autoSend } = aiAssistantCommand
    setInput(commandInput)
    consumeAiAssistantCommand(id)
    if (autoSend) {
      window.setTimeout(() => sendCommandRef.current(commandInput), 0)
    }
  }, [aiAssistantCommand, bookId, consumeAiAssistantCommand, conversationId, loading, skills.length])

  const validateSkillBeforeSend = (skill: AiSkillTemplate | null): string | null => {
    if (!skill) return null
    if (skill.key === 'polish_text' && !(aiAssistantSelectionChapterId === currentChapter?.id && aiAssistantSelectionText.trim())) {
      return '请先在编辑器中选中要润色的正文，再使用“润色改写”。'
    }
    if (skill.key === 'continue_writing' && !currentChapter) {
      return '请先打开目标章节，再使用“续写正文”。'
    }
    if (skill.key === 'review_chapter' && !currentChapter) {
      return '请先打开目标章节，再使用“审核本章”。'
    }
    return null
  }

  const send = async (explicitSkill?: AiSkillTemplate, explicitInput?: string) => {
    const text = (explicitInput ?? input).trim()
    if (!text || loading || !conversationId || !bookId) return
    const requestIntent =
      explicitSkill
        ? assistantIntent
        : resolveAssistantIntent({
            skills,
            userInput: text,
            selectedText: aiAssistantSelectionChapterId === currentChapter?.id ? aiAssistantSelectionText : '',
            hasCurrentChapter: Boolean(currentChapter),
            hasVolumes: volumes.length > 0
          })
    const skill = explicitSkill || resolveAssistantSkillSelection(skills, overrides, requestIntent.skillKey)
    const skillPreflightError = validateSkillBeforeSend(skill)
    if (skillPreflightError) {
      setError(skillPreflightError)
      return
    }
    setError(null)
    setLoading(true)
    setInput('')

    try {
      const config = await getResolvedGlobalAiConfig()
      const aiConfig = config ? ({ ...(config as AiCallerConfig), bookId, ragMode: 'auto' as const }) : null
      if (!isAiConfigReady(aiConfig)) {
        setError('请先在应用设置 / AI 与模型中完成全局 AI 配置，或完成 Gemini CLI / Ollama 设置')
        setLoading(false)
        return
      }

      const requestAbortController = new AbortController()
      activeRequestAbortRef.current = requestAbortController
      const requestContext = aiConfig.ai_provider === 'zhengdao_official' ? withLocalRagChip(context) : context

      const prompt = skill
        ? composeSkillPrompt({ skill, profile, context: requestContext, userInput: text })
        : composeAssistantChatPrompt({ profile, context: requestContext, skills, userInput: text })
      const userMessage = (await window.api.aiAddMessage(conversationId, 'user', text, {
        skill_key: skill?.key ?? null,
        mode: skill ? 'skill' : 'chat',
        intent_reason: requestIntent.reason,
        intent_confidence: requestIntent.confidence,
        context_chips: requestContext.chips
      })) as AiMessage
      const pendingMessageId = -Date.now()
      const streamingLabel =
        aiConfig.ai_provider === 'gemini_cli'
          ? 'Gemini 3 Pro 正在生成...'
          : aiConfig.ai_provider === 'zhengdao_official'
            ? '证道官方 AI 正在结合本地片段生成...'
          : 'AI 正在生成...'
      const pendingMessage = createPendingAssistantStreamMessage(pendingMessageId, streamingLabel)
      setMessages((current) => [...current, userMessage, pendingMessage])

      let streamedContent = ''
      let streamError = ''
      const streamChunkQueue = createAssistantStreamChunkQueue((token) => {
        setMessages((current) => appendAssistantStreamToken(current, pendingMessageId, token))
      })
      await aiPromptStream(
        aiConfig,
        prompt.systemPrompt,
        prompt.userPrompt,
        {
          onToken: (token) => {
            streamedContent += token
            streamChunkQueue.push(token)
          },
          onComplete: (fullText) => {
            streamedContent = fullText || streamedContent
          },
          onError: (message) => {
            streamError = message
          }
        },
        1400,
        0.72,
        { signal: requestAbortController.signal }
      )
      await streamChunkQueue.drain()

      const stopped = requestAbortController.signal.aborted

      if (stopped) {
        if (!streamedContent.trim()) {
          setMessages((current) => current.filter((message) => message.id !== pendingMessageId))
          useToastStore.getState().addToast('info', '已停止生成')
          return
        }

        const assistantMessage = (await window.api.aiAddMessage(conversationId, 'assistant', streamedContent, {
          skill_key: skill?.key ?? null,
          mode: skill ? 'skill' : 'chat',
          stopped: true
        })) as { id: number }
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? {
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: streamedContent,
                  metadata: { stopped: true }
                }
              : message
          )
        )
        useToastStore.getState().addToast('info', '已停止生成，已保留当前内容')
        await refreshConversation(conversationId)
        return
      }

      if (streamError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? { ...message, streaming: false, content: message.content || '生成失败' }
              : message
          )
        )
        setError(streamError)
        return
      }
      const emptyStreamError = getAssistantStreamEmptyError(streamedContent)
      if (emptyStreamError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? { ...message, streaming: false, content: '生成失败' }
              : message
          )
        )
        setError(emptyStreamError)
        return
      }

      const assistantMessage = (await window.api.aiAddMessage(conversationId, 'assistant', streamedContent, {
        skill_key: skill?.key ?? null,
        mode: skill ? 'skill' : 'chat',
        intent_reason: requestIntent.reason,
        intent_confidence: requestIntent.confidence
      })) as { id: number }
      setMessages((current) =>
        completeAssistantStreamMessage(current, pendingMessageId, assistantMessage.id, streamedContent).map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                metadata: {
                  skill_key: skill?.key ?? null,
                  mode: skill ? 'skill' : 'chat',
                  intent_reason: requestIntent.reason,
                  intent_confidence: requestIntent.confidence
                }
              }
            : message
        )
      )
      if (skill) {
        const parsed = normalizeAssistantDrafts(skill, streamedContent)
        const boundDrafts = attachSelectionMetaToDrafts(parsed.drafts, {
          chapterId: aiAssistantSelectionChapterId,
          text: aiAssistantSelectionText,
          from: aiAssistantSelectionFrom,
          to: aiAssistantSelectionTo
        })
        for (const draft of boundDrafts) {
          const payload =
            draft.kind === 'insert_text' || draft.kind === 'create_chapter'
              ? {
                  ...draft,
                  retry_input: text
                }
              : draft
          const createdDraft = (await window.api.aiCreateDraft({
            book_id: bookId,
            conversation_id: conversationId,
            message_id: assistantMessage.id,
            kind: payload.kind,
            title: draftTitle(payload),
            payload,
            target_ref: currentChapter ? `chapter:${currentChapter.id}` : ''
          })) as AiDraftRow
          const inlineDraft = toInlineAiDraft(createdDraft, currentChapter?.id, text)
          if (inlineDraft) setInlineAiDraft(inlineDraft)
          const chapterDraft = toAiChapterDraft(createdDraft, text)
          if (chapterDraft) setAiChapterDraft(chapterDraft)
        }
        if (parsed.errors.length > 0) {
          setError(parsed.errors.join('；'))
        }
      }
      await refreshConversation(conversationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 请求失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    sendCommandRef.current = (text) => {
      void send(undefined, text)
    }
  })

  if (!bookId) return <BookshelfCreationAssistantPanel />

  const seedQuickAction = (skill: AiSkillTemplate, actionInput?: string) => {
    if (actionInput) {
      setInput(actionInput)
    } else if (skill.key === 'continue_writing') {
      setInput(DEFAULT_CONTINUE_INPUT)
    } else if (skill.key === 'review_chapter') {
      setInput('审核当前章节的节奏、人物一致性、伏笔和毒点风险。')
    } else if (skill.key === 'polish_text') {
      setInput('润色选中文本，保留原意和人物口吻。')
    } else {
      setInput('')
    }
  }

  const markDraft = async (draftId: number, status: 'applied' | 'dismissed') => {
    await window.api.aiSetDraftStatus(draftId, status)
    await refreshConversation(conversationId)
  }

  const createConversation = async () => {
    if (!bookId || loading) return
    const conversation = (await window.api.aiCreateConversation(bookId)) as { id: number }
    await refreshConversation(conversation.id)
  }

  const clearConversation = async () => {
    if (!conversationId || loading) return
    const ok = window.confirm('确认清空当前 AI 会话的聊天记录和待确认草稿？已应用到小说的内容不会回滚。')
    if (!ok) return
    await window.api.aiClearConversation(conversationId)
    await refreshConversation(conversationId)
  }

  const deleteConversation = async (targetConversationId: number) => {
    if (!bookId || loading) return
    const ok = window.confirm('确认删除这个 AI 会话？会删除该会话的聊天记录和关联草稿，已应用到小说的内容不会回滚。')
    if (!ok) return
    const nextConversationId = pickConversationAfterDelete(conversations, targetConversationId, conversationId)
    await window.api.aiDeleteConversation(targetConversationId)
    if (nextConversationId != null) {
      await refreshConversation(nextConversationId)
      return
    }
    const conversation = (await window.api.aiCreateConversation(bookId)) as { id: number }
    await refreshConversation(conversation.id)
  }

  const applyDraft = async (draft: AiDraftRow) => {
    const payload = draft.payload
    try {
      switch (draft.kind) {
        case 'insert_text': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          const plan = planTextDraftApplication(payload as AiDraftPayload, currentChapter.id)
          if (!plan || plan.kind === 'invalid' || plan.kind !== 'insert_text') {
            throw new Error(plan?.kind === 'invalid' ? plan.error : '草稿正文为空')
          }
          const htmlFragment = ensureHtmlContent(plan.content)
          const activeEditor = getActiveEditor()
          if (activeEditor) {
            const beforeHtml = activeEditor.getHTML()
            const beforeWordCount = stripHtmlToText(beforeHtml).replace(/\s/g, '').length
            await window.api.createSnapshot({
              chapter_id: currentChapter.id,
              content: beforeHtml,
              word_count: beforeWordCount
            })
            const maxPos = activeEditor.state.doc.content.size
            const insertAt = Math.max(0, Math.min(plan.insertAt ?? maxPos, maxPos))
            const inserted = activeEditor.commands.insertContentAt(insertAt, htmlFragment)
            if (!inserted) throw new Error('无法将 AI 草稿插入当前正文。')
            const nextHtml = activeEditor.getHTML()
            await updateChapterContent(currentChapter.id, nextHtml, stripHtmlToText(nextHtml).replace(/\s/g, '').length)
          } else {
            const html = `${currentChapter.content || ''}${htmlFragment}`
            await window.api.createSnapshot({
              chapter_id: currentChapter.id,
              content: currentChapter.content || '',
              word_count: currentChapter.word_count || 0
            })
            await updateChapterContent(currentChapter.id, html, stripHtmlToText(html).replace(/\s/g, '').length)
          }
          break
        }
        case 'replace_text': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          const plan = planTextDraftApplication(payload as AiDraftPayload, currentChapter.id)
          if (!plan || plan.kind === 'invalid' || plan.kind !== 'replace_text') {
            throw new Error(plan?.kind === 'invalid' ? plan.error : '替换正文为空')
          }
          const activeEditor = getActiveEditor()
          if (!activeEditor) throw new Error('请返回编辑器后再应用润色草稿。')
          const maxPos = activeEditor.state.doc.content.size
          if (plan.from < 0 || plan.to > maxPos) {
            throw new Error('原选区已失效，请重新生成润色草稿。')
          }
          const liveText = activeEditor.state.doc.textBetween(plan.from, plan.to, '\n')
          if (liveText !== plan.expectedText) {
            throw new Error('原选区已变化，请重新生成润色草稿。')
          }
          const beforeHtml = activeEditor.getHTML()
          const beforeWordCount = stripHtmlToText(beforeHtml).replace(/\s/g, '').length
          await window.api.createSnapshot({
            chapter_id: currentChapter.id,
            content: beforeHtml,
            word_count: beforeWordCount
          })
          const replaced = activeEditor.commands.insertContentAt(
            { from: plan.from, to: plan.to },
            ensureHtmlContent(plan.content)
          )
          if (!replaced) throw new Error('无法将润色草稿应用到当前选区。')
          const nextHtml = activeEditor.getHTML()
          await updateChapterContent(currentChapter.id, nextHtml, stripHtmlToText(nextHtml).replace(/\s/g, '').length)
          break
        }
        case 'create_chapter': {
          const requestedVolumeId = Number(payload.volume_id || payload.volumeId)
          const requestedVolumeTitle = String(
            payload.volume_title || payload.volumeTitle || payload.volume || ''
          ).trim()
          let volumeId =
            Number.isFinite(requestedVolumeId) && volumes.some((volume) => volume.id === requestedVolumeId)
              ? requestedVolumeId
              : null
          if (volumeId == null && requestedVolumeTitle) {
            const existingVolume = volumes.find((volume) => volume.title.trim() === requestedVolumeTitle)
            volumeId = existingVolume?.id ?? null
            if (volumeId == null) {
              const createdVolume = await createVolume(bookId, requestedVolumeTitle)
              volumeId = createdVolume.id
            }
          }
          if (volumeId == null) {
            const fallbackVolume = volumes[volumes.length - 1] ?? (await createVolume(bookId, '第一卷'))
            volumeId = fallbackVolume.id
          }
          const content = String(payload.content || payload.body || '').trim()
          if (!content) throw new Error('章节正文为空')
          const chapter = await createChapter(
            volumeId,
            String(payload.title || draft.title || 'AI 新章节'),
            ensureHtmlContent(content),
            String(payload.summary || '').trim()
          )
          await selectChapter(chapter.id)
          break
        }
        case 'update_chapter_summary': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          if (currentChapter.summary?.trim()) {
            const ok = window.confirm('当前章节已有摘要。确定用这条 AI 摘要覆盖吗？')
            if (!ok) return
          }
          const summary = String(payload.summary || payload.content || '').trim()
          if (!summary) throw new Error('摘要内容为空')
          await updateChapterSummary(currentChapter.id, summary)
          break
        }
        case 'create_character': {
          await createCharacter({
            book_id: bookId,
            name: String(payload.name || draft.title || 'AI 角色'),
            faction: String(payload.faction || 'neutral'),
            status: String(payload.status || 'active'),
            description: String(payload.description || payload.content || ''),
            custom_fields: (payload.custom_fields || {}) as Record<string, string>
          })
          break
        }
        case 'create_wiki_entry': {
          await createWikiEntry({
            book_id: bookId,
            category: String(payload.category || 'AI 设定'),
            title: String(payload.title || draft.title || 'AI 设定'),
            content: String(payload.content || '')
          })
          break
        }
        case 'create_plot_node': {
          await createPlotNode({
            book_id: bookId,
            title: String(payload.title || draft.title || 'AI 剧情节点'),
            description: String(payload.description || payload.content || ''),
            chapter_number: Number(payload.chapter_number || 0),
            score: Math.max(-5, Math.min(5, Number(payload.score || 0))),
            node_type: payload.node_type === 'branch' ? 'branch' : 'main'
          })
          break
        }
        case 'create_foreshadowing': {
          await createForeshadowing({
            book_id: bookId,
            chapter_id: currentChapter?.id,
            text: String(payload.text || payload.content || draft.title || 'AI 伏笔'),
            expected_chapter: payload.expected_chapter == null ? null : Number(payload.expected_chapter),
            expected_word_count: payload.expected_word_count == null ? null : Number(payload.expected_word_count),
            status: 'pending'
          })
          break
        }
        // GP-05 v2: 5 个 academic / professional 题材专属 kind 的副作用。
        // 引用 / Reference / 政策对照统一落到 wiki_entries (复用 settings_wiki)
        // 用 category 区分；apply_format_template 用 DI-05 公文模板包装章节
        // 正文。create_section_outline 因为 chapters 表当前没有 outline 字段
        // 暂不支持，等 DI-02 引用管理 / DI-07 Canon Pack v2 给章节加上 outline
        // 列后再补。
        case 'create_citation': {
          const authors = Array.isArray(payload.authors)
            ? (payload.authors as unknown[]).map(String).filter(Boolean).join('，')
            : String(payload.authors || '')
          const formatted = String(
            payload.formatted ||
              `${authors}. ${String(payload.title || '')}. ${String(payload.source || '')}, ${String(payload.year || '')}.`
          ).trim()
          await createWikiEntry({
            book_id: bookId,
            category: 'citation',
            title: String(payload.title || draft.title || 'AI 引用'),
            content: JSON.stringify(
              {
                formatted,
                authors,
                year: payload.year ?? '',
                source: payload.source ?? '',
                doi: payload.doi ?? '',
                format: payload.format ?? 'GBT7714'
              },
              null,
              2
            )
          })
          break
        }
        case 'create_reference': {
          await createWikiEntry({
            book_id: bookId,
            category: 'reference',
            title: String(payload.title || draft.title || 'AI 文献'),
            content: String(payload.content || JSON.stringify(payload, null, 2))
          })
          break
        }
        case 'create_policy_anchor': {
          await createWikiEntry({
            book_id: bookId,
            category: 'policy',
            title: String(payload.title || payload.policyName || draft.title || 'AI 政策依据'),
            content: JSON.stringify(
              {
                policyNumber: payload.policyNumber ?? '',
                issuer: payload.issuer ?? '',
                date: payload.policyDate ?? payload.date ?? '',
                excerpt: payload.excerpt ?? payload.content ?? ''
              },
              null,
              2
            )
          })
          break
        }
        case 'apply_format_template': {
          if (!currentChapter) throw new Error('请先打开目标章节')
          const templateId = String(payload.templateName || payload.templateId || '')
          if (!templateId || !getProfessionalTemplate(templateId)) {
            throw new Error('未指定有效的公文模板（如 red-header-notice / request 等）')
          }
          const original = stripHtmlToText(currentChapter.content || '')
          const rawContentToWrap = String(payload.contentToWrap || original).trim()
          if (!rawContentToWrap) throw new Error('章节内容为空，无法套用公文模板')
          const fields = (payload.fields as Record<string, string>) ?? {}
          const wrapped = applyProfessionalTemplate(templateId, rawContentToWrap, fields)
          await window.api.createSnapshot({
            chapter_id: currentChapter.id,
            content: currentChapter.content ?? '',
            word_count: stripHtmlToText(currentChapter.content || '').replace(/\s/g, '').length
          })
          const wrappedHtml = wrapped
            .split('\n\n')
            .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('')
          await updateChapterContent(
            currentChapter.id,
            wrappedHtml,
            stripHtmlToText(wrappedHtml).replace(/\s/g, '').length
          )
          break
        }
        case 'create_section_outline': {
          throw new Error('章节大纲草稿暂不支持，等待 DI-02 引用管理 / DI-07 Canon Pack v2 上线后启用。')
        }
        default:
          throw new Error('暂不支持应用该草稿')
      }
      await markDraft(draft.id, 'applied')
      useToastStore.getState().addToast('success', 'AI 草稿已应用')
    } catch (err) {
      useToastStore.getState().addToast('error', err instanceof Error ? err.message : '应用草稿失败')
    }
  }

  const quickActions =
    resolvedPanelContext.surface === 'chapter_editor'
      ? buildChapterEditorQuickActions({
          currentChapter,
          volumes,
          hasSelection: hasCurrentSelection
        })
      : resolvedPanelContext.quickActions.map((action) => ({
          key: action.key,
          label: action.label,
          description: resolvedPanelContext.description,
          disabled: Boolean(action.disabled),
          input: action.input
        }))
  const showStarterActions = messages.length === 0 || (resolvedPanelContext.surface === 'chapter_editor' && currentChapterIsBlank)
  return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-secondary)]">
          <div
            className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3"
          >
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Bot size={17} className="text-[var(--accent-primary)]" />
              <span className="min-w-0 truncate">{resolvedPanelContext.title}</span>
              <span className="min-w-0 truncate rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-secondary)]">
                {providerLabel}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConversationListOpen((open) => !open)}
                title="会话列表"
                className={`rounded p-1.5 ${
                  conversationListOpen
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MessageSquare size={16} />
              </button>
              <button
                type="button"
                onClick={() => void createConversation()}
                title="新建 AI 会话"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <MessageSquarePlus size={16} />
              </button>
              <button
                type="button"
                onClick={() => void clearConversation()}
                title="清空当前会话"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-surface)] hover:text-[var(--danger-primary)]"
              >
                <Trash2 size={16} />
              </button>
              {profile?.genre === 'script' && (
                <button
                  type="button"
                  onClick={() =>
                    openModal('dialogueRewrite', {
                      selectedText:
                        aiAssistantSelectionChapterId === currentChapter?.id
                          ? aiAssistantSelectionText
                          : ''
                    })
                  }
                  title="对白块改写 (剧本)"
                  className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
                >
                  <MessagesSquare size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => openModal('worldConsistency')}
                title="世界观一致性检查 (Canon Pack)"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
              >
                <ShieldCheck size={16} />
              </button>
              {profile?.genre === 'academic' && (
                <button
                  type="button"
                  onClick={() => openModal('citationsManager')}
                  title="学术引文管理 (academic)"
                  className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
                >
                  <BookOpen size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => openModal('teamManagement')}
                title="团队空间 (DI-06)"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
              >
                <Users size={16} />
              </button>
              <button
                type="button"
                onClick={() => openModal('aiSettings')}
                title="AI 能力与上下文"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <Settings2 size={16} />
              </button>
              <button
                type="button"
                onClick={closeAiAssistant}
                title="收起 AI 助手"
                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {conversationListOpen && (
            <div
              className="absolute right-0 top-12 bottom-0 z-20 flex w-64 flex-col border-l border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border-primary)] px-3">
                <div className="text-xs font-bold text-[var(--text-primary)]">会话历史</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void createConversation()}
                    title="新建 AI 会话"
                    className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <MessageSquarePlus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConversationListOpen(false)}
                    title="关闭会话列表"
                    className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                {conversationItems.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group flex items-start gap-2 rounded-lg border p-2 ${
                      conversation.selected
                        ? 'border-[var(--accent-border)] bg-[var(--accent-surface)]'
                        : 'border-transparent hover:border-[var(--border-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void refreshConversation(conversation.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                        {conversation.label}
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {conversation.messageCount} 条消息
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                        {conversation.updatedAt}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conversation.id)}
                      title="删除会话"
                      className="rounded p-1 text-[var(--text-muted)] opacity-70 hover:bg-[var(--danger-surface)] hover:text-[var(--danger-primary)] group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 select-text">
            {showStarterActions && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
                  {resolvedPanelContext.description}
                  {resolvedPanelContext.surface === 'chapter_editor'
                    ? ' 直接输入你的写作意图即可；涉及正文和资产的结果会先进入草稿篮。'
                    : ' 直接输入目标，助手会按当前页面切换建议和输出方式。'}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {quickActions.map((action) => {
                    const skill = skills.find((item) => item.key === action.key)
                    const actionInput = (action as { input?: string }).input
                    return (
                    <button
                      key={action.key}
                      type="button"
                      disabled={(!skill && !actionInput) || action.disabled}
                      onClick={() => {
                        if (skill) seedQuickAction(skill, actionInput)
                        else if (actionInput) setInput(actionInput)
                      }}
                      className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-left transition hover:border-[var(--accent-border)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Sparkles size={13} className="text-[var(--accent-primary)]" /> {action.label}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] text-[var(--text-muted)]">{action.description}</div>
                    </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {context.chips.map((chip) => (
                <span
                  key={chip.id}
                  className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                >
                  {chip.label}
                </span>
              ))}
            </div>

            {messages.map((message) => {
              const display = buildAssistantMessageDisplay(message)
              const streamingLabel =
                message.role === 'assistant' && message.streaming
                  ? message.streamingLabel || 'AI 正在回复...'
                  : ''

              return (
                <div
                  key={message.id}
                  className={`rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'ml-8 border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]'
                      : 'mr-8 border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
                  }`}
                >
                  {streamingLabel && (
                    <div className="mb-2 flex items-center gap-1.5 whitespace-normal text-[10px] font-semibold text-[var(--accent-secondary)]">
                      <Loader2 size={11} className="animate-spin" />
                      <span>{streamingLabel}</span>
                    </div>
                  )}
                  {display.kind === 'drafts' ? (
                    <div className="space-y-2 whitespace-normal">
                      <div className="text-xs text-[var(--text-secondary)]">{display.intro}</div>
                      <div className="space-y-2">
                        {display.drafts.map((draft, index) => (
                          <div
                            key={`${draft.title}-${index}`}
                            className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2"
                          >
                            <div className="font-medium text-[var(--text-primary)]">{draft.title}</div>
                            {draft.summary && (
                              <div className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                                {draft.summary}
                              </div>
                            )}
                            {draft.fields.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {draft.fields.map((field) => (
                                  <span
                                    key={`${draft.title}-${field.label}`}
                                    className="rounded border border-[var(--border-primary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                                  >
                                    {field.label}: {field.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    display.text
                  )}
                </div>
              )
            })}

            {drafts.length > 0 && (
              <div className="space-y-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--warning-primary)]">
                  <ClipboardCheck size={14} /> 草稿篮
                </div>
                {drafts.map((draft) => {
                  const preview = buildDraftPreviewModel(draft)
                  return (
                    <div key={draft.id} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {preview.title || draft.title || draft.kind}
                          </div>
                          {preview.summary && (
                            <div className="mt-1 max-h-24 overflow-y-auto text-[11px] leading-relaxed text-[var(--text-muted)] whitespace-pre-wrap">
                              {preview.summary}
                            </div>
                          )}
                          {preview.fields.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {preview.fields.map((field) => (
                                <div
                                  key={`${draft.id}-${field.label}`}
                                  className="rounded border border-[var(--border-primary)] px-2 py-1"
                                >
                                  <div className="text-[10px] text-[var(--text-muted)]">{field.label}</div>
                                  <div className="truncate text-[11px] text-[var(--text-secondary)]">{field.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => void applyDraft(draft)}
                            title="确认应用"
                            className="rounded bg-[var(--accent-primary)] p-1.5 text-[var(--accent-contrast)] hover:bg-[var(--accent-secondary)]"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void markDraft(draft.id, 'dismissed')}
                            title="丢弃草稿"
                            className="rounded border border-[var(--border-secondary)] p-1.5 text-[var(--text-muted)] hover:text-[var(--danger-primary)]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-surface)] p-2 text-xs text-[var(--danger-primary)]">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {quickActions.map((action) => {
                const skill = skills.find((item) => item.key === action.key)
                const actionInput = (action as { input?: string }).input
                return (
                  <button
                    key={action.key}
                    type="button"
                    disabled={(!skill && !actionInput) || action.disabled || loading}
                    onClick={() => {
                      if (skill) seedQuickAction(skill, actionInput)
                      else if (actionInput) setInput(actionInput)
                    }}
                    className="truncate rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-45"
                    title={action.description}
                  >
                    {action.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (shouldSubmitAiAssistantInput(event)) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="直接描述你要 AI 做什么。Enter 发送，Shift + Enter 换行"
                className="field resize-none text-xs"
              />
              <button
                type="button"
                disabled={!input.trim() || loading}
                onClick={() => void send()}
                className="primary-btn self-stretch px-3"
                title="发送"
              >
                <Send size={15} />
              </button>
            </div>
          </div>

        </div>
  )
}

export default function AiAssistantDock() {
  const bookId = useBookStore((s) => s.currentBookId)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const aiAssistantOpen = useUIStore((s) => s.aiAssistantOpen)
  const aiAssistantLauncherPosition = useUIStore((s) => s.aiAssistantLauncherPosition)
  const setAiAssistantLauncherPosition = useUIStore((s) => s.setAiAssistantLauncherPosition)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)
  const launcherPositionRef = useRef(aiAssistantLauncherPosition)
  const launcherClickSuppressedRef = useRef(false)
  const interactionCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    launcherPositionRef.current = aiAssistantLauncherPosition
  }, [aiAssistantLauncherPosition])

  useEffect(() => {
    const handleWindowResize = () => {
      setAiAssistantLauncherPosition(launcherPositionRef.current)
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [setAiAssistantLauncherPosition])

  useEffect(() => {
    return () => {
      interactionCleanupRef.current?.()
    }
  }, [])

  if (!bookId) {
    if (!aiAssistantOpen) return null
    return (
      <div className="fixed bottom-0 right-0 top-12 z-40 w-[min(920px,calc(100vw-24px))] border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <AiAssistantPanel />
      </div>
    )
  }

  if (rightPanelOpen) return null

  const handleLauncherDragStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startPosition = launcherPositionRef.current
    const previousUserSelect = document.body.style.userSelect
    let moved = false

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        moved = true
      }
      setAiAssistantLauncherPosition(
        translateAiAssistantLauncherPosition(
          startPosition,
          deltaX,
          deltaY,
          window.innerWidth,
          window.innerHeight
        )
      )
    }

    const cleanup = () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', cleanup)
      interactionCleanupRef.current = null
      if (moved) {
        launcherClickSuppressedRef.current = true
        window.setTimeout(() => {
          launcherClickSuppressedRef.current = false
        }, 0)
      }
    }

    interactionCleanupRef.current?.()
    interactionCleanupRef.current = cleanup
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', cleanup)
  }

  return (
    <button
      type="button"
      onMouseDown={handleLauncherDragStart}
      onClick={(event) => {
        if (launcherClickSuppressedRef.current) {
          event.preventDefault()
          launcherClickSuppressedRef.current = false
          return
        }
        openAiAssistant()
      }}
      className="fixed z-40 flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-xl shadow-[0_10px_24px_rgba(63,111,159,0.22)] transition hover:bg-[var(--accent-secondary)] active:cursor-grabbing"
      style={{
        left: aiAssistantLauncherPosition.x,
        top: aiAssistantLauncherPosition.y,
        touchAction: 'none'
      }}
      title="拖动或打开 AI 创作助手"
      aria-label="拖动或打开 AI 创作助手"
    >
      <Bot size={22} />
    </button>
  )
}

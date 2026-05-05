import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronRight, Loader2, Plus, Send, Sparkles, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { aiPromptStream, getResolvedGlobalAiConfig, isAiConfigReady, type AiCallerConfig } from '@/utils/ai'
import { resolveAssistantContext } from '@/utils/ai/assistant-context'
import { shouldSubmitAiAssistantInput } from '../input-behavior'
import {
  appendAssistantStreamToken as _appendAssistantStreamToken,
  completeAssistantStreamMessage,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  replaceAssistantStreamContent
} from '../streaming-message'
import {
  CREATION_BRIEF_FIELDS,
  getAiBookCreationRequirements,
  hasCreationBriefInput,
  normalizeCreationBrief,
  stripBookCreationChapterContent,
  validateBookCreationPackage,
  type AiBookCreationPackage,
  type AssistantCreationBrief,
  type CreationBriefField
} from '../../../../../shared/ai-book-creation'
import { mergeCreationBrief } from './brief'
import { buildBookPackagePrompt, buildBookshelfBriefSystemPrompt, buildBookshelfBriefUserPrompt } from './prompts'
import {
  buildFallbackBookCreationPackage,
  coerceBookCreationPackage,
  createBookFromPackageThroughExistingApi,
  mergeBookCreationPackageWithFallback,
  type AiBookCreationResult
} from './package'
import {
  buildBookPackageStreamContent,
  buildBookshelfBriefFinalContent,
  buildBookshelfBriefStreamContent,
  extractJsonObject
} from './streaming'
import {
  CREATION_FLOW_STEPS,
  GENERATION_STAGE_ITEMS,
  resolveCreationFlowState
} from './creation-flow-state'

// Suppress the import-only-for-side-effects warning when the helper is
// not used directly here but is still exported from streaming-message.
void _appendAssistantStreamToken

/**
 * SPLIT-006 — bookshelf "create new book" assistant panel.
 *
 * Four-step flow:
 *   1. Story idea — accept one-line seed ideas.
 *   2. Optional directions — quick-pick chips let authors steer the plan.
 *   3. Plan generation — AI produces a structured AiBookCreationPackage.
 *   4. Review + create — the user confirms before anything is written.
 *      Creation calls `window.api.createBookFromAiPackage` (preferred) or
 *      falls back to a sequence of creates through the legacy IPC.
 *
 * No global state mutation outside of zustand stores; the panel is
 * self-contained and can be opened/closed without lifecycle hooks
 * elsewhere in the app.
 */

type AiMessage = {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

type ActiveOperation = 'brief' | 'package' | null

const CREATION_PLANNING_TITLE = 'AI 起书'
const CREATION_PLANNING_SUBTITLE = '先确定选题、读者、结构、风格、素材和章节安排，再开始写作。'

const ADVANCED_BRIEF_FIELD_GROUPS: Array<{
  title: string
  keys: Array<CreationBriefField['key']>
}> = [
  { title: '基础方向', keys: ['title', 'genreTheme', 'targetLength'] },
  { title: '结构方向', keys: ['chapterPlan', 'characterPlan', 'worldbuilding'] },
  { title: '风格与边界', keys: ['styleAudiencePlatform', 'boundaries', 'otherRequirements'] }
]

function cleanFieldLabel(label: string): string {
  return label.replace(/（可选）$/, '')
}

function getAdvancedFields(keys: Array<CreationBriefField['key']>): CreationBriefField[] {
  return keys
    .map((key) => CREATION_BRIEF_FIELDS.find((field) => field.key === key))
    .filter((field): field is CreationBriefField => Boolean(field))
}

export function BookshelfCreationAssistantPanel(): JSX.Element {
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
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nextLocalMessageIdRef = useRef(-1)
  const sendCommandRef = useRef<(text: string) => void>(() => {})
  const normalizedBrief = useMemo(() => normalizeCreationBrief(brief), [brief])
  const creationRequirements = useMemo(() => getAiBookCreationRequirements(brief), [brief])
  const pendingSeedIdea = input.trim()
  const effectiveBrief = useMemo(
    () =>
      normalizeCreationBrief({
        ...brief,
        seedIdea: pendingSeedIdea || brief.seedIdea
      }),
    [brief, pendingSeedIdea]
  )
  const packageValidation = useMemo(
    () => validateBookCreationPackage(packageDraft, {
      minCharacters: creationRequirements.minCharacters,
      minChapters: creationRequirements.totalChapters,
      minWikiEntries: creationRequirements.minWikiEntries,
      minPlotNodes: creationRequirements.minPlotNodes,
      minForeshadowings: creationRequirements.minForeshadowings
    }),
    [creationRequirements, packageDraft]
  )
  const canGeneratePackage = hasCreationBriefInput(effectiveBrief) && !loading
  const canCreate = packageValidation.ok && !creating
  const filledAdvancedFields = useMemo(
    () => CREATION_BRIEF_FIELDS.filter((field) => String(normalizedBrief[field.key] || '').trim()),
    [normalizedBrief]
  )
  const flowState = useMemo(
    () =>
      resolveCreationFlowState({
        hasBriefInput: hasCreationBriefInput(effectiveBrief),
        generating: loading && activeOperation === 'package',
        hasPackageDraft: Boolean(packageDraft),
        creating
      }),
    [activeOperation, creating, effectiveBrief, loading, packageDraft]
  )

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

  const addLocalMessage = (
    role: AiMessage['role'],
    content: string,
    metadata?: Record<string, unknown>
  ): AiMessage => {
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
      const values = currentValue
        .split(/[、,，]/)
        .map((value) => value.trim())
        .filter(Boolean)
      const nextValue = field.multiSelect
        ? values.includes(option) && toggleSelected
          ? values.filter((value) => value !== option).join('、')
          : values.includes(option)
            ? values.join('、')
            : [...values, option].join('、')
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
    const values = value
      .split(/[、,，]/)
      .map((item) => item.trim())
      .filter(Boolean)
    return field.multiSelect ? values.includes(option) : value === option
  }

  const send = async (explicitInput?: string) => {
    const text = (explicitInput ?? input).trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setLoading(true)
    setActiveOperation('brief')
    addLocalMessage('user', text)
    const pendingId = nextLocalMessageIdRef.current
    nextLocalMessageIdRef.current -= 1
    setMessages((current) => [
      ...current,
      createPendingAssistantStreamMessage(pendingId, 'AI 正在整理起书需求...')
    ])

    try {
      const config = await getResolvedGlobalAiConfig()
      const aiConfig = config ? { ...(config as AiCallerConfig), ragMode: 'off' as const } : null
      if (!isAiConfigReady(aiConfig)) {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
        setError(
          '请先在应用设置 / AI 与模型中完成全局 AI 配置，或完成 Gemini CLI / Ollama 设置'
        )
        return
      }
      let streamedContent = ''
      let streamError = ''
      const queue = createAssistantStreamChunkQueue(() => {
        setMessages((current) =>
          replaceAssistantStreamContent(
            current,
            pendingId,
            buildBookshelfBriefStreamContent(streamedContent)
          )
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
            message.id === pendingId
              ? { ...message, streaming: false, content: message.content || '生成失败' }
              : message
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
      if (maybePackage && hasCreationBriefInput(nextBrief)) {
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
      setActiveOperation(null)
    }
  }

  const generatePackage = async () => {
    const seedIdeaFromInput = input.trim()
    const briefForPackage = normalizeCreationBrief({
      ...brief,
      seedIdea: seedIdeaFromInput || brief.seedIdea,
      confirmed: true
    })
    if (!hasCreationBriefInput(briefForPackage) || loading) {
      setError('先写一句故事灵感，或在创作方向里点选任意一项。')
      return
    }
    setError(null)
    setLoading(true)
    setActiveOperation('package')
    setPackageDraft(null)
    setBrief(briefForPackage)
    if (seedIdeaFromInput) setInput('')
    const pendingId = nextLocalMessageIdRef.current
    nextLocalMessageIdRef.current -= 1
    addLocalMessage(
      'user',
      seedIdeaFromInput
        ? `请基于这个想法生成起书方案：${seedIdeaFromInput}`
        : '请基于当前需求生成起书方案。'
    )
    setMessages((current) => [
      ...current,
      createPendingAssistantStreamMessage(pendingId, '第 3/4 步 · 正在生成起书方案')
    ])

    try {
      const config = await getResolvedGlobalAiConfig()
      const aiConfig = config ? { ...(config as AiCallerConfig), ragMode: 'off' as const } : null
      if (!isAiConfigReady(aiConfig)) {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
        setError(
          '请先在应用设置 / AI 与模型中完成全局 AI 配置，或完成 Gemini CLI / Ollama 设置'
        )
        return
      }
      const prompt = buildBookPackagePrompt(briefForPackage)
      let streamedContent = ''
      let streamError = ''
      const queue = createAssistantStreamChunkQueue(() => {
        setMessages((current) =>
          replaceAssistantStreamContent(
            current,
            pendingId,
            buildBookPackageStreamContent(streamedContent)
          )
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
        4600,
        0.72
      )
      await queue.drain()
      if (streamError) {
        setError(streamError)
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, streaming: false, content: message.content || '生成失败' }
              : message
          )
        )
        return
      }
      const parsed = extractJsonObject(streamedContent)
      const aiPackage = coerceBookCreationPackage(parsed)
      const pkg = stripBookCreationChapterContent(
        mergeBookCreationPackageWithFallback(aiPackage, buildFallbackBookCreationPackage(briefForPackage))
      )
      const requirementsForPackage = getAiBookCreationRequirements(briefForPackage)
      const validation = validateBookCreationPackage(pkg, {
        minCharacters: requirementsForPackage.minCharacters,
        minChapters: requirementsForPackage.totalChapters,
        minWikiEntries: requirementsForPackage.minWikiEntries,
        minPlotNodes: requirementsForPackage.minPlotNodes,
        minForeshadowings: requirementsForPackage.minForeshadowings
      })
      if (!validation.ok) {
        setError(validation.errors.join('；') || 'AI 返回的起书方案格式无效，请重试。')
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, streaming: false, content: '起书方案格式无效，请重试。' }
              : message
          )
        )
        return
      }
      setPackageDraft(pkg)
      setMessages((current) =>
        completeAssistantStreamMessage(
          current,
          pendingId,
          Math.abs(pendingId),
          '起书方案已生成，请在右侧确认后创建作品。'
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成起书方案失败')
      setMessages((current) => current.filter((message) => message.id !== pendingId))
    } finally {
      setLoading(false)
      setActiveOperation(null)
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
      const result =
        typeof window.api.createBookFromAiPackage === 'function'
          ? ((await window.api.createBookFromAiPackage({
              brief,
              package: packageForCreation,
              messages: messages
                .filter(
                  (message) =>
                    message.role === 'user' || message.role === 'assistant' || message.role === 'system'
                )
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
      useToastStore.getState().addToast('success', '起书方案已创建为新作品')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建作品失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-secondary)]">
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2">
        <div className="flex min-w-0 items-start gap-2">
          <Bot size={17} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <span>{CREATION_PLANNING_TITLE}</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--text-muted)] sm:inline">
                {flowState.status}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">
              {CREATION_PLANNING_SUBTITLE}
            </div>
          </div>
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

      <div className="grid shrink-0 grid-cols-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2">
        {CREATION_FLOW_STEPS.map((item) => {
          const active = item.step === flowState.step
          const completed = item.step < flowState.step
          return (
            <div key={item.step} className="flex min-w-0 items-center gap-1.5 pr-2">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                  active
                    ? 'border-[var(--accent-border)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : completed
                      ? 'border-[var(--success-primary)] bg-[var(--success-primary)] text-[var(--accent-contrast)]'
                      : 'border-[var(--border-secondary)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                }`}
              >
                {completed ? <Check size={11} /> : item.step}
              </div>
              <div className="min-w-0">
                <div
                  className={`truncate text-[11px] font-bold ${
                    active || completed ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {item.title}
                </div>
                <div className="truncate text-[10px] text-[var(--text-muted)]">{item.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col border-r border-[var(--border-primary)]">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 select-text">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {CREATION_PLANNING_SUBTITLE} 书名、篇幅、人物、章节和设定都可以留空，AI 会先生成可确认的起书方案。
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {resolveAssistantContext({ currentBookId: null, requestedSurface: 'bookshelf' }).quickActions.map(
                    (action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => void send(action.input)}
                        className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-left transition hover:border-[var(--accent-border)]"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                          <Sparkles size={13} className="text-[var(--accent-primary)]" />
                          {action.label}
                        </div>
                      </button>
                    )
                  )}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-[var(--text-primary)]">
                  故事灵感
                </label>
                <span className="text-[10px] text-[var(--text-muted)]">
                  不确定也可以只写人物、场景或冲突
                </span>
              </div>
              <textarea
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (shouldSubmitAiAssistantInput(event)) {
                    event.preventDefault()
                    void generatePackage()
                  }
                }}
                placeholder="例：一个退休刑警回到小镇，发现二十年前的旧案和女儿失踪有关。"
                className="field resize-none text-xs"
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <button
                  type="button"
                  disabled={!canGeneratePackage}
                  onClick={() => void generatePackage()}
                  className="primary-btn justify-center text-xs disabled:opacity-40"
                >
                  {packageDraft ? '重新生成起书方案' : '生成起书方案'}
                </button>
                <button
                  type="button"
                  disabled={!input.trim() || loading}
                  onClick={() => void send()}
                  className="inline-flex items-center justify-center gap-1 rounded border border-[var(--border-primary)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)] disabled:opacity-40"
                  title="让 AI 先梳理想法"
                >
                  <Send size={14} />
                  先整理想法
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col bg-[var(--bg-primary)]">
          <div className="border-b border-[var(--border-primary)] p-3">
            <div className="text-xs font-bold text-[var(--text-primary)]">起书工作台</div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
              {flowState.status}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[var(--text-primary)]">故事灵感</div>
                {(normalizedBrief.seedIdea || pendingSeedIdea) && (
                  <Check size={12} className="shrink-0 text-[var(--success-primary)]" />
                )}
              </div>
              <div className="min-h-[34px] whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {normalizedBrief.seedIdea || pendingSeedIdea || '未填写；写一句即可进入第 2 步。'}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[var(--text-primary)]">已选方向</div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {filledAdvancedFields.length}/{CREATION_BRIEF_FIELDS.length}
                </div>
              </div>
              {filledAdvancedFields.length > 0 ? (
                <div className="space-y-1">
                  {filledAdvancedFields.map((field) => (
                    <div key={`summary-${field.key}`} className="text-[11px] text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">{field.label}：</span>
                      {String(normalizedBrief[field.key] || '')}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                  还没有选择方向；AI 会先补齐书名、题材、篇幅、人物、章节、风格和边界。
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  创作方向（可选）
                </span>
                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                  不填也能生成，可随时修改
                </span>
              </button>
              {advancedOpen && (
                <div className="space-y-3 border-t border-[var(--border-primary)] p-3">
                  {ADVANCED_BRIEF_FIELD_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[10px] font-bold text-[var(--text-muted)]">
                        {group.title}
                      </div>
                      {getAdvancedFields(group.keys).map((field) => {
                        const currentValue = String(brief[field.key] || '').trim()
                        return (
                          <div key={`advanced-${field.key}`} className="space-y-1 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                            <div className="flex items-center justify-between gap-2 text-[10px]">
                              <span className="font-semibold text-[var(--text-secondary)]">
                                {field.label}
                              </span>
                              <span className="text-[var(--text-muted)]">
                                {currentValue ? '已选' : '可留空'}
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              value={currentValue}
                              onChange={(event) => updateBriefField(field.key, event.target.value)}
                              placeholder={field.prompt}
                              className="field min-h-[48px] resize-none text-[11px]"
                            />
                            <div className="flex flex-wrap gap-1">
                              {field.quickOptions.map((option) => {
                                const selected = isBriefQuickOptionSelected(field, option)
                                return (
                                  <button
                                    key={`advanced-${field.key}-${option}`}
                                    type="button"
                                    onClick={() => applyBriefQuickOption(field, option)}
                                    className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                                      selected
                                        ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                                        : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)]'
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
                                placeholder={`输入其他${cleanFieldLabel(field.label)}`}
                                className="field h-7 min-w-0 flex-1 px-2 py-1 text-[10px]"
                              />
                              <button
                                type="button"
                                disabled={!String(customOptionInputs[field.key] || '').trim()}
                                onClick={() => applyCustomOptionInput(field)}
                                className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[var(--border-primary)] px-2 text-[10px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)] disabled:opacity-40"
                                title={`加入其他${cleanFieldLabel(field.label)}`}
                              >
                                <Plus size={11} />
                                加入
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading && activeOperation === 'package' && (
              <div className="space-y-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-surface)] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[var(--accent-secondary)]">
                  <Loader2 size={13} className="animate-spin" />
                  正在第 3/4 步 · 生成起书方案
                </div>
                <div className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  这一步会依次完成，不显示虚假百分比：
                </div>
                <div className="flex flex-wrap gap-1">
                  {GENERATION_STAGE_ITEMS.map((item) => (
                    <span
                      key={item}
                      className="rounded border border-[var(--accent-border)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {packageDraft ? (
              <div className="space-y-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-xs">
                <div className="font-bold text-[var(--warning-primary)]">起书方案预览</div>
                <div className="text-[var(--text-primary)]">《{packageDraft.book.title}》</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                  <div>分卷 {packageDraft.volumes.length}</div>
                  <div>
                    章节 {packageDraft.volumes.flatMap((volume) => volume.chapters).length}
                  </div>
                  <div>人物 {packageDraft.characters.length}</div>
                  <div>关系 {packageDraft.relations?.length || 0}</div>
                  <div>设定 {packageDraft.wikiEntries.length}</div>
                  <div>剧情 {packageDraft.plotNodes.length}</div>
                  <div>伏笔 {packageDraft.foreshadowings.length}</div>
                  <div className="col-span-2">正文不会直接写入</div>
                </div>
                <div className="space-y-2 border-t border-[var(--warning-border)] pt-2">
                  <div className="text-[11px] font-bold text-[var(--text-primary)]">分卷章节</div>
                  {packageDraft.volumes.slice(0, 6).map((volume, volumeIndex) => (
                    <div key={`preview-volume-${volumeIndex}`} className="space-y-1">
                      <div className="text-[11px] font-semibold text-[var(--text-secondary)]">{volume.title}</div>
                      {volume.chapters.slice(0, 12).map((chapter, chapterIndex) => (
                        <div key={`preview-chapter-${volumeIndex}-${chapterIndex}`} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                          <div className="text-[11px] font-semibold text-[var(--text-primary)]">{chapter.title}</div>
                          <div className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
                            {chapter.summary || '摘要待补齐'}
                          </div>
                        </div>
                      ))}
                      {volume.chapters.length > 12 && (
                        <div className="text-[10px] text-[var(--text-muted)]">另 {volume.chapters.length - 12} 章</div>
                      )}
                    </div>
                  ))}
                  {packageDraft.volumes.length > 6 && (
                    <div className="text-[10px] text-[var(--text-muted)]">另 {packageDraft.volumes.length - 6} 卷</div>
                  )}
                </div>
                <div className="space-y-1 border-t border-[var(--warning-border)] pt-2">
                  <div className="text-[11px] font-bold text-[var(--text-primary)]">人物</div>
                  {packageDraft.characters.slice(0, 12).map((character, index) => (
                    <div key={`preview-character-${character.name}-${index}`} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                      <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                        {character.name}
                        {character.customFields?.role ? ` · ${character.customFields.role}` : ''}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
                        {character.customFields?.personality || character.description || '人设待补齐'}
                      </div>
                    </div>
                  ))}
                  {packageDraft.characters.length > 12 && (
                    <div className="text-[10px] text-[var(--text-muted)]">另 {packageDraft.characters.length - 12} 人物</div>
                  )}
                </div>
                <div className="space-y-1 border-t border-[var(--warning-border)] pt-2">
                  <div className="text-[11px] font-bold text-[var(--text-primary)]">设定 / 剧情 / 伏笔</div>
                  {packageDraft.wikiEntries.slice(0, 4).map((entry, index) => (
                    <div key={`preview-wiki-${entry.category}-${entry.title}-${index}`} className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">{entry.category} · {entry.title}：</span>
                      {entry.content}
                    </div>
                  ))}
                  {packageDraft.plotNodes.slice(0, 10).map((node, index) => (
                    <div key={`preview-plot-${node.chapterNumber}-${index}`} className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">Ch.{node.chapterNumber} {node.title}：</span>
                      {node.description}
                    </div>
                  ))}
                  {packageDraft.plotNodes.length > 10 && (
                    <div className="text-[10px] text-[var(--text-muted)]">另 {packageDraft.plotNodes.length - 10} 个剧情节点</div>
                  )}
                  {packageDraft.foreshadowings.slice(0, 4).map((item, index) => (
                    <div key={`preview-foreshadow-${index}`} className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">伏笔：</span>
                      {item.text}
                      {item.expectedChapter ? `（第 ${item.expectedChapter} 章回收）` : ''}
                    </div>
                  ))}
                </div>
                {packageValidation.errors.length > 0 && (
                  <div className="text-[var(--danger-primary)]">
                    {packageValidation.errors.join('；')}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={() => void createBookFromPackage()}
                  className="primary-btn mt-2 w-full justify-center text-xs disabled:opacity-40"
                >
                  {creating ? '正在创建...' : '确认创建作品'}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
                生成起书方案后，这里会预览分卷、章节、人物、关系、设定、剧情节点和伏笔。正文不会直接写入。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

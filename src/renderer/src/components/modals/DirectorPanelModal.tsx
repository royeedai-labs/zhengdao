import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Clapperboard,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  X,
  XCircle
} from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { GENRE_LABELS, GENRES, type Genre } from '../../../../shared/genre'
import type {
  DirectorCanonContext,
  DirectorChapterCache,
  DirectorEvent,
  DirectorRemoteRun,
  DirectorRunLink,
  DirectorStepName
} from '../../../../shared/director'
import type { StoryBibleSnapshot } from '../../../../shared/story-bible'

const STEP_OPTIONS: DirectorStepName[] = [
  'world',
  'characters',
  'outline',
  'volume_strategy',
  'rhythm_breakdown',
  'planning_audit',
  'chapter_draft'
]

const CREATION_PLANNING_TITLE = '创作策划'
const CREATION_PLANNING_SUBTITLE = '先确定选题、读者、结构、风格、素材和章节安排，再开始写作。'

async function buildDirectorCanonContext(bookId: number): Promise<DirectorCanonContext> {
  const book = useBookStore.getState().books.find((item) => item.id === bookId)
  await Promise.all([
    useChapterStore.getState().loadVolumes(bookId),
    useCharacterStore.getState().loadCharacters(bookId),
    usePlotStore.getState().loadPlotNodes(bookId),
    useForeshadowStore.getState().loadForeshadowings(bookId)
  ])
  const profile = (await window.api.aiGetWorkProfile(bookId)) as
    | {
        style_guide?: string
        genre_rules?: string
        content_boundaries?: string
        rhythm_rules?: string
        asset_rules?: string
        style_fingerprint?: string
      }
    | null
  const storyBible = (await window.api.aiGetStoryBible(bookId).catch(() => null)) as StoryBibleSnapshot | null
  const volumes = useChapterStore.getState().volumes
  const characters = useCharacterStore.getState().characters
  const plotNodes = usePlotStore.getState().plotNodes
  const foreshadowings = useForeshadowStore.getState().foreshadowings
  let chapterNumber = 0

  return {
    bookTitle: book?.title,
    storyBible: storyBible || undefined,
    workProfile: {
      styleGuide: profile?.style_guide || '',
      styleFingerprint: profile?.style_fingerprint || '',
      genreRules: profile?.genre_rules || '',
      contentBoundaries: profile?.content_boundaries || '',
      rhythmRules: profile?.rhythm_rules || '',
      assetRules: profile?.asset_rules || ''
    },
    characters: characters.slice(0, 20).map((character) => ({
      name: character.name,
      description: character.description || '',
      faction: character.faction || '',
      status: character.status || ''
    })),
    plotNodes: plotNodes.slice(0, 40).map((node) => ({
      chapterNumber: node.chapter_number,
      title: node.title,
      score: node.score,
      description: node.description || ''
    })),
    foreshadowings: foreshadowings.slice(0, 30).map((item) => ({
      text: item.text,
      status: item.status,
      expectedChapter: item.expected_chapter ?? null
    })),
    chapters: volumes.flatMap((volume) =>
      (volume.chapters || []).map((chapter) => ({
        chapterNumber: ++chapterNumber,
        title: chapter.title,
        summary: chapter.summary || ''
      }))
    ),
    minimumCharacterCount: Math.max(2, characters.length)
  }
}

export default function DirectorPanelModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const bookId = useBookStore((s) => s.currentBookId)
  const addToast = useToastStore((s) => s.addToast)
  const [seed, setSeed] = useState('')
  const [genre, setGenre] = useState<Genre>('webnovel')
  const [targetChapterCount, setTargetChapterCount] = useState('')
  const [runs, setRuns] = useState<DirectorRunLink[]>([])
  const [activeRunId, setActiveRunId] = useState('')
  const [remoteRun, setRemoteRun] = useState<DirectorRemoteRun | null>(null)
  const [chapters, setChapters] = useState<DirectorChapterCache[]>([])
  const [events, setEvents] = useState<DirectorEvent[]>([])
  const [regenerateStep, setRegenerateStep] = useState<DirectorStepName>('planning_audit')
  const [loading, setLoading] = useState(false)
  const cleanupRef = useRef<null | (() => Promise<void>)>(null)

  const refreshRuns = useCallback(async () => {
    if (!bookId) return
    const list = await window.api.director.listRuns(bookId) as DirectorRunLink[]
    setRuns(list)
    if (!activeRunId && list[0]) setActiveRunId(list[0].remote_run_id)
  }, [activeRunId, bookId])

  const refreshActiveRun = useCallback(async (runId: string) => {
    if (!runId) return
    try {
      const [run, cachedChapters] = await Promise.all([
        window.api.director.getRun(runId) as Promise<DirectorRemoteRun>,
        window.api.director.listChapters(runId) as Promise<DirectorChapterCache[]>
      ])
      setRemoteRun(run)
      setChapters(cachedChapters)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    }
  }, [addToast])

  useEffect(() => {
    void refreshRuns()
  }, [refreshRuns])

  useEffect(() => {
    void refreshActiveRun(activeRunId)
  }, [activeRunId, refreshActiveRun])

  useEffect(() => () => {
    void cleanupRef.current?.()
  }, [])

  const subscribe = async (runId: string) => {
    await cleanupRef.current?.()
    cleanupRef.current = await window.api.director.subscribeProgress(runId, {
      onEvent: (event) => {
        setEvents((current) => [event, ...current].slice(0, 80))
        if (event.type === 'run_completed' || event.type === 'run_failed') {
          void refreshActiveRun(runId)
          void refreshRuns()
        }
      },
      onError: (message) => addToast('error', message),
      onDone: () => void refreshActiveRun(runId)
    })
  }

  const startRun = async () => {
    if (!bookId) return
    const trimmed = seed.trim()
    if (trimmed.length < 4) {
      addToast('error', '请输入至少 4 个字符的创作种子')
      return
    }
    setLoading(true)
    try {
      const canonContext = await buildDirectorCanonContext(bookId)
      const target = Number(targetChapterCount)
      const result = await window.api.director.startRun({
        bookId,
        seed: trimmed,
        genre,
        options: {
          mode: 'plan_only',
          ...(Number.isFinite(target) && target > 0 ? { targetChapterCount: Math.round(target) } : {}),
          canonContext
        }
      }) as { runId: string }
      setActiveRunId(result.runId)
      setEvents([])
      await refreshRuns()
      await subscribe(result.runId)
      addToast('success', '创作策划已启动')
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (action: 'pauseRun' | 'resumeRun' | 'cancelRun') => {
    if (!activeRunId) return
    setLoading(true)
    try {
      const run = await window.api.director[action](activeRunId) as DirectorRemoteRun
      setRemoteRun(run)
      await refreshRuns()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const doRegenerate = async () => {
    if (!activeRunId) return
    setLoading(true)
    try {
      const run = await window.api.director.regenerateStep(activeRunId, regenerateStep) as DirectorRemoteRun
      setRemoteRun(run)
      addToast('success', `已记录 ${regenerateStep} 重新生成请求`)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const acceptChapter = async (chapterId: string) => {
    if (!bookId || !activeRunId) return
    try {
      await window.api.director.acceptChapter({ bookId, runId: activeRunId, chapterId })
      await refreshActiveRun(activeRunId)
      addToast('success', '章节已进入 AI 草稿篮')
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    }
  }

  const rejectChapter = async (chapterId: string) => {
    if (!activeRunId) return
    try {
      await window.api.director.rejectChapter(activeRunId, chapterId)
      await refreshActiveRun(activeRunId)
      addToast('success', '章节已拒绝')
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <Clapperboard size={18} className="mt-0.5 shrink-0 text-[var(--accent-secondary)]" />
            <div className="min-w-0">
              <div className="font-bold text-[var(--text-primary)]">Pro 自动导演 · {CREATION_PLANNING_TITLE}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{CREATION_PLANNING_SUBTITLE}</div>
            </div>
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden">
          <aside className="flex flex-col gap-3 overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Seed
              <textarea
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="field mt-1 min-h-[120px] w-full resize-none text-xs"
                placeholder="一句话输入故事核心、主角、冲突和目标"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                Genre
                <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)} className="field mt-1 w-full text-xs">
                  {GENRES.map((item) => (
                    <option key={item} value={item}>{GENRE_LABELS[item]}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                策划章节数
                <input
                  type="number"
                  min={1}
                  value={targetChapterCount}
                  onChange={(e) => setTargetChapterCount(e.target.value)}
                  className="field mt-1 w-full text-xs"
                  placeholder="按篇幅推导"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void startRun()}
              disabled={!bookId || loading}
              className="inline-flex items-center justify-center gap-2 rounded bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--accent-contrast)] disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              启动创作策划
            </button>

            <div className="rounded-lg border border-[var(--border-primary)]">
              <div className="border-b border-[var(--border-primary)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]">
                本地 run 缓存
              </div>
              {runs.length === 0 ? (
                <div className="p-3 text-xs text-[var(--text-muted)]">暂无 run</div>
              ) : (
                <ul className="divide-y divide-[var(--border-primary)]">
                  {runs.map((run) => (
                    <li key={run.remote_run_id}>
                      <button
                        type="button"
                        onClick={() => setActiveRunId(run.remote_run_id)}
                        className={`w-full p-3 text-left text-xs ${
                          run.remote_run_id === activeRunId
                            ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        <div className="truncate font-mono">{run.remote_run_id}</div>
                        <div className="mt-1 text-[10px] text-[var(--text-muted)]">{run.status} · {run.genre}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <section className="border-b border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-[var(--text-primary)]">{activeRunId || '未选择 run'}</div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {remoteRun ? `${remoteRun.status} · ${remoteRun.currentStep || 'no active step'} · $${remoteRun.costUsd ?? 0}` : '选择 run 后显示远端状态'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void subscribe(activeRunId)} disabled={!activeRunId} className="secondary-btn text-xs">
                    <Play size={12} /> 订阅
                  </button>
                  <button type="button" onClick={() => void runAction('pauseRun')} disabled={!activeRunId} className="secondary-btn text-xs">
                    <Pause size={12} /> 暂停
                  </button>
                  <button type="button" onClick={() => void runAction('resumeRun')} disabled={!activeRunId} className="secondary-btn text-xs">
                    <Play size={12} /> 恢复
                  </button>
                  <button type="button" onClick={() => void runAction('cancelRun')} disabled={!activeRunId} className="secondary-btn text-xs text-[var(--danger-primary)]">
                    <Square size={12} /> 取消
                  </button>
                  <select value={regenerateStep} onChange={(e) => setRegenerateStep(e.target.value as DirectorStepName)} className="field h-8 text-xs">
                    {STEP_OPTIONS.map((step) => <option key={step} value={step}>{step}</option>)}
                  </select>
                  <button type="button" onClick={() => void doRegenerate()} disabled={!activeRunId} className="secondary-btn text-xs">
                    <RotateCcw size={12} /> 重跑
                  </button>
                </div>
              </div>
            </section>

            <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
              <div className="overflow-y-auto p-4">
                <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
                  {remoteRun?.planningPack ? CREATION_PLANNING_TITLE : '章节草稿'}
                </h3>
                {remoteRun?.planningPack ? (
                  <div className="space-y-3">
                    <article className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                            {remoteRun.planningPack.promise.premise}
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            {remoteRun.planningPack.qualityReport.status} · {remoteRun.planningPack.rhythmProfile.rhythmType}
                          </div>
                        </div>
                      </div>
                      <dl className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-2">
                        <div>
                          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Reader promise</dt>
                          <dd>{remoteRun.planningPack.promise.readerExpectation}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Central question</dt>
                          <dd>{remoteRun.planningPack.promise.centralQuestion}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Benefit rule</dt>
                          <dd>{remoteRun.planningPack.rhythmProfile.readerBenefitPrinciple}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Audit rule</dt>
                          <dd>{remoteRun.planningPack.qualityReport.dynamicStandard}</dd>
                        </div>
                      </dl>
                    </article>

                    {remoteRun.planningPack.qualityReport.issues.length > 0 && (
                      <article className="rounded-lg border border-[var(--warning-primary)] bg-[var(--warning-surface)] p-3">
                        <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">审校问题</h4>
                        <ol className="space-y-2 text-xs text-[var(--text-secondary)]">
                          {remoteRun.planningPack.qualityReport.issues.map((issue, index) => (
                            <li key={`${issue.scope}-${index}`}>
                              <span className="font-semibold text-[var(--text-primary)]">{issue.scope}</span>
                              <span> · {issue.message}</span>
                              <div className="mt-1 text-[var(--text-muted)]">{issue.recommendation}</div>
                            </li>
                          ))}
                        </ol>
                      </article>
                    )}

                    <div className="space-y-2">
                      {remoteRun.planningPack.chapters.map((chapter) => (
                        <article key={chapter.chapterIndex} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                          <div className="text-sm font-bold text-[var(--text-primary)]">
                            {chapter.chapterIndex}. {chapter.title}
                          </div>
                          <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{chapter.purpose}</p>
                          <dl className="mt-2 grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-2">
                            <div>
                              <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Reader benefit</dt>
                              <dd>{chapter.readerBenefit}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Hook / payoff</dt>
                              <dd>{chapter.payoffOrHook}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Obstacle / cost</dt>
                              <dd>{chapter.obstacle} / {chapter.cost}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Scene anchors</dt>
                              <dd>{chapter.sceneAnchors?.smell} · {chapter.sceneAnchors?.sound} · {chapter.sceneAnchors?.eraProp}</dd>
                            </div>
                          </dl>
                          {chapter.clueFragments?.length > 0 && (
                            <div className="mt-2 rounded border border-[var(--border-secondary)] p-2 text-[11px] text-[var(--text-secondary)]">
                              <div className="mb-1 font-semibold text-[var(--text-primary)]">线索三分</div>
                              {chapter.clueFragments.map((fragment, index) => (
                                <div key={`${chapter.chapterIndex}-clue-${index}`}>
                                  {index + 1}. {fragment.fragment} · {fragment.source}
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : chapters.length === 0 ? (
                  <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 text-center text-xs text-[var(--text-muted)]">
                    暂无章节草稿
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chapters.map((chapter) => (
                      <article key={chapter.remote_chapter_id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                              {chapter.chapter_index}. {chapter.title}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{chapter.status}</div>
                          </div>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => void acceptChapter(chapter.remote_chapter_id)} className="rounded p-1 text-[var(--success-primary)] hover:bg-[var(--success-surface)]" title="接受到 AI 草稿篮">
                              <CheckCircle2 size={15} />
                            </button>
                            <button type="button" onClick={() => void rejectChapter(chapter.remote_chapter_id)} className="rounded p-1 text-[var(--danger-primary)] hover:bg-[var(--danger-surface)]" title="拒绝">
                              <XCircle size={15} />
                            </button>
                          </div>
                        </div>
                        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-[var(--text-secondary)]">
                          {chapter.content}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <aside className="overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">SSE 事件</h3>
                  <button type="button" onClick={() => setEvents([])} className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--danger-primary)]">
                    <Trash2 size={14} />
                  </button>
                </div>
                {events.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)]">暂无事件</div>
                ) : (
                  <ol className="space-y-2">
                    {events.map((event, index) => (
                      <li key={`${event.type}-${event.ts}-${index}`} className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2 text-[11px]">
                        <div className="font-mono text-[var(--accent-secondary)]">{event.type}</div>
                        <div className="mt-1 text-[var(--text-muted)]">{event.ts}</div>
                        {'stepName' in event && <div className="mt-1 text-[var(--text-primary)]">{event.stepName}</div>}
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

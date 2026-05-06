import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Bot, ChevronDown, Database } from 'lucide-react'
import BottomPanel from '@/components/bottom-panel/BottomPanel'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useUIStore } from '@/stores/ui-store'

type TerminalTab = 'sandbox' | 'stats' | 'ai' | 'canon'

type TerminalMetrics = {
  loading: boolean
  todayWords: number
  monthWords: number
  sessionsToday: number
  streak: number
  conversations: number
  pendingDrafts: number
  appliedDrafts: number
  dismissedDrafts: number
  draftApplyRate: number
  draftDismissRate: number
  firstUsefulMinutes: number | null
  draftActiveDays7: number
  draftActiveDays30: number
  recentDrafts: Array<{ id: number; title: string; status: string; created_at?: string }>
}

const EMPTY_METRICS: TerminalMetrics = {
  loading: false,
  todayWords: 0,
  monthWords: 0,
  sessionsToday: 0,
  streak: 0,
  conversations: 0,
  pendingDrafts: 0,
  appliedDrafts: 0,
  dismissedDrafts: 0,
  draftApplyRate: 0,
  draftDismissRate: 0,
  firstUsefulMinutes: null,
  draftActiveDays7: 0,
  draftActiveDays30: 0,
  recentDrafts: []
}

function toLocalDateString(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function firstDayOfMonth(date: Date): string {
  return toLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1))
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function safeArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function parseTime(value: string | undefined): number | null {
  if (!value) return null
  const time = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(time) ? time : null
}

function activeDaysWithin(rows: Array<{ created_at?: string }>, days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const keys = new Set<string>()
  for (const row of rows) {
    const time = parseTime(row.created_at)
    if (time == null || time < cutoff) continue
    keys.add(toLocalDateString(new Date(time)))
  }
  return keys.size
}

function minutesLabel(value: number | null): string {
  if (value == null) return '暂无'
  if (value < 60) return `${value} 分钟`
  return `${Math.round(value / 60)} 小时`
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)]">{hint}</div>}
    </div>
  )
}

export default function TerminalArea() {
  const [activeTab, setActiveTab] = useState<TerminalTab>('sandbox')
  const [metrics, setMetrics] = useState<TerminalMetrics>(EMPTY_METRICS)
  const bookId = useBookStore((s) => s.currentBookId)
  const setBottomPanelOpen = useUIStore((s) => s.setBottomPanelOpen)
  const volumes = useChapterStore((s) => s.volumes)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const chapterSaveStatus = useUIStore((s) => s.chapterSaveStatus)
  const characters = useCharacterStore((s) => s.characters)
  const plotNodes = usePlotStore((s) => s.plotNodes)
  const plotlines = usePlotStore((s) => s.plotlines)
  const foreshadowings = useForeshadowStore((s) => s.foreshadowings)

  const chapterCount = useMemo(
    () => volumes.reduce((count, volume) => count + (volume.chapters?.length ?? 0), 0),
    [volumes]
  )

  const totalWords = useMemo(
    () =>
      volumes.reduce(
        (sum, volume) =>
          sum + (volume.chapters?.reduce((chapterSum, chapter) => chapterSum + chapter.word_count, 0) ?? 0),
        0
      ),
    [volumes]
  )

  useEffect(() => {
    if (!bookId) {
      setMetrics(EMPTY_METRICS)
      return
    }

    let cancelled = false
    setMetrics((current) => ({ ...current, loading: true }))

    const today = new Date()
    const todayKey = toLocalDateString(today)
    const monthStart = firstDayOfMonth(today)

    Promise.all([
      window.api.getDailyStats(bookId, todayKey),
      window.api.getStatsRange(bookId, monthStart, todayKey),
      window.api.getSessionsToday(bookId),
      window.api.getAchievementStats(bookId),
      window.api.aiGetConversations(bookId),
      window.api.aiGetDrafts(bookId, 'all')
    ])
      .then(([dailyStats, monthStats, sessions, achievementStats, conversations, drafts]) => {
        if (cancelled) return
        const monthRows = safeArray<{ word_count?: number }>(monthStats)
        const draftRows = safeArray<{ id: number; title?: string; status?: string; created_at?: string }>(drafts)
        const appliedDrafts = draftRows.filter((draft) => draft.status === 'applied')
        const dismissedDrafts = draftRows.filter((draft) => draft.status === 'dismissed')
        const decidedDrafts = appliedDrafts.length + dismissedDrafts.length
        const firstDraftTime = draftRows
          .map((draft) => parseTime(draft.created_at))
          .filter((time): time is number => time != null)
          .sort((a, b) => a - b)[0]
        const firstAppliedTime = appliedDrafts
          .map((draft) => parseTime(draft.created_at))
          .filter((time): time is number => time != null)
          .sort((a, b) => a - b)[0]

        setMetrics({
          loading: false,
          todayWords: numberOrZero((dailyStats as { word_count?: unknown } | null)?.word_count),
          monthWords: monthRows.reduce((sum, row) => sum + numberOrZero(row.word_count), 0),
          sessionsToday: safeArray(sessions).length,
          streak: numberOrZero((achievementStats as { streak?: unknown } | null)?.streak),
          conversations: safeArray(conversations).length,
          pendingDrafts: draftRows.filter((draft) => draft.status === 'pending').length,
          appliedDrafts: appliedDrafts.length,
          dismissedDrafts: dismissedDrafts.length,
          draftApplyRate: decidedDrafts > 0 ? Math.round((appliedDrafts.length / decidedDrafts) * 100) : 0,
          draftDismissRate: decidedDrafts > 0 ? Math.round((dismissedDrafts.length / decidedDrafts) * 100) : 0,
          firstUsefulMinutes:
            firstDraftTime != null && firstAppliedTime != null
              ? Math.max(0, Math.round((firstAppliedTime - firstDraftTime) / 60000))
              : null,
          draftActiveDays7: activeDaysWithin(draftRows, 7),
          draftActiveDays30: activeDaysWithin(draftRows, 30),
          recentDrafts: draftRows.slice(0, 5).map((draft) => ({
            id: draft.id,
            title: draft.title?.trim() || '未命名草稿',
            status: draft.status || 'pending',
            created_at: draft.created_at
          }))
        })
      })
      .catch(() => {
        if (!cancelled) setMetrics({ ...EMPTY_METRICS, loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  const warningForeshadows = foreshadowings.filter((item) => item.status === 'warning').length
  const resolvedForeshadows = foreshadowings.filter((item) => item.status === 'resolved').length
  const saveHint =
    chapterSaveStatus.kind === 'saved'
      ? '已保存'
      : chapterSaveStatus.kind === 'saving'
        ? '保存中'
        : chapterSaveStatus.kind === 'dirty'
          ? '有未保存改动'
          : chapterSaveStatus.kind === 'error'
            ? '保存失败'
            : '等待编辑'

  const tabs: Array<{ id: TerminalTab; label: string; icon: typeof Activity }> = [
    { id: 'sandbox', label: '沙盘', icon: Activity },
    { id: 'stats', label: '统计', icon: BarChart3 },
    { id: 'ai', label: 'AI 记录', icon: Bot },
    { id: 'canon', label: '设定', icon: Database }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-[var(--border-primary)] bg-[var(--bg-primary)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3">
        <div className="flex min-w-0 items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setBottomPanelOpen(false)}
          aria-label="折叠 Terminal 区"
          title="折叠 Terminal 区"
          className="rounded p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'sandbox' && <BottomPanel embedded />}

        {activeTab === 'stats' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard label="今日" value={metrics.loading ? '...' : metrics.todayWords} hint="写入字数" />
              <MetricCard label="本月" value={metrics.loading ? '...' : metrics.monthWords} hint="累计字数" />
              <MetricCard label="场次" value={metrics.loading ? '...' : metrics.sessionsToday} hint="今日 session" />
              <MetricCard label="连写" value={metrics.loading ? '...' : metrics.streak} hint="连续天数" />
              <MetricCard label="总量" value={totalWords} hint={`${chapterCount} 章`} />
            </div>
            <div className="mt-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              当前章节：
              <span className="font-semibold text-[var(--text-primary)]">{currentChapter?.title || '未选择'}</span>
              <span className="mx-2 text-[var(--text-muted)]">/</span>
              {saveHint}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="会话" value={metrics.loading ? '...' : metrics.conversations} />
              <MetricCard label="待处理" value={metrics.loading ? '...' : metrics.pendingDrafts} />
              <MetricCard label="已采纳" value={metrics.loading ? '...' : metrics.appliedDrafts} />
              <MetricCard label="已忽略" value={metrics.loading ? '...' : metrics.dismissedDrafts} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard label="采纳率" value={metrics.loading ? '...' : `${metrics.draftApplyRate}%`} hint="已决策草稿" />
              <MetricCard label="忽略率" value={metrics.loading ? '...' : `${metrics.draftDismissRate}%`} hint="已决策草稿" />
              <MetricCard label="首次可用" value={metrics.loading ? '...' : minutesLabel(metrics.firstUsefulMinutes)} hint="首草稿到首采纳" />
              <MetricCard label="7 天复用" value={metrics.loading ? '...' : `${metrics.draftActiveDays7} 天`} hint="AI 草稿活跃" />
              <MetricCard label="30 天复用" value={metrics.loading ? '...' : `${metrics.draftActiveDays30} 天`} hint="AI 草稿活跃" />
            </div>
            <div className="mt-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <div className="border-b border-[var(--border-primary)] px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)]">
                最近草稿
              </div>
              {metrics.recentDrafts.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">暂无 AI 草稿</div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)]">
                  {metrics.recentDrafts.map((draft) => (
                    <div key={draft.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="min-w-0 truncate text-[var(--text-primary)]">{draft.title}</span>
                      <span className="shrink-0 rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                        {draft.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'canon' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard label="角色" value={characters.length} />
              <MetricCard label="剧情节点" value={plotNodes.length} hint={`${plotlines.length} 条线`} />
              <MetricCard label="伏笔" value={foreshadowings.length} />
              <MetricCard label="催债" value={warningForeshadows} />
              <MetricCard label="已回收" value={resolvedForeshadows} />
            </div>
            <div className="mt-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              设定资产来自当前书籍本地库，供 AI 区和只读 MCP 上下文桥复用。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

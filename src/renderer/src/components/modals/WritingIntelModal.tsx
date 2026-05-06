import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Clock3,
  FileSearch,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import type {
  WritingIntelApiResult,
  WritingIntelBoard,
  WritingIntelChannel,
  WritingIntelGenreStat,
  WritingIntelInsightCard,
  WritingIntelOverviewResponse,
  WritingIntelPlatform,
  WritingIntelRankingEntry,
  WritingIntelRankingsResponse
} from '../../../../shared/writing-intel'

const PLATFORM_OPTIONS: Array<{ id: WritingIntelPlatform; label: string }> = [
  { id: 'fanqie', label: '番茄' },
  { id: 'qidian', label: '起点' },
  { id: 'qimao', label: '七猫' },
  { id: 'zongheng', label: '纵横' },
  { id: 'custom', label: '自定义' }
]

const BOARD_OPTIONS: Array<{ id: WritingIntelBoard; label: string }> = [
  { id: 'reading', label: '阅读榜' },
  { id: 'new_book', label: '新书榜' },
  { id: 'peak', label: '巅峰榜' },
  { id: 'custom', label: '自定义' }
]

const CHANNEL_OPTIONS: Array<{ id: WritingIntelChannel; label: string }> = [
  { id: 'all', label: '全站' },
  { id: 'male', label: '男频' },
  { id: 'female', label: '女频' }
]

const INSIGHT_KIND_LABEL: Record<string, string> = {
  hot_competitive: '高热高卷',
  hot_gap: '高热低供',
  low_supply: '低供给',
  rising: '上升',
  promotion: '晋升',
  risk: '风险',
  submission: '投稿',
  opportunity: '机会'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '暂无快照'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('zh-CN')
}

function rankDeltaLabel(entry: WritingIntelRankingEntry): string {
  if (entry.promotedFromNewBook) return '新书晋升'
  if (entry.isNew) return '新上榜'
  if (!entry.rankDelta) return '持平'
  return entry.rankDelta > 0 ? `升 ${entry.rankDelta}` : `降 ${Math.abs(entry.rankDelta)}`
}

function rankDeltaClass(entry: WritingIntelRankingEntry): string {
  if (entry.promotedFromNewBook || entry.isNew || (entry.rankDelta ?? 0) > 0) {
    return 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-primary)]'
  }
  if ((entry.rankDelta ?? 0) < 0) {
    return 'border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-primary)]'
  }
  return 'border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-muted)]'
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2">
      <div className="text-lg font-bold text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</div>
      {detail && <div className="mt-1 truncate text-[10px] text-[var(--text-secondary)]">{detail}</div>}
    </div>
  )
}

function GenreRow({ stat, active, onClick }: { stat: WritingIntelGenreStat; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        active
          ? 'border-[var(--accent-border)] bg-[var(--accent-surface)]'
          : 'border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--bg-tertiary)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">{stat.category}</span>
        <span className="shrink-0 text-xs font-bold text-[var(--accent-secondary)]">{stat.bookCount} 本</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
        <span>{stat.opportunityLabel}</span>
        <span>新 {stat.newEntryCount}</span>
        <span>升 {stat.risingCount}</span>
        <span>晋升 {stat.promotionCount}</span>
      </div>
    </button>
  )
}

function InsightCard({ insight }: { insight: WritingIntelInsightCard }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{insight.title}</div>
          <div className="mt-1 text-[10px] text-[var(--accent-secondary)]">
            {INSIGHT_KIND_LABEL[insight.kind] || '机会'}
          </div>
        </div>
        <Sparkles size={14} className="shrink-0 text-[var(--accent-secondary)]" />
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{insight.summary}</p>
    </div>
  )
}

function RankingRow({ entry }: { entry: WritingIntelRankingEntry }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_88px] items-center gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2">
      <div className="text-center font-mono text-sm font-bold text-[var(--accent-secondary)]">#{entry.rank}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">{entry.title}</span>
          {entry.sourceUrl && (
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[var(--text-muted)] transition hover:text-[var(--accent-secondary)]"
              title="打开公开来源"
            >
              <ArrowUpRight size={13} />
            </a>
          )}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>{entry.category}</span>
          {entry.author && <span>{entry.author}</span>}
          {entry.wordCount !== null && <span>{formatNumber(entry.wordCount)} 字</span>}
          {(entry.readCount !== null || entry.heat !== null) && (
            <span>热度 {formatNumber(entry.readCount ?? entry.heat)}</span>
          )}
          {entry.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5">{tag}</span>
          ))}
        </div>
      </div>
      <div className={`rounded-md border px-2 py-1 text-center text-[10px] font-semibold ${rankDeltaClass(entry)}`}>
        {rankDeltaLabel(entry)}
      </div>
    </div>
  )
}

export default function WritingIntelModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)
  const pushModal = useUIStore((s) => s.pushModal)
  const [platform, setPlatform] = useState<WritingIntelPlatform>('fanqie')
  const [board, setBoard] = useState<WritingIntelBoard>('reading')
  const [channel, setChannel] = useState<WritingIntelChannel>('all')
  const [category, setCategory] = useState<string>('')
  const [overview, setOverview] = useState<WritingIntelOverviewResponse | null>(null)
  const [rankings, setRankings] = useState<WritingIntelRankingEntry[]>([])
  const [trends, setTrends] = useState<WritingIntelRankingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latestSnapshot = overview?.snapshots[0] ?? null
  const visibleStats = useMemo(() => {
    const rows = overview?.genreStats ?? []
    const filtered = rows.filter((stat) => stat.board === board && stat.channel === channel)
    return (filtered.length > 0 ? filtered : rows).slice(0, 12)
  }, [board, channel, overview?.genreStats])
  const categoryOptions = useMemo(() => {
    return Array.from(new Set(visibleStats.map((stat) => stat.category))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [visibleStats])
  const filteredInsights = useMemo(() => {
    const insights = overview?.insights ?? []
    return insights
      .filter((insight) => !category || insight.category === category)
      .slice(0, 8)
  }, [category, overview?.insights])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [overviewResult, rankingsResult, trendsResult] = await Promise.all([
        window.api.writingIntel.overview({ platform, limit: 24 }) as Promise<WritingIntelApiResult<WritingIntelOverviewResponse>>,
        window.api.writingIntel.rankings({
          platform,
          channel,
          board,
          category: category || undefined,
          limit: 60
        }) as Promise<WritingIntelApiResult<WritingIntelRankingsResponse>>,
        window.api.writingIntel.trends({
          platform,
          channel,
          board,
          category: category || undefined,
          limit: 16
        }) as Promise<WritingIntelApiResult<WritingIntelRankingsResponse>>
      ])
      if (!overviewResult.ok || !overviewResult.data) throw new Error(overviewResult.error || '读取写作情报失败')
      if (!rankingsResult.ok || !rankingsResult.data) throw new Error(rankingsResult.error || '读取榜单失败')
      if (!trendsResult.ok || !trendsResult.data) throw new Error(trendsResult.error || '读取趋势失败')
      setOverview(overviewResult.data)
      setRankings(rankingsResult.data.entries)
      setTrends(trendsResult.data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取写作情报失败')
      setRankings([])
      setTrends([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [platform, board, channel, category])

  useEffect(() => {
    if (!categoryOptions.includes(category)) setCategory('')
  }, [category, categoryOptions])

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 text-[var(--text-primary)] backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-primary)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[var(--accent-secondary)]" />
              <h2 className="text-base font-bold">写作情报</h2>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span>公开来源 / 授权导入</span>
              <span>采集 {formatDate(latestSnapshot?.capturedAt)}</span>
              <span>{latestSnapshot?.official ? '官方统计' : '非官方统计'}</span>
              {latestSnapshot?.sourceUrl && (
                <a
                  href={latestSnapshot.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--accent-secondary)] hover:underline"
                >
                  {latestSnapshot.sourceLabel || '来源'} <ArrowUpRight size={11} />
                </a>
              )}
            </div>
          </div>
          <button type="button" onClick={closeModal} className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border-primary)] px-5 py-3">
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value as WritingIntelPlatform)}
            className="h-8 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 text-xs"
          >
            {PLATFORM_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <div className="flex rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-0.5">
            {BOARD_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setBoard(item.id)}
                className={`h-7 rounded px-2 text-xs font-semibold transition ${
                  board === item.id ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as WritingIntelChannel)}
            className="h-8 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 text-xs"
          >
            {CHANNEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-8 min-w-[132px] rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 text-xs"
          >
            <option value="">全部题材</option>
            {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-primary)] px-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            刷新
          </button>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--warning-border)] bg-[var(--warning-surface)] px-3 py-2 text-xs text-[var(--warning-primary)]">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-4">
            <StatTile label="数据源" value={formatNumber(overview?.sources.length ?? 0)} detail={overview?.sources[0]?.sourceLabel} />
            <StatTile label="题材统计" value={formatNumber(overview?.genreStats.length ?? 0)} detail={category || '全部题材'} />
            <StatTile label="榜单条目" value={formatNumber(rankings.length)} detail={BOARD_OPTIONS.find((item) => item.id === board)?.label} />
            <StatTile label="黑马 / 新上榜" value={formatNumber(trends.length)} detail={CHANNEL_OPTIONS.find((item) => item.id === channel)?.label} />
          </div>

          <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold">题材发布 / 在榜数量</h3>
                <Clock3 size={14} className="text-[var(--text-muted)]" />
              </div>
              <div className="space-y-2">
                {visibleStats.length > 0 ? visibleStats.map((stat) => (
                  <GenreRow
                    key={`${stat.snapshotId}-${stat.category}`}
                    stat={stat}
                    active={category === stat.category}
                    onClick={() => setCategory(category === stat.category ? '' : stat.category)}
                  />
                )) : (
                  <div className="rounded-md border border-dashed border-[var(--border-primary)] px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                    暂无题材快照，等待后台导入公开来源数据。
                  </div>
                )}
              </div>
            </section>

            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold">榜单浏览</h3>
                <BookOpen size={14} className="text-[var(--text-muted)]" />
              </div>
              <div className="space-y-2">
                {loading && rankings.length === 0 ? (
                  <div className="flex items-center justify-center rounded-md border border-[var(--border-primary)] py-12 text-xs text-[var(--text-muted)]">
                    <Loader2 size={14} className="mr-2 animate-spin" /> 正在读取公开榜单
                  </div>
                ) : rankings.length > 0 ? rankings.map((entry) => (
                  <RankingRow key={entry.id} entry={entry} />
                )) : (
                  <div className="rounded-md border border-dashed border-[var(--border-primary)] px-3 py-12 text-center text-xs text-[var(--text-muted)]">
                    当前筛选暂无榜单条目。
                  </div>
                )}
              </div>
            </section>

            <aside className="min-w-0 space-y-4">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold">机会卡</h3>
                  <Sparkles size={14} className="text-[var(--accent-secondary)]" />
                </div>
                <div className="space-y-2">
                  {filteredInsights.length > 0 ? filteredInsights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  )) : (
                    <div className="rounded-md border border-dashed border-[var(--border-primary)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                      暂无洞察卡。
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold">黑马 / 晋升</h3>
                  <TrendingUp size={14} className="text-[var(--success-primary)]" />
                </div>
                <div className="space-y-2">
                  {trends.slice(0, 6).map((entry) => (
                    <RankingRow key={`trend-${entry.id}`} entry={entry} />
                  ))}
                  {trends.length === 0 && (
                    <div className="rounded-md border border-dashed border-[var(--border-primary)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                      连续快照不足时不会生成趋势。
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-2">
                <button
                  type="button"
                  onClick={() => openModal('authorGrowth', { tab: 'submission' })}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 text-xs font-semibold transition hover:bg-[var(--bg-tertiary)]"
                >
                  <Send size={14} /> 平台收稿与发布提醒
                </button>
                <button
                  type="button"
                  onClick={() => pushModal('marketScanDeconstruct')}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--accent-border)] bg-[var(--accent-surface)] px-3 text-xs font-semibold text-[var(--accent-secondary)] transition hover:brightness-105"
                >
                  <FileSearch size={14} /> 授权样本分析
                </button>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

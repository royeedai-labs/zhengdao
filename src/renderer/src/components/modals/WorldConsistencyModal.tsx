import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, ShieldCheck, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useToastStore } from '@/stores/toast-store'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { stripHtmlToText } from '@/utils/html-to-text'
import type { CanonLockEntry } from '@/utils/ai/assistant-workflow'

/**
 * DI-07 v2 — 桌面端世界观一致性检查入口
 *
 * 端到端把 ai_work_profiles.canon_pack_locks 透传给后端
 * layer2.world-consistency Skill, 并按 severity 渲染 issue 列表,
 * 点击 chapterId 跳转章节。
 *
 * MVP 决策:
 *  1. 章节内容直接从 chapter-store.volumes 拿 (loadVolumes 已经一次性
 *     把全本 content 从 SQLite 拉回前端), 不再额外拉 IPC。
 *  2. 默认扫描全本; 章节多时给"最近 N 章"快捷入口降低 token 成本。
 *  3. focus 维度复用后端 enum (character/setting/timeline/power/location)。
 *  4. 不在桌面端做 chunking, 后端 impl 已经按 6 章/window 滚动扫描。
 */

type FocusDim = 'character' | 'setting' | 'timeline' | 'power' | 'location'

interface IssueOut {
  id: string
  category: FocusDim
  severity: 'low' | 'medium' | 'high'
  chapterIds: string[]
  quote: string
  description: string
  suggestion?: string
}

interface WorldConsistencyOutput {
  projectId: string
  scannedChapters: number
  issues: IssueOut[]
  summary: {
    total: number
    bySeverity: { low: number; medium: number; high: number }
    byCategory: Record<string, number>
  }
}

const FOCUS_OPTIONS: Array<{ id: FocusDim; label: string }> = [
  { id: 'character', label: '人物' },
  { id: 'setting', label: '设定' },
  { id: 'timeline', label: '时间线' },
  { id: 'power', label: '力量体系' },
  { id: 'location', label: '地理' }
]

function parseLocks(stored: string | undefined): CanonLockEntry[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    if (parsed && Array.isArray((parsed as { entries?: CanonLockEntry[] }).entries)) {
      return (parsed as { entries: CanonLockEntry[] }).entries
    }
    if (Array.isArray(parsed)) return parsed as CanonLockEntry[]
    return []
  } catch {
    return []
  }
}

export default function WorldConsistencyModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const bookId = useBookStore((s) => s.currentBookId)
  const volumes = useChapterStore((s) => s.volumes)
  const selectChapter = useChapterStore((s) => s.selectChapter)
  const addToast = useToastStore((s) => s.addToast)

  const [scope, setScope] = useState<'all' | 'recent20' | 'recent10'>('all')
  const [focus, setFocus] = useState<FocusDim[]>(['character', 'setting', 'timeline'])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<WorldConsistencyOutput | null>(null)
  const [canonLocks, setCanonLocks] = useState<CanonLockEntry[]>([])

  useEffect(() => {
    if (!bookId) return
    void window.api
      .aiGetWorkProfile(bookId)
      .then((profile: unknown) => {
        const stored = (profile as { canon_pack_locks?: string } | null)?.canon_pack_locks
        setCanonLocks(parseLocks(stored))
      })
      .catch(() => setCanonLocks([]))
  }, [bookId])

  const allChapters = useMemo(() => {
    const out: Array<{ id: string; title: string; content: string; order: number }> = []
    for (const vol of volumes) {
      for (const ch of vol.chapters || []) {
        const content = stripHtmlToText(ch.content || '').trim()
        if (!content) continue
        out.push({
          id: String(ch.id),
          title: ch.title || `第 ${ch.sort_order + 1} 章`,
          content,
          order: ch.sort_order
        })
      }
    }
    return out.sort((a, b) => a.order - b.order)
  }, [volumes])

  const scopedChapters = useMemo(() => {
    if (scope === 'all') return allChapters
    const limit = scope === 'recent10' ? 10 : 20
    return allChapters.slice(-limit)
  }, [allChapters, scope])

  const ready = bookId != null && scopedChapters.length > 0 && focus.length > 0

  const handleScan = async () => {
    if (!bookId) return
    setRunning(true)
    setResult(null)
    try {
      const r = await window.api.aiExecuteSkill(
        'layer2.world-consistency',
        {
          projectId: String(bookId),
          chapters: scopedChapters.map((c) => ({
            id: c.id,
            title: c.title,
            content: c.content.slice(0, 8000),
            order: c.order
          })),
          focus,
          canonPackLocks: canonLocks.map((l) => ({
            id: l.id,
            label: l.label,
            value: l.value,
            priority: l.priority,
            createdAt: l.createdAt
          }))
        },
        { modelHint: 'balanced' }
      )
      if (r.error) {
        const msg =
          r.code === 'PRO_REQUIRED'
            ? '世界观一致性检查是 Pro 功能, 请先升级证道 Pro'
            : r.code === 'SKILL_TIMEOUT'
              ? '扫描超时, 请缩小扫描范围 (例如 "最近 10 章") 后再试'
              : r.error
        addToast('error', msg)
        return
      }
      setResult(r.output as WorldConsistencyOutput)
      const total = (r.output as WorldConsistencyOutput).summary.total
      addToast('success', total === 0 ? '未发现一致性问题' : `共 ${total} 处问题, 见下方列表`)
    } finally {
      setRunning(false)
    }
  }

  const handleJumpChapter = async (chapterIdStr: string) => {
    const id = Number.parseInt(chapterIdStr, 10)
    if (!Number.isFinite(id)) return
    try {
      await selectChapter(id)
      closeModal()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : '跳转章节失败')
    }
  }

  const grouped = useMemo(() => {
    if (!result) return null
    const by: Record<'high' | 'medium' | 'low', IssueOut[]> = { high: [], medium: [], low: [] }
    result.issues.forEach((i) => by[i.severity].push(i))
    return by
  }, [result])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <ShieldCheck size={18} className="text-[var(--accent-secondary)]" />
            世界观一致性检查
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    扫描范围
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as typeof scope)}
                    className="field text-xs"
                  >
                    <option value="all">全本 ({allChapters.length} 章)</option>
                    <option value="recent20">最近 20 章 (省 token)</option>
                    <option value="recent10">最近 10 章 (最快)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    关注维度
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {FOCUS_OPTIONS.map((opt) => {
                      const active = focus.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setFocus((cur) =>
                              cur.includes(opt.id)
                                ? cur.filter((c) => c !== opt.id)
                                : [...cur, opt.id]
                            )
                          }
                          className={`rounded border px-2 py-0.5 text-xs transition ${
                            active
                              ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                              : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Canon Pack 锁定: {canonLocks.length} 条已就绪 (
                  {canonLocks.filter((l) => l.priority === 'critical').length} 强制 /{' '}
                  {canonLocks.filter((l) => l.priority === 'high').length} 警告 /{' '}
                  {canonLocks.filter((l) => l.priority === 'medium').length} 建议 /{' '}
                  {canonLocks.filter((l) => l.priority === 'low').length} 记录) · 模型档位 balanced
                </span>
                <button
                  type="button"
                  onClick={() => void handleScan()}
                  disabled={!ready || running}
                  className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:opacity-40"
                >
                  {running ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  {running ? '扫描中...' : '开始扫描'}
                </button>
              </div>
              {scopedChapters.length === 0 && (
                <div className="mt-2 rounded border border-[var(--warning-border)] bg-[var(--warning-surface)] p-2 text-[11px] text-[var(--warning-primary)]">
                  当前范围没有可扫描的章节内容。
                </div>
              )}
            </section>

            {grouped && (
              <section className="space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold">扫描结果</span>
                  <span className="text-[var(--text-muted)]">
                    扫描章节: {result?.scannedChapters || 0} · 共 {result?.summary.total || 0} 处问题
                  </span>
                </div>
                {(['high', 'medium', 'low'] as const).map((sev) => {
                  const items = grouped[sev]
                  if (items.length === 0) return null
                  const sevLabel = sev === 'high' ? '严重' : sev === 'medium' ? '中等' : '轻微'
                  const sevClass =
                    sev === 'high'
                      ? 'border-[var(--danger-border)] bg-[var(--danger-surface)]/30'
                      : sev === 'medium'
                        ? 'border-[var(--warning-border)] bg-[var(--warning-surface)]/30'
                        : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'
                  return (
                    <div key={sev} className={`rounded-lg border p-3 ${sevClass}`}>
                      <div className="mb-2 text-xs font-bold">
                        {sevLabel} ({items.length})
                      </div>
                      <ul className="space-y-2">
                        {items.map((issue) => (
                          <li
                            key={issue.id}
                            className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-xs"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                                {issue.category}
                              </span>
                              {issue.chapterIds.map((cid) => (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() => void handleJumpChapter(cid)}
                                  className="rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-1.5 py-0.5 text-[10px] text-[var(--accent-secondary)] hover:underline"
                                >
                                  跳转 ch:{cid}
                                </button>
                              ))}
                            </div>
                            <blockquote className="mb-1 border-l-2 border-[var(--text-muted)] pl-2 italic text-[var(--text-muted)]">
                              「{issue.quote}」
                            </blockquote>
                            <div className="text-[var(--text-primary)]">
                              <AlertCircle size={11} className="mr-1 inline align-text-bottom" />
                              {issue.description}
                            </div>
                            {issue.suggestion && (
                              <div className="mt-1 text-[var(--accent-secondary)]">
                                ↪ 建议: {issue.suggestion}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                {result && result.summary.total === 0 && (
                  <div className="rounded border border-[var(--success-border)] bg-[var(--success-surface)] p-3 text-xs text-[var(--success-primary)]">
                    未发现一致性问题。如要扩大检测面, 可在 AI 设置中给 Canon Pack 添加更多 critical 锁定条目。
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

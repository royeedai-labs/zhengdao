import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useBookStore } from '@/stores/book-store'
import { useToastStore } from '@/stores/toast-store'
import { aiAnalyzeStyle, getResolvedGlobalAiConfig, isAiConfigReady } from '@/utils/ai'

const METRIC_LABELS = [
  '句长均衡度',
  '对话叙事比',
  '用词丰富度',
  '节奏感',
  '画面感',
  '情感张力'
] as const

function htmlToPlain(html: string) {
  const d = document.createElement('div')
  d.innerHTML = html || ''
  return (d.textContent || '').replace(/\s+/g, ' ').trim()
}

function parseStyleResult(raw: string): {
  metrics: Record<string, number>
  summary: string
} {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = (fenced ? fenced[1] : raw).trim()
    const obj = JSON.parse(body) as Record<string, unknown>
    const metrics: Record<string, number> = {}
    for (const k of METRIC_LABELS) {
      const v = obj[k]
      const n = typeof v === 'number' ? v : Number(v)
      metrics[k] = Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : 5
    }
    const summary =
      typeof obj.summary === 'string'
        ? obj.summary
        : ''
    return { metrics, summary }
  } catch {
    return {
      metrics: Object.fromEntries(METRIC_LABELS.map((k) => [k, 5])) as Record<string, number>,
      summary: raw.trim() || '无法解析模型输出，请重试。'
    }
  }
}

interface ChapterContentRow {
  title: string
  content: string | null
}

export default function StyleAnalysisModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData) as { text?: string } | null
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const bookId = useBookStore((s) => s.currentBookId)
  const [tab, setTab] = useState<'chapter' | 'book'>('chapter')
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [summaryText, setSummaryText] = useState('')
  const [bookPlain, setBookPlain] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const chapterPlain = useMemo(() => {
    const fromModal = modalData?.text?.trim()
    if (fromModal) return fromModal
    return htmlToPlain(currentChapter?.content || '')
  }, [modalData, currentChapter])

  useEffect(() => {
    if (!bookId) {
      setBookPlain('')
      return
    }
    let cancelled = false
    void window.api
      .getAllChaptersForBook(bookId)
      .then((rows: unknown) => {
        if (cancelled) return
        const parts = (rows as ChapterContentRow[])
          .map((chapter) => {
            const text = htmlToPlain(chapter.content || '')
            return text ? `【${chapter.title}】\n${text}` : ''
          })
          .filter(Boolean)
        setBookPlain(parts.join('\n\n'))
      })
      .catch(() => {
        if (!cancelled) setBookPlain('')
      })
    return () => {
      cancelled = true
    }
  }, [bookId])

  const runAnalyze = useCallback(async () => {
    const cfg = await getResolvedGlobalAiConfig()
    if (!isAiConfigReady(cfg)) {
      useToastStore.getState().addToast('warning', '请先在应用设置中配置 AI')
      return
    }
    const text = tab === 'chapter' ? chapterPlain : bookPlain
    if (!text.trim()) {
      useToastStore.getState().addToast('warning', tab === 'book' ? '全书暂无正文' : '本章暂无正文')
      return
    }
    requestIdRef.current += 1
    const myRequest = requestIdRef.current
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    setLoading(true)
    try {
      const res = await aiAnalyzeStyle(
        {
          ai_provider: cfg.ai_provider,
          ai_api_key: cfg.ai_api_key,
          ai_api_endpoint: cfg.ai_api_endpoint,
          ai_model: cfg.ai_model || '',
          ai_official_profile_id: cfg.ai_official_profile_id || ''
        },
        text,
        { signal }
      )
      if (myRequest !== requestIdRef.current) return
      if (res.error) {
        useToastStore.getState().addToast('error', res.error)
        return
      }
      const parsed = parseStyleResult(res.content || '')
      setMetrics(parsed.metrics)
      setSummaryText(parsed.summary)
    } finally {
      if (myRequest === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [chapterPlain, bookPlain, tab])

  useEffect(() => {
    void runAnalyze()
  }, [runAnalyze])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 shrink-0">
          <span className="text-sm font-bold text-[var(--accent-secondary)]">写作风格分析</span>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-primary)] text-[11px] font-medium shrink-0">
          <button
            type="button"
            onClick={() => setTab('chapter')}
            className={`flex-1 py-2.5 transition ${
              tab === 'chapter'
                ? 'border-b-2 border-[var(--accent-primary)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            本章分析
          </button>
          <button
            type="button"
            onClick={() => setTab('book')}
            className={`flex-1 py-2.5 transition ${
              tab === 'book'
                ? 'border-b-2 border-[var(--accent-primary)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            全书分析
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
              <Loader2 size={28} className="animate-spin text-[var(--accent-secondary)]" />
              <span className="text-xs">分析中…</span>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {METRIC_LABELS.map((label) => {
                  const score = metrics[label] ?? 5
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-[var(--text-secondary)]">{label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                          style={{ width: `${score * 10}%` }}
                        />
                      </div>
                      <span className="w-8 font-mono text-xs text-[var(--accent-secondary)]">{score}/10</span>
                    </div>
                  )
                })}
              </div>
              {summaryText ? (
                <div className="border-t border-[var(--border-primary)] pt-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {summaryText}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--border-primary)] p-3 shrink-0">
          <button
            type="button"
            onClick={() => void runAnalyze()}
            disabled={loading}
            className="flex items-center gap-2 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            重新分析
          </button>
        </div>
      </div>
    </div>
  )
}

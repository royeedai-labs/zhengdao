import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useConfigStore } from '@/stores/config-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useToastStore } from '@/stores/toast-store'
import { aiAnalyzeStyle, isAiConfigReady } from '@/utils/ai'

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

export default function StyleAnalysisModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData) as { text?: string } | null
  const { volumes, currentChapter } = useChapterStore()
  const [tab, setTab] = useState<'chapter' | 'book'>('chapter')
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [summaryText, setSummaryText] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const chapterPlain = useMemo(() => {
    const fromModal = modalData?.text?.trim()
    if (fromModal) return fromModal
    return htmlToPlain(currentChapter?.content || '')
  }, [modalData, currentChapter])

  const bookPlain = useMemo(() => {
    const parts: string[] = []
    for (const v of volumes) {
      for (const ch of v.chapters || []) {
        const t = htmlToPlain(ch.content || '')
        if (t) parts.push(`【${ch.title}】\n${t}`)
      }
    }
    return parts.join('\n\n')
  }, [volumes])

  const runAnalyze = useCallback(async () => {
    const cfg = useConfigStore.getState().config
    if (!isAiConfigReady(cfg)) {
      useToastStore.getState().addToast('warning', '请先在项目设置中配置 AI')
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
          ai_model: cfg.ai_model || ''
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab open / tab change
    void runAnalyze()
  }, [runAnalyze])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[#2a2a2a] bg-[#141414] flex items-center justify-between px-5 shrink-0">
          <span className="text-purple-400 font-bold text-sm">写作风格分析</span>
          <button type="button" onClick={closeModal} className="text-slate-500 hover:text-slate-300 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-[#2a2a2a] text-[11px] font-medium shrink-0">
          <button
            type="button"
            onClick={() => setTab('chapter')}
            className={`flex-1 py-2.5 transition ${
              tab === 'chapter'
                ? 'text-purple-400 border-b-2 border-purple-500 bg-slate-800/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            本章分析
          </button>
          <button
            type="button"
            onClick={() => setTab('book')}
            className={`flex-1 py-2.5 transition ${
              tab === 'book'
                ? 'text-purple-400 border-b-2 border-purple-500 bg-slate-800/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            全书分析
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-purple-400" />
              <span className="text-xs">分析中…</span>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {METRIC_LABELS.map((label) => {
                  const score = metrics[label] ?? 5
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
                      <div className="flex-1 bg-[#222] h-3 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${score * 10}%` }}
                        />
                      </div>
                      <span className="text-xs text-emerald-400 font-mono w-8">{score}/10</span>
                    </div>
                  )
                })}
              </div>
              {summaryText ? (
                <div className="text-xs text-slate-400 leading-relaxed border-t border-[#2a2a2a] pt-4">
                  {summaryText}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="border-t border-[#2a2a2a] p-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => void runAnalyze()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-purple-600/80 hover:bg-purple-500 text-white transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            重新分析
          </button>
        </div>
      </div>
    </div>
  )
}

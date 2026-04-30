import { useEffect, useMemo, useRef, useState } from 'react'
import { DataSet } from 'vis-data'
import { Timeline } from 'vis-timeline'
import 'vis-timeline/styles/vis-timeline-graph2d.css'
import { CalendarClock, Loader2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { mapEventsToTimeline, type CanonEventRow } from './data-mappers/events-to-timeline'

/**
 * CG-A3.2 — TimelineView.
 *
 * vis-timeline 实例随 events 数据变化重建 (vis-timeline 没好用的 React
 * binding，所以走 DOM ref + cleanup 模式)。axis label 用合成的 ISO 日期
 * 但 tooltip 显示「第 N 章」。
 */

interface EventsTimelineApi {
  getCanonEvents(bookId: number): Promise<CanonEventRow[]>
}

interface Props {
  bookId: number
  onSelectChapter?: (chapterNumber: number) => void
}

export default function TimelineView({ bookId, onSelectChapter }: Props) {
  const [events, setEvents] = useState<CanonEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [chapterFrom, setChapterFrom] = useState<number | ''>('')
  const [chapterTo, setChapterTo] = useState<number | ''>('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const api = window.api as unknown as EventsTimelineApi
        const rows = await api.getCanonEvents(bookId)
        if (cancelled) return
        setEvents(rows || [])
      } catch (err) {
        if (!cancelled) addToast('error', `加载事件失败: ${(err as Error).message ?? err}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookId, addToast])

  const filteredItems = useMemo(() => {
    const range: [number, number] | undefined =
      typeof chapterFrom === 'number' && typeof chapterTo === 'number'
        ? [chapterFrom, chapterTo]
        : undefined
    return mapEventsToTimeline(events, range ? { chapterRange: range } : undefined)
  }, [events, chapterFrom, chapterTo])

  useEffect(() => {
    if (!containerRef.current || filteredItems.length === 0) {
      if (timelineRef.current) {
        timelineRef.current.destroy()
        timelineRef.current = null
      }
      return
    }
    const dataset = new DataSet(filteredItems)
    const options = {
      stack: true,
      orientation: 'top' as const,
      tooltip: { followMouse: true },
      zoomable: true
    }
    if (timelineRef.current) {
      timelineRef.current.destroy()
    }
    const timeline = new Timeline(containerRef.current, dataset as never, options)
    timeline.on('select', (props: { items: number[] }) => {
      const id = props.items[0]
      if (id == null) return
      const event = events.find((e) => e.id === id)
      if (event && event.chapter_number != null && onSelectChapter) {
        onSelectChapter(event.chapter_number)
      }
    })
    timelineRef.current = timeline
    return () => {
      timeline.destroy()
      timelineRef.current = null
    }
  }, [filteredItems, events, onSelectChapter])

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <CalendarClock size={12} /> 事件 {events.length}
        </div>
        <div className="flex items-center gap-1">
          <span>章节范围</span>
          <input
            type="number"
            value={chapterFrom}
            onChange={(e) => setChapterFrom(e.target.value === '' ? '' : Number(e.target.value))}
            className="field !w-20 !py-0.5 !text-xs"
            placeholder="起"
          />
          <span>—</span>
          <input
            type="number"
            value={chapterTo}
            onChange={(e) => setChapterTo(e.target.value === '' ? '' : Number(e.target.value))}
            className="field !w-20 !py-0.5 !text-xs"
            placeholder="止"
          />
        </div>
      </div>
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="mr-2 animate-spin" /> 加载中…
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            该作品暂无事件，去 AI 设置 → 事件时间线面板维护。
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}
      </div>
    </div>
  )
}

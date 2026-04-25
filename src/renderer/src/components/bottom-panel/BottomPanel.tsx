import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Activity, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { usePlotStore } from '@/stores/plot-store'
import { useCharacterStore } from '@/stores/character-store'
import type { PlotNode } from '@/types'
import PoisonWarning from './PoisonWarning'
import {
  PLOT_BASELINE_Y,
  chapterToTimelineX,
  dragExceededThreshold,
  getPlotNodeLeft,
  getTimelineWidth,
  projectPlotDrag,
  scoreToTimelineY
} from './sandbox-layout'

const NEW_PLOTLINE_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6']

type DragState = {
  nodeId: number
  startClientX: number
  startClientY: number
  startScrollLeft: number
  startChapter: number
  startScore: number
  previewChapter: number
  previewScore: number
  dragging: boolean
}

export default function BottomPanel() {
  const { bottomPanelOpen, bottomPanelHeight, setBottomPanelHeight, setBottomPanelOpen, pushModal } = useUIStore()
  const bookId = useBookStore((s) => s.currentBookId)
  const plotNodes = usePlotStore((s) => s.plotNodes)
  const plotlines = usePlotStore((s) => s.plotlines)
  const plotNodeCharacterIds = usePlotStore((s) => s.plotNodeCharacterIds)
  const createPlotline = usePlotStore((s) => s.createPlotline)
  const updatePlotline = usePlotStore((s) => s.updatePlotline)
  const deletePlotline = usePlotStore((s) => s.deletePlotline)
  const updatePlotNode = usePlotStore((s) => s.updatePlotNode)
  const checkPoisonWarning = usePlotStore((s) => s.checkPoisonWarning)
  const characters = useCharacterStore((s) => s.characters)
  const openModal = useUIStore((s) => s.openModal)

  const scrollRef = useRef<HTMLDivElement>(null)
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const previousNodesRef = useRef<Map<number, { chapter_number: number; score: number }>>(new Map())
  const dragStateRef = useRef<DragState | null>(null)

  const [hiddenPlotlineIds, setHiddenPlotlineIds] = useState<Set<number>>(new Set())
  const [managePlotlinesOpen, setManagePlotlinesOpen] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dismissedPoisonKey, setDismissedPoisonKey] = useState<string | null>(null)

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  const poisonStatus = checkPoisonWarning()
  const poisonWarningKey = poisonStatus.triggered ? `${poisonStatus.startCh}:${poisonStatus.endCh}` : null
  const poisonWarningVisible = poisonStatus.triggered && poisonWarningKey !== dismissedPoisonKey

  const togglePlotlineVisibility = useCallback((id: number) => {
    setHiddenPlotlineIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const plotlineMap = useMemo(() => new Map(plotlines.map((plotline) => [plotline.id, plotline])), [plotlines])

  const renderedNodes = useMemo(
    () =>
      plotNodes.map((node) =>
        dragState?.nodeId === node.id
          ? { ...node, chapter_number: dragState.previewChapter, score: dragState.previewScore }
          : node
      ),
    [dragState, plotNodes]
  )

  const visibleNodes = useMemo(
    () =>
      renderedNodes.filter((node) => {
        if (!node.plotline_id) return true
        return !hiddenPlotlineIds.has(node.plotline_id)
      }),
    [hiddenPlotlineIds, renderedNodes]
  )

  const maxChapter = useMemo(
    () => renderedNodes.reduce((max, node) => Math.max(max, node.chapter_number), 1),
    [renderedNodes]
  )
  const timelineEndChapter = Math.max(20, maxChapter + 6)
  const timelineWidth = getTimelineWidth(timelineEndChapter)
  const chapterMarkers = useMemo(() => {
    const markers = new Set<number>([1])
    for (let chapter = 10; chapter <= timelineEndChapter; chapter += 10) markers.add(chapter)
    return [...markers].sort((a, b) => a - b)
  }, [timelineEndChapter])

  const generateEKGPath = useCallback(() => {
    if (visibleNodes.length === 0) return ''
    const sorted = [...visibleNodes].sort((a, b) => a.chapter_number - b.chapter_number || a.id - b.id)
    const startX = chapterToTimelineX(sorted[0].chapter_number)
    let path = `M ${startX} ${PLOT_BASELINE_Y} `
    sorted.forEach((node) => {
      path += `L ${chapterToTimelineX(node.chapter_number)} ${scoreToTimelineY(node.score)} `
    })
    path += `L ${chapterToTimelineX(sorted[sorted.length - 1].chapter_number)} ${PLOT_BASELINE_Y}`
    return path
  }, [visibleNodes])

  const usePlotlineColors = plotlines.length > 0

  const nodeStyle = useCallback((node: PlotNode) => {
    const isHigh = node.score > 0
    const isLow = node.score < 0
    const plotline = node.plotline_id ? plotlineMap.get(node.plotline_id) : undefined
    const lineColor = usePlotlineColors && plotline ? plotline.color : null

    if (lineColor) {
      return {
        borderClass: 'border',
        borderStyle: { borderColor: lineColor } as CSSProperties,
        scoreClass: isHigh
          ? 'text-[var(--success-primary)]'
          : isLow
            ? 'text-[var(--danger-primary)]'
            : 'text-[var(--warning-primary)]',
        dotStyle: { backgroundColor: lineColor } as CSSProperties
      }
    }

    return {
      borderClass: isHigh
        ? 'border-[var(--success-border)] hover:border-[var(--success-primary)]'
        : isLow
          ? 'border-[var(--danger-border)] hover:border-[var(--danger-primary)]'
          : 'border-[var(--warning-border)] hover:border-[var(--warning-primary)]',
      borderStyle: {} as CSSProperties,
      scoreClass: isHigh
        ? 'text-[var(--success-primary)]'
        : isLow
          ? 'text-[var(--danger-primary)]'
          : 'text-[var(--warning-primary)]',
      dotStyle: {} as CSSProperties,
      dotClass: isHigh
        ? 'bg-[var(--success-primary)]'
        : isLow
          ? 'bg-[var(--danger-primary)]'
          : 'bg-[var(--warning-primary)]'
    }
  }, [plotlineMap, usePlotlineColors])

  const scrollToChapter = useCallback(
    (chapter: number, behavior: ScrollBehavior = 'smooth') => {
      const scrollEl = scrollRef.current
      if (!scrollEl) return
      const targetLeft = chapterToTimelineX(chapter) - scrollEl.clientWidth / 2
      const maxScrollLeft = Math.max(0, timelineWidth - scrollEl.clientWidth)
      scrollEl.scrollTo({
        left: Math.max(0, Math.min(targetLeft, maxScrollLeft)),
        behavior
      })
    },
    [timelineWidth]
  )

  useEffect(() => {
    const previousNodes = previousNodesRef.current
    if (previousNodes.size > 0) {
      let targetChapter: number | null = null
      if (plotNodes.length > previousNodes.size) {
        targetChapter = plotNodes.reduce((max, node) => Math.max(max, node.chapter_number), 1)
      } else {
        for (const node of plotNodes) {
          const previous = previousNodes.get(node.id)
          if (!previous) continue
          if (previous.chapter_number !== node.chapter_number || previous.score !== node.score) {
            targetChapter = node.chapter_number
            break
          }
        }
      }
      if (targetChapter !== null) scrollToChapter(targetChapter)
    }

    previousNodesRef.current = new Map(
      plotNodes.map((node) => [node.id, { chapter_number: node.chapter_number, score: node.score }])
    )
  }, [plotNodes, scrollToChapter])

  const handleNewPlotline = () => {
    if (!bookId) return
    const index = plotlines.length % NEW_PLOTLINE_COLORS.length
    void createPlotline(bookId, `支线 ${plotlines.length + 1}`, NEW_PLOTLINE_COLORS[index])
  }

  const startNodeInteraction = (event: ReactPointerEvent<HTMLDivElement>, node: PlotNode) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const scrollLeft = scrollRef.current?.scrollLeft ?? 0
    const nextDragState: DragState = {
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: scrollLeft,
      startChapter: node.chapter_number,
      startScore: node.score,
      previewChapter: node.chapter_number,
      previewScore: node.score,
      dragging: false
    }

    dragStateRef.current = nextDragState
    setDragState(nextDragState)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    if (!dragState?.nodeId) return

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragStateRef.current
      if (!current) return

      const scrollEl = scrollRef.current
      const currentScrollLeft = scrollEl?.scrollLeft ?? current.startScrollLeft
      const deltaX = event.clientX - current.startClientX + (currentScrollLeft - current.startScrollLeft)
      const deltaY = event.clientY - current.startClientY
      const projected = projectPlotDrag(current.startChapter, current.startScore, deltaX, deltaY)
      const moved = dragExceededThreshold(deltaX, deltaY)

      setDragState((previous) =>
        previous && previous.nodeId === current.nodeId
          ? {
              ...previous,
              previewChapter: projected.chapter,
              previewScore: projected.score,
              dragging: previous.dragging || moved
            }
          : previous
      )

      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect()
        const edge = 72
        if (event.clientX < rect.left + edge) scrollEl.scrollBy({ left: -18, behavior: 'auto' })
        if (event.clientX > rect.right - edge) scrollEl.scrollBy({ left: 18, behavior: 'auto' })
      }
    }

    const handlePointerUp = () => {
      const current = dragStateRef.current
      dragStateRef.current = null
      setDragState(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (!current) return

      const node = plotNodes.find((item) => item.id === current.nodeId)
      if (!node) return

      if (!current.dragging) {
        openModal('plotNode', { ...node })
        return
      }

      if (current.previewChapter !== node.chapter_number || current.previewScore !== node.score) {
        void updatePlotNode(node.id, {
          chapter_number: current.previewChapter,
          score: current.previewScore
        })
      }
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState?.nodeId, openModal, plotNodes, updatePlotNode])

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current
      if (!resizeState) return
      const nextHeight = resizeState.startHeight + (resizeState.startY - event.clientY)
      setBottomPanelHeight(nextHeight)
    }

    const handleUp = () => {
      resizeStateRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [setBottomPanelHeight])

  if (!bottomPanelOpen) {
    return (
      <div className="bottom-panel-entry h-9 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0 shadow-sm">
        <button
          type="button"
          onClick={() => setBottomPanelOpen(true)}
          aria-label="展开创世沙盘"
          aria-expanded={false}
          className="flex h-full w-full items-center justify-between gap-3 px-4 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] no-drag"
          title="展开创世沙盘 (Ctrl+`)"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Activity size={14} className="shrink-0 text-[var(--accent-secondary)]" />
            <span className="font-semibold text-[var(--text-primary)]">创世沙盘</span>
            <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]">{plotNodes.length} 节点</span>
            {poisonStatus.triggered && (
              <span className="rounded-full border border-[var(--danger-border)] bg-[var(--danger-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--danger-primary)]">
                毒点 Ch {poisonStatus.startCh}-{poisonStatus.endCh}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden md:inline text-[10px] text-[var(--text-muted)]">Ctrl+`</span>
            <ChevronUp size={15} />
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="bottom-panel-entry border-t border-[var(--border-primary)] bg-[var(--bg-primary)] shrink-0 flex flex-col transition-all duration-300 ease-in-out opacity-100 z-20"
      style={{ height: `${bottomPanelHeight}px` }}
    >
      <button
        type="button"
        aria-label="调整沙盘高度"
        title="拖拽调整沙盘高度"
        onMouseDown={(event) => {
          resizeStateRef.current = { startY: event.clientY, startHeight: bottomPanelHeight }
          document.body.style.cursor = 'ns-resize'
          document.body.style.userSelect = 'none'
        }}
        className="h-4 flex items-center justify-center border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-ns-resize shrink-0"
      >
        <span className="h-1 w-14 rounded-full bg-[var(--border-secondary)]" />
      </button>

      <div className="h-10 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] flex items-center px-6 justify-between shrink-0 shadow-sm">
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-wide text-[var(--accent-secondary)]">
          <button
            type="button"
            onClick={() => setBottomPanelOpen(false)}
            aria-label="折叠创世沙盘"
            aria-expanded={true}
            className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="折叠创世沙盘 (Ctrl+`)"
          >
            <ChevronDown size={14} />
          </button>
          <Activity size={16} className="shrink-0" />
          <span className="truncate">创世沙盘 &amp; 爽点心电图</span>
          <span className="hidden lg:inline text-[10px] font-medium text-[var(--text-muted)]">
            拖拽节点：横向改章节，纵向改爽度
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden xl:flex items-center text-[10px] text-[var(--text-secondary)] mr-4 space-x-3">
            <span className="flex items-center">
              <div className="mr-1 h-1.5 w-1.5 rounded-full bg-[var(--success-primary)]" />
              爽点区 (+1~+5)
            </span>
            <span className="flex items-center">
              <div className="mr-1 h-1.5 w-1.5 rounded-full bg-[var(--warning-primary)]" />
              平稳区 (0)
            </span>
            <span className="flex items-center">
              <div className="mr-1 h-1.5 w-1.5 rounded-full bg-[var(--danger-primary)]" />
              毒点区 (-1~-5)
            </span>
          </div>
          <button
            onClick={() => openModal('plotNode', { isNew: true })}
            className="rounded bg-[var(--accent-primary)] px-2 py-1 text-[10px] font-bold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] flex items-center"
            title="新增剧情节点"
          >
            <Plus size={12} className="mr-1" /> 新建节点
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-[10px] text-[var(--text-muted)] uppercase shrink-0">剧情线</span>
        {plotlines.map((plotline) => {
          const hidden = hiddenPlotlineIds.has(plotline.id)
          return (
            <button
              key={plotline.id}
              type="button"
              onClick={() => togglePlotlineVisibility(plotline.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                hidden
                  ? 'border-[var(--border-primary)] text-[var(--text-muted)] opacity-40'
                  : 'border-transparent text-[var(--text-primary)]'
              }`}
              style={{ backgroundColor: `${plotline.color}28`, borderColor: hidden ? undefined : plotline.color }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: plotline.color }} />
              {plotline.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={handleNewPlotline}
          disabled={!bookId}
          className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:border-[var(--accent-border)] transition disabled:opacity-40"
        >
          + 新建线
        </button>
        <button
          type="button"
          onClick={() => setManagePlotlinesOpen((value) => !value)}
          className="ml-auto rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[var(--text-primary)] transition hover:brightness-110"
        >
          管理
        </button>
      </div>

      {managePlotlinesOpen && (
        <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] max-h-[120px] overflow-y-auto shrink-0 space-y-2">
          {plotlines.length === 0 ? (
            <p className="text-[10px] text-[var(--text-muted)]">暂无剧情线，点击「新建线」添加。</p>
          ) : (
            plotlines.map((plotline) => (
              <PlotlineManageRow
                key={`${plotline.id}:${plotline.name}:${plotline.color}`}
                plotline={plotline}
                onUpdate={(name, color) => void updatePlotline(plotline.id, name, color)}
                onDelete={() =>
                  pushModal('confirm', {
                    title: '删除剧情线',
                    message: `确定删除剧情线「${plotline.name}」吗？该线上的节点仍会保留，但会失去所属剧情线。`,
                    onConfirm: async () => {
                      await deletePlotline(plotline.id)
                    }
                  })}
              />
            ))
          )}
        </div>
      )}

      <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden bg-[var(--bg-primary)]">
        {plotNodes.length === 0 ? (
          <div className="flex h-full min-h-[260px] items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-surface)] px-6 py-8 text-center">
              <div className="text-sm font-semibold text-[var(--text-primary)]">从第一个剧情节点开始搭建沙盘</div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                节点会按章节横向排列、按爽度纵向分布。建完之后可直接拖拽：横向改章节，纵向改爽度。
              </p>
              <button
                type="button"
                onClick={() => openModal('plotNode', { isNew: true })}
                className="mt-4 inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-secondary)]"
              >
                <Plus size={14} />
                添加第一条节点
              </button>
            </div>
          </div>
        ) : (
          <div className="relative h-full min-h-[260px]" style={{ width: `${timelineWidth}px` }}>
            <div className="pointer-events-none absolute inset-0">
              {chapterMarkers.map((chapter) => (
                <div
                  key={chapter}
                  className="absolute top-0 h-full border-l border-[var(--border-primary)]"
                  style={{ left: `${chapterToTimelineX(chapter)}px` }}
                >
                  <span className="absolute left-2 top-2 text-[10px] font-mono text-[var(--text-muted)]">Ch {chapter}</span>
                </div>
              ))}

              <div
                className="absolute left-0 w-full border-t border-dashed border-[var(--border-primary)]"
                style={{ top: `${PLOT_BASELINE_Y}px` }}
              />

              <div className="absolute left-3 top-3 text-[10px] text-[var(--success-primary)]">+5 爽点</div>
              <div
                className="absolute left-3 -translate-y-1/2 text-[10px] text-[var(--warning-primary)]"
                style={{ top: `${PLOT_BASELINE_Y}px` }}
              >
                0 平稳
              </div>
              <div className="absolute bottom-3 left-3 text-[10px] text-[var(--danger-primary)]">-5 毒点</div>
            </div>

            <svg className="pointer-events-none absolute inset-x-0 top-4 h-[260px] overflow-visible">
              <path
                d={generateEKGPath()}
                fill="none"
                stroke="url(#ekg-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_8px_rgba(63,111,159,0.18)]"
              />
              <defs>
                <linearGradient id="ekg-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success-primary)" />
                  <stop offset="50%" stopColor="var(--warning-primary)" />
                  <stop offset="100%" stopColor="var(--danger-primary)" />
                </linearGradient>
              </defs>
            </svg>

            {renderedNodes.map((node) => {
              const hidden = Boolean(node.plotline_id && hiddenPlotlineIds.has(node.plotline_id))
              if (hidden) return null

              const yPos = scoreToTimelineY(node.score)
              const isHigh = node.score > 0
              const style = nodeStyle(node)
              const dotRing = 'dotClass' in style && style.dotClass ? style.dotClass : ''
              const dotPos = isHigh ? '-bottom-1.5' : node.score < 0 ? '-top-1.5' : 'top-1/2 -mt-1.5'
              const assocIds = plotNodeCharacterIds[node.id] ?? []
              const assocChars = assocIds.map((id) => characters.find((character) => character.id === id)).filter(Boolean)
              const draggingThisNode = dragState?.nodeId === node.id

              return (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => startNodeInteraction(event, node)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openModal('plotNode', { ...node })
                    }
                  }}
                  className={`group absolute z-10 w-36 rounded-lg border bg-[var(--bg-secondary)] p-2 shadow-lg select-none touch-none transition-all duration-150 ${
                    draggingThisNode
                      ? 'scale-[1.01] shadow-2xl ring-1 ring-[var(--accent-border)] cursor-grabbing'
                      : 'cursor-grab hover:-translate-y-0.5 hover:shadow-xl'
                  } ${style.borderClass}`}
                  style={{
                    left: `${getPlotNodeLeft(node.chapter_number)}px`,
                    top: `${yPos - (isHigh ? 60 : 0)}px`,
                    ...style.borderStyle
                  }}
                >
                  {draggingThisNode && (
                    <div className="mb-1 rounded-md bg-[var(--accent-surface)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-secondary)]">
                      拖拽中 · Ch {node.chapter_number} · {node.score > 0 ? `+${node.score}` : node.score}
                    </div>
                  )}

                  <div className="mb-1 flex items-center justify-between">
                    <span className="rounded bg-[var(--bg-tertiary)] px-1 py-0.5 text-[9px] font-mono text-[var(--text-primary)]">
                      Ch {node.chapter_number}
                    </span>
                    <span className={`text-[10px] font-bold ${style.scoreClass}`}>
                      {node.score > 0 ? `+${node.score}` : node.score}
                    </span>
                  </div>

                  <div className="mb-0.5 truncate text-xs font-bold text-[var(--text-primary)]">{node.title}</div>

                  {assocChars.length > 0 && (
                    <div className="mb-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {assocChars.slice(0, 5).map((character) => (
                        <span
                          key={character!.id}
                          title={character!.name}
                          className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[8px] font-medium text-[var(--text-primary)]"
                        >
                          {character!.name.slice(0, 1)}
                        </span>
                      ))}
                      {assocChars.length > 5 && <span className="text-[8px] text-[var(--text-muted)]">+{assocChars.length - 5}</span>}
                    </div>
                  )}

                  <div className="line-clamp-1 text-[9px] text-[var(--text-muted)]">{node.description}</div>

                  <div
                    className={`absolute left-1/2 -ml-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg-secondary)] ${dotRing} ${dotPos}`}
                    style={Object.keys(style.dotStyle).length ? style.dotStyle : undefined}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {poisonWarningVisible && (
        <PoisonWarning
          startCh={poisonStatus.startCh}
          endCh={poisonStatus.endCh}
          onClose={() => setDismissedPoisonKey(poisonWarningKey)}
        />
      )}
    </div>
  )
}

function PlotlineManageRow({
  plotline,
  onUpdate,
  onDelete
}: {
  plotline: { id: number; name: string; color: string }
  onUpdate: (name: string, color: string) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(plotline.name)
  const [color, setColor] = useState(plotline.color)

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <input
        type="color"
        value={color}
        onChange={(event) => {
          const value = event.target.value
          setColor(value)
          onUpdate(name, value)
        }}
        className="w-7 h-6 rounded border border-[var(--border-primary)] cursor-pointer shrink-0 p-0 bg-transparent"
      />
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (name.trim() && name !== plotline.name) onUpdate(name.trim(), color)
        }}
        className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
      />
      <button
        type="button"
        onClick={onDelete}
        title="删除剧情线"
        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger-primary)] hover:bg-[var(--danger-surface)] shrink-0"
        aria-label="删除剧情线"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

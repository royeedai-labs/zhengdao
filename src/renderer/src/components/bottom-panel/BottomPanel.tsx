import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Activity, Plus, Trash2 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { usePlotStore } from '@/stores/plot-store'
import { useCharacterStore } from '@/stores/character-store'
import type { PlotNode } from '@/types'
import PoisonWarning from './PoisonWarning'

const CHAPTER_PX = 15
const INVISIBLE_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const NEW_PLOTLINE_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6']

export default function BottomPanel() {
  const { bottomPanelOpen, bottomPanelHeight, setBottomPanelHeight, pushModal } = useUIStore()
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
  const ignoreClickRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const [hiddenPlotlineIds, setHiddenPlotlineIds] = useState<Set<number>>(new Set())
  const [managePlotlinesOpen, setManagePlotlinesOpen] = useState(false)

  const [poisonWarning, setPoisonWarning] = useState<{
    show: boolean
    startCh: number
    endCh: number
  }>({ show: false, startCh: 0, endCh: 0 })

  useEffect(() => {
    const result = checkPoisonWarning()
    if (result.triggered) {
      setPoisonWarning({
        show: true,
        startCh: result.startCh,
        endCh: result.endCh
      })
    } else {
      setPoisonWarning((prev) => ({ ...prev, show: false }))
    }
  }, [plotNodes, checkPoisonWarning])

  const togglePlotlineVisibility = useCallback((id: number) => {
    setHiddenPlotlineIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const visibleNodes = plotNodes.filter((n) => {
    if (!n.plotline_id) return true
    return !hiddenPlotlineIds.has(n.plotline_id)
  })

  const plotlineMap = Object.fromEntries(plotlines.map((p) => [p.id, p]))

  const generateEKGPath = () => {
    if (visibleNodes.length === 0) return ''
    const sorted = [...visibleNodes].sort((a, b) => a.chapter_number - b.chapter_number)
    let path = 'M 0 100 '
    sorted.forEach((node) => {
      const x = node.chapter_number * CHAPTER_PX
      const y = 100 - node.score * CHAPTER_PX
      path += `L ${x} ${y} `
    })
    const last = sorted[sorted.length - 1]
    path += `L ${(last.chapter_number + 15) * CHAPTER_PX} 100`
    return path
  }

  const usePlotlineColors = plotlines.length > 0

  const nodeStyle = (node: PlotNode) => {
    const isHigh = node.score > 0
    const isLow = node.score < 0
    const pl = node.plotline_id ? plotlineMap[node.plotline_id] : undefined
    const lineColor = usePlotlineColors && pl ? pl.color : null

    if (lineColor) {
      return {
        borderClass: 'border',
        borderStyle: { borderColor: lineColor } as CSSProperties,
        scoreClass: isHigh ? 'text-emerald-400' : isLow ? 'text-red-400' : 'text-yellow-400',
        dotStyle: { backgroundColor: lineColor } as CSSProperties
      }
    }
    return {
      borderClass: isHigh
        ? 'border-emerald-900/50 hover:border-emerald-500/50'
        : isLow
          ? 'border-red-900/50 hover:border-red-500/50'
          : 'border-yellow-900/50 hover:border-yellow-500/50',
      borderStyle: {} as CSSProperties,
      scoreClass: isHigh ? 'text-emerald-400' : isLow ? 'text-red-400' : 'text-yellow-400',
      dotStyle: {} as CSSProperties,
      dotClass: isHigh ? 'bg-emerald-500' : isLow ? 'bg-red-500' : 'bg-yellow-500'
    }
  }

  const handleNewPlotline = () => {
    if (!bookId) return
    const i = plotlines.length % NEW_PLOTLINE_COLORS.length
    void createPlotline(bookId, `支线 ${plotlines.length + 1}`, NEW_PLOTLINE_COLORS[i])
  }

  const onDragStartPlot = (e: React.DragEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    e.dataTransfer.effectAllowed = 'move'
    const img = new Image()
    img.src = INVISIBLE_GIF
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const onDragEndPlot = (e: React.DragEvent, node: PlotNode) => {
    if (e.clientX === 0 && e.clientY === 0) {
      dragStartRef.current = null
      return
    }
    const start = dragStartRef.current
    dragStartRef.current = null
    const moved = start !== null && (Math.abs(e.clientX - start.x) > 4 || Math.abs(e.clientY - start.y) > 4)
    if (moved) ignoreClickRef.current = true

    const scrollEl = scrollRef.current
    if (!scrollEl || !bookId) {
      window.setTimeout(() => {
        ignoreClickRef.current = false
      }, 80)
      return
    }
    const rect = scrollEl.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollEl.scrollLeft
    const newChapter = Math.max(1, Math.round(x / CHAPTER_PX))
    if (newChapter !== node.chapter_number) {
      void updatePlotNode(node.id, { chapter_number: newChapter })
    }
    window.setTimeout(() => {
      ignoreClickRef.current = false
    }, 80)
  }

  const handleNodeCardClick = (node: PlotNode) => {
    if (ignoreClickRef.current) return
    openModal('plotNode', { ...node })
  }

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

  return (
    <div
      className={`border-t border-[var(--border-primary)] bg-[var(--bg-primary)] shrink-0 flex flex-col transition-all duration-300 ease-in-out ${
        bottomPanelOpen ? 'opacity-100 z-20' : 'h-0 opacity-0 overflow-hidden border-t-0 z-0'
      }`}
      style={bottomPanelOpen ? { height: `${bottomPanelHeight}px` } : undefined}
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
        <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm tracking-wide">
          <Activity size={16} />
          <span>创世沙盘 &amp; 爽点心电图</span>
        </div>
        <div className="flex space-x-3 items-center">
          <div className="flex items-center text-[10px] text-[var(--text-secondary)] mr-4 space-x-3">
            <span className="flex items-center">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1" />
              爽点区 (+1~+5)
            </span>
            <span className="flex items-center">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1" />
              平稳区 (0)
            </span>
            <span className="flex items-center">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1" />
              毒点区 (-1~-5)
            </span>
          </div>
          <button
            onClick={() => openModal('plotNode', { isNew: true })}
            className="bg-slate-700 hover:bg-emerald-600 text-white px-2 py-1 rounded flex items-center text-[10px] font-bold transition"
            title="新增剧情节点"
          >
            <Plus size={12} className="mr-1" /> 新建节点
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-[10px] text-[var(--text-muted)] uppercase shrink-0">剧情线</span>
        {plotlines.map((pl) => {
          const hidden = hiddenPlotlineIds.has(pl.id)
          return (
            <button
              key={pl.id}
              type="button"
              onClick={() => togglePlotlineVisibility(pl.id)}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                hidden ? 'opacity-40 border-[var(--border-primary)] text-[var(--text-muted)]' : 'border-transparent text-[var(--text-primary)]'
              }`}
              style={{ backgroundColor: `${pl.color}28`, borderColor: hidden ? undefined : pl.color }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pl.color }} />
              {pl.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={handleNewPlotline}
          disabled={!bookId}
          className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-emerald-400 hover:border-emerald-600/50 transition disabled:opacity-40"
        >
          + 新建线
        </button>
        <button
          type="button"
          onClick={() => setManagePlotlinesOpen((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:brightness-110 transition ml-auto"
        >
          管理
        </button>
      </div>

      {managePlotlinesOpen && (
        <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] max-h-[120px] overflow-y-auto shrink-0 space-y-2">
          {plotlines.length === 0 ? (
            <p className="text-[10px] text-[var(--text-muted)]">暂无剧情线，点击「新建线」添加。</p>
          ) : (
            plotlines.map((pl) => (
              <PlotlineManageRow
                key={pl.id}
                plotline={pl}
                onUpdate={(name, color) => void updatePlotline(pl.id, name, color)}
                onDelete={() =>
                  pushModal('confirm', {
                    title: '删除剧情线',
                    message: `确定删除剧情线「${pl.name}」吗？该线上的节点仍会保留，但会失去所属剧情线。`,
                    onConfirm: async () => {
                      await deletePlotline(pl.id)
                    }
                  })}
              />
            ))
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[var(--bg-primary)]">
        {plotNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
            <button onClick={() => openModal('plotNode', { isNew: true })} className="hover:text-emerald-400 transition">
              点击 + 添加第一个剧情节点
            </button>
          </div>
        ) : (
          <div className="relative min-w-[1500px] h-full">
            <div className="absolute top-0 left-0 w-full h-full">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-[var(--border-primary)] flex flex-col pointer-events-none"
                  style={{ left: `${(i + 1) * 150}px` }}
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1 ml-1">Ch {(i + 1) * 10}</span>
                </div>
              ))}
              <div className="absolute top-[120px] w-full border-t border-[var(--border-primary)] border-dashed pointer-events-none" />
            </div>
            <svg className="absolute top-4 left-0 w-full h-[240px] pointer-events-none z-0 overflow-visible">
              <path
                d={generateEKGPath()}
                fill="none"
                stroke="url(#ekg-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]"
              />
              <defs>
                <linearGradient id="ekg-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
            </svg>
            {plotNodes.map((node) => {
              const hidden = Boolean(node.plotline_id && hiddenPlotlineIds.has(node.plotline_id))
              if (hidden) return null

              const xPos = node.chapter_number * CHAPTER_PX
              const yPos = 120 - node.score * CHAPTER_PX
              const isHigh = node.score > 0
              const st = nodeStyle(node)
              const dotRing =
                'dotClass' in st && st.dotClass
                  ? st.dotClass
                  : ''
              const dotPos =
                isHigh ? '-bottom-1.5' : node.score < 0 ? '-top-1.5' : 'top-1/2 -mt-1.5'
              const assocIds = plotNodeCharacterIds[node.id] ?? []
              const assocChars = assocIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean)

              return (
                <div
                  key={node.id}
                  draggable
                  onDragStart={onDragStartPlot}
                  onDragEnd={(e) => onDragEndPlot(e, node)}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNodeCardClick(node)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNodeCardClick(node)
                    }
                  }}
                  className={`group absolute w-36 p-2 rounded-lg border shadow-lg cursor-grab active:cursor-grabbing transition-all duration-200 z-10 hover:shadow-xl hover:-translate-y-0.5 bg-[var(--bg-secondary)] ${st.borderClass}`}
                  style={{ left: `${xPos - 72}px`, top: `${yPos - (isHigh ? 60 : 0)}px`, ...st.borderStyle }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-[var(--text-primary)] font-mono">
                      Ch {node.chapter_number}
                    </span>
                    <span className={`text-[10px] font-bold ${st.scoreClass}`}>
                      {node.score > 0 ? '+' + node.score : node.score}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[var(--text-primary)] truncate mb-0.5">{node.title}</div>
                  {assocChars.length > 0 && (
                    <div className="flex items-center gap-0.5 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {assocChars.slice(0, 5).map((ch) => (
                        <span
                          key={ch!.id}
                          title={ch!.name}
                          className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[8px] flex items-center justify-center text-[var(--text-primary)] font-medium shrink-0 overflow-hidden"
                        >
                          {ch!.name.slice(0, 1)}
                        </span>
                      ))}
                      {assocChars.length > 5 && (
                        <span className="text-[8px] text-[var(--text-muted)]">+{assocChars.length - 5}</span>
                      )}
                    </div>
                  )}
                  <div className="text-[9px] text-[var(--text-muted)] line-clamp-1">{node.description}</div>
                  <div
                    className={`absolute left-1/2 -ml-1.5 w-3 h-3 rounded-full border-2 border-[var(--bg-secondary)] ${dotRing} ${dotPos}`}
                    style={Object.keys(st.dotStyle).length ? st.dotStyle : undefined}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {poisonWarning.show && (
        <PoisonWarning
          startCh={poisonWarning.startCh}
          endCh={poisonWarning.endCh}
          onClose={() => setPoisonWarning((p) => ({ ...p, show: false }))}
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

  useEffect(() => {
    setName(plotline.name)
    setColor(plotline.color)
  }, [plotline.name, plotline.color])

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <input
        type="color"
        value={color}
        onChange={(e) => {
          const v = e.target.value
          setColor(v)
          onUpdate(name, v)
        }}
        className="w-7 h-6 rounded border border-[var(--border-primary)] cursor-pointer shrink-0 p-0 bg-transparent"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== plotline.name) onUpdate(name.trim(), color)
        }}
        className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
      />
      <button
        type="button"
        onClick={onDelete}
        title="删除剧情线"
        className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/30 shrink-0"
        aria-label="删除剧情线"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

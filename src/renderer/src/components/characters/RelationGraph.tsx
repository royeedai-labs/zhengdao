import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { Character, CharacterRelation } from '@/types'
import { formatRelationLabel, relationColor } from '@/constants/relation-types'
import {
  layoutCharacterRelationGraph,
  type CharacterGraphLayoutNode
} from './relation-graph-layout'

type Viewport = {
  scale: number
  x: number
  y: number
}

type DragState =
  | { kind: 'node'; id: number; offX: number; offY: number }
  | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number }

interface RelationGraphProps {
  characters: Character[]
  relations: CharacterRelation[]
  selectedId: number | null
  onSelectCharacter: (id: number | null) => void
}

const NODE_RADIUS = 30
const MIN_ZOOM = 0.35
const MAX_ZOOM = 2.5

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function fitViewport(nodes: CharacterGraphLayoutNode[], size: { w: number; h: number }): Viewport {
  if (nodes.length === 0) return { scale: 1, x: 0, y: 0 }
  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs) - 96
  const maxX = Math.max(...xs) + 96
  const minY = Math.min(...ys) - 96
  const maxY = Math.max(...ys) + 96
  const boundsW = Math.max(1, maxX - minX)
  const boundsH = Math.max(1, maxY - minY)
  const scale = clamp(
    Math.min((size.w - 48) / boundsW, (size.h - 48) / boundsH),
    MIN_ZOOM,
    1.15
  )
  return {
    scale,
    x: (size.w - boundsW * scale) / 2 - minX * scale,
    y: (size.h - boundsH * scale) / 2 - minY * scale
  }
}

export default function RelationGraph({
  characters,
  relations,
  selectedId,
  onSelectCharacter
}: RelationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<CharacterGraphLayoutNode[]>([])
  const dragRef = useRef<DragState | null>(null)
  const viewportRef = useRef<Viewport>({ scale: 1, x: 0, y: 0 })
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 })
  const [size, setSize] = useState({ w: 640, h: 420 })

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const updateSize = (width: number, height: number) => {
      const next = {
        w: Math.max(260, Math.floor(width) || 640),
        h: Math.max(280, Math.floor(height) || 420)
      }
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next))
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      updateSize(entry.contentRect.width, entry.contentRect.height)
    })
    ro.observe(el)
    updateSize(el.clientWidth, el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo(
    () => layoutCharacterRelationGraph(characters, relations, size.w),
    [characters, relations, size.w]
  )

  const applyViewport = useCallback((next: Viewport) => {
    viewportRef.current = next
    setViewport(next)
  }, [])

  const resetView = useCallback(() => {
    applyViewport(fitViewport(nodesRef.current, size))
  }, [applyViewport, size])

  useEffect(() => {
    nodesRef.current = layout.nodes
    applyViewport(fitViewport(layout.nodes, size))
  }, [applyViewport, layout.nodes, size])

  const drawLabel = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    palette: { canvasBg: string; border: string; textSecondary: string }
  ) => {
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    const label = truncateText(ctx, text, 180)
    const width = ctx.measureText(label).width + 16
    const height = 22
    roundRect(ctx, x - width / 2, y - height / 2, width, height, 7)
    ctx.fillStyle = palette.canvasBg
    ctx.globalAlpha = 0.92
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = palette.border
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = palette.textSecondary
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x, y + 0.5)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const theme = getComputedStyle(document.documentElement)
    const palette = {
      canvasBg: theme.getPropertyValue('--bg-primary').trim() || '#11161d',
      surface: theme.getPropertyValue('--surface-secondary').trim() || '#1f2937',
      border: theme.getPropertyValue('--border-secondary').trim() || '#475569',
      accentSurface: theme.getPropertyValue('--accent-surface').trim() || '#334155',
      accent: theme.getPropertyValue('--accent-primary').trim() || '#60a5fa',
      textPrimary: theme.getPropertyValue('--text-primary').trim() || '#f8fafc',
      textSecondary: theme.getPropertyValue('--text-secondary').trim() || '#cbd5e1'
    }
    const dpr = window.devicePixelRatio || 1
    const w = size.w
    const h = size.h
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = palette.canvasBg
    ctx.fillRect(0, 0, w, h)

    const nodes = nodesRef.current
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const currentViewport = viewportRef.current
    ctx.save()
    ctx.translate(currentViewport.x, currentViewport.y)
    ctx.scale(currentViewport.scale, currentViewport.scale)

    for (const rel of relations) {
      const a = byId.get(rel.source_id)
      const b = byId.get(rel.target_id)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      if (dist < 1) continue
      const ux = dx / dist
      const uy = dy / dist
      const startX = a.x + ux * NODE_RADIUS
      const startY = a.y + uy * NODE_RADIUS
      const endX = b.x - ux * NODE_RADIUS
      const endY = b.y - uy * NODE_RADIUS
      const connected = selectedId == null || rel.source_id === selectedId || rel.target_id === selectedId
      const col = relationColor(rel.relation_type)
      ctx.beginPath()
      ctx.strokeStyle = col
      ctx.lineWidth = connected ? 2.2 : 1.4
      ctx.globalAlpha = connected ? 0.9 : 0.28
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      ctx.beginPath()
      ctx.fillStyle = col
      const arrowSize = 8
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - ux * arrowSize - uy * 4.5, endY - uy * arrowSize + ux * 4.5)
      ctx.lineTo(endX - ux * arrowSize + uy * 4.5, endY - uy * arrowSize - ux * 4.5)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1

      const mx = (startX + endX) / 2
      const my = (startY + endY) / 2
      const label = formatRelationLabel(rel.relation_type, rel.label)
      drawLabel(ctx, label, mx, my - 10, palette)
    }

    for (const node of nodes) {
      const selected = node.id === selectedId
      ctx.beginPath()
      ctx.arc(node.x, node.y, NODE_RADIUS + (selected ? 5 : 0), 0, Math.PI * 2)
      ctx.fillStyle = selected ? palette.accentSurface : palette.surface
      ctx.strokeStyle = selected ? palette.accent : palette.border
      ctx.lineWidth = selected ? 3 : 1.5
      ctx.fill()
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(node.x, node.y, NODE_RADIUS - 7, 0, Math.PI * 2)
      ctx.fillStyle = palette.surface
      ctx.fill()
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
      ctx.fillStyle = palette.textPrimary
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(truncateText(ctx, node.name, 58), node.x, node.y)
    }

    ctx.restore()
  }, [drawLabel, relations, selectedId, size.h, size.w])

  useEffect(() => {
    viewportRef.current = viewport
    draw()
  }, [draw, viewport])

  const toWorld = (screenX: number, screenY: number) => {
    const currentViewport = viewportRef.current
    return {
      x: (screenX - currentViewport.x) / currentViewport.scale,
      y: (screenY - currentViewport.y) / currentViewport.scale
    }
  }

  const pickNode = (worldX: number, worldY: number): CharacterGraphLayoutNode | null => {
    const nodes = nodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]!
      if (Math.hypot(worldX - node.x, worldY - node.y) <= NODE_RADIUS + 8) return node
    }
    return null
  }

  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = toWorld(screenX, screenY)
    const node = pickNode(world.x, world.y)
    if (node) {
      dragRef.current = {
        kind: 'node',
        id: node.id,
        offX: world.x - node.x,
        offY: world.y - node.y
      }
      onSelectCharacter(node.id)
      return
    }
    dragRef.current = {
      kind: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      originX: viewportRef.current.x,
      originY: viewportRef.current.y
    }
    onSelectCharacter(null)
  }

  const onMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'pan') {
      applyViewport({
        ...viewportRef.current,
        x: drag.originX + e.clientX - drag.startX,
        y: drag.originY + e.clientY - drag.startY
      })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const world = toWorld(e.clientX - rect.left, e.clientY - rect.top)
    const node = nodesRef.current.find((item) => item.id === drag.id)
    if (!node) return
    node.x = clamp(world.x - drag.offX, 40, Math.max(layout.width - 40, 40))
    node.y = clamp(world.y - drag.offY, 40, Math.max(layout.height - 40, 40))
    draw()
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const onWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = toWorld(screenX, screenY)
    const scale = clamp(viewportRef.current.scale * Math.exp(-e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM)
    applyViewport({
      scale,
      x: screenX - world.x * scale,
      y: screenY - world.y * scale
    })
  }

  const zoomBy = (factor: number) => {
    const center = toWorld(size.w / 2, size.h / 2)
    const scale = clamp(viewportRef.current.scale * factor, MIN_ZOOM, MAX_ZOOM)
    applyViewport({
      scale,
      x: size.w / 2 - center.x * scale,
      y: size.h / 2 - center.y * scale
    })
  }

  if (characters.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center text-sm text-[var(--text-muted)]">暂无角色</div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-[420px] w-full overflow-hidden rounded-lg border border-[var(--border-primary)]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onWheel={onWheel}
      />
      <div className="absolute right-2 top-2 flex overflow-hidden rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-sm">
        <button
          type="button"
          title="放大"
          onClick={() => zoomBy(1.18)}
          className="border-r border-[var(--border-primary)] p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-secondary)]"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          title="缩小"
          onClick={() => zoomBy(0.84)}
          className="border-r border-[var(--border-primary)] p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-secondary)]"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          title="适应视图"
          onClick={resetView}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-secondary)]"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  )
}

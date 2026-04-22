import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Character, CharacterRelation } from '@/types'
import { relationColor } from '@/constants/relation-types'

type SimNode = {
  id: number
  name: string
  x: number
  y: number
  vx: number
  vy: number
}

function simulateLayout(chars: Character[], relations: CharacterRelation[], width: number, height: number): SimNode[] {
  const pad = 48
  const w = Math.max(width, 200)
  const h = Math.max(height, 200)
  const nodes: SimNode[] = chars.map((c, i) => {
    const angle = (2 * Math.PI * i) / Math.max(chars.length, 1)
    const ring = Math.min(w, h) * 0.28
    return {
      id: c.id,
      name: c.name,
      x: w / 2 + Math.cos(angle) * ring + (Math.random() - 0.5) * 24,
      y: h / 2 + Math.sin(angle) * ring + (Math.random() - 0.5) * 24,
      vx: 0,
      vy: 0
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges = relations
    .map((r) => {
      const s = byId.get(r.source_id)
      const t = byId.get(r.target_id)
      return s && t ? { s, t, r } : null
    })
    .filter(Boolean) as { s: SimNode; t: SimNode; r: CharacterRelation }[]

  const kRep = 640
  const kAtt = 0.045
  const ideal = Math.min(w, h) * 0.14
  const damping = 0.88

  for (let iter = 0; iter < 100; iter++) {
    const fx = new Map<number, number>()
    const fy = new Map<number, number>()
    for (const n of nodes) {
      fx.set(n.id, 0)
      fy.set(n.id, 0)
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        const dist = Math.hypot(dx, dy) + 0.02
        const f = kRep / (dist * dist)
        dx /= dist
        dy /= dist
        fx.set(a.id, (fx.get(a.id) || 0) - dx * f)
        fy.set(a.id, (fy.get(a.id) || 0) - dy * f)
        fx.set(b.id, (fx.get(b.id) || 0) + dx * f)
        fy.set(b.id, (fy.get(b.id) || 0) + dy * f)
      }
    }
    for (const e of edges) {
      let dx = e.t.x - e.s.x
      let dy = e.t.y - e.s.y
      const dist = Math.hypot(dx, dy) + 0.02
      const force = kAtt * (dist - ideal)
      dx /= dist
      dy /= dist
      fx.set(e.s.id, (fx.get(e.s.id) || 0) + dx * force)
      fy.set(e.s.id, (fy.get(e.s.id) || 0) + dy * force)
      fx.set(e.t.id, (fx.get(e.t.id) || 0) - dx * force)
      fy.set(e.t.id, (fy.get(e.t.id) || 0) - dy * force)
    }
    for (const n of nodes) {
      const gx = (w / 2 - n.x) * 0.03
      const gy = (h / 2 - n.y) * 0.03
      fx.set(n.id, (fx.get(n.id) || 0) + gx)
      fy.set(n.id, (fy.get(n.id) || 0) + gy)
    }
    for (const n of nodes) {
      n.vx = ((n.vx || 0) + (fx.get(n.id) || 0)) * damping
      n.vy = ((n.vy || 0) + (fy.get(n.id) || 0)) * damping
      n.x += n.vx
      n.y += n.vy
      n.x = Math.max(pad, Math.min(w - pad, n.x))
      n.y = Math.max(pad, Math.min(h - pad, n.y))
    }
  }

  return nodes
}

interface RelationGraphProps {
  characters: Character[]
  relations: CharacterRelation[]
  selectedId: number | null
  onSelectCharacter: (id: number | null) => void
}

export default function RelationGraph({
  characters,
  relations,
  selectedId,
  onSelectCharacter
}: RelationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const dragRef = useRef<{ id: number; offX: number; offY: number } | null>(null)
  const [size, setSize] = useState({ w: 640, h: 420 })

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const updateSize = (width: number, height: number) => {
      const next = {
        w: Math.max(200, Math.floor(width) || 640),
        h: Math.max(200, Math.floor(height) || 420)
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

  const layoutNodes = useMemo(
    () => (characters.length === 0 ? [] : simulateLayout(characters, relations, size.w, size.h)),
    [characters, relations, size.w, size.h]
  )

  useEffect(() => {
    nodesRef.current = layoutNodes
  }, [layoutNodes])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = size.w
    const h = size.h
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0f0f12'
    ctx.fillRect(0, 0, w, h)

    const nodes = nodesRef.current
    const byId = new Map(nodes.map((n) => [n.id, n]))

    for (const rel of relations) {
      const a = byId.get(rel.source_id)
      const b = byId.get(rel.target_id)
      if (!a || !b) continue
      const col = relationColor(rel.relation_type)
      ctx.beginPath()
      ctx.strokeStyle = col
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.85
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.globalAlpha = 1
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const text = rel.label?.trim() || ''
      if (text) {
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
        ctx.fillStyle = '#cbd5e1'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.strokeStyle = '#0f0f12'
        ctx.lineWidth = 4
        ctx.strokeText(text, mx, my - 4)
        ctx.fillText(text, mx, my - 4)
      }
    }

    const nr = 22
    for (const n of nodes) {
      const sel = n.id === selectedId
      ctx.beginPath()
      ctx.arc(n.x, n.y, nr + (sel ? 4 : 0), 0, Math.PI * 2)
      ctx.fillStyle = sel ? '#312e81' : '#1e293b'
      ctx.strokeStyle = sel ? '#818cf8' : '#475569'
      ctx.lineWidth = sel ? 3 : 1.5
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(n.x, n.y, nr, 0, Math.PI * 2)
      ctx.fillStyle = '#334155'
      ctx.fill()
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
      ctx.fillStyle = '#f1f5f9'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = n.name.length > 8 ? `${n.name.slice(0, 7)}…` : n.name
      ctx.fillText(label, n.x, n.y)
    }
  }, [relations, selectedId, size.w, size.h])

  useEffect(() => {
    draw()
  }, [draw, layoutNodes])

  const pickNode = (cx: number, cy: number): number | null => {
    const nodes = nodesRef.current
    const hit = 26
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      if (Math.hypot(cx - n.x, cy - n.y) <= hit) return n.id
    }
    return null
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = pickNode(x, y)
    if (id !== null) {
      const n = nodesRef.current.find((o) => o.id === id)
      if (n) dragRef.current = { id, offX: x - n.x, offY: y - n.y }
      onSelectCharacter(id)
    } else {
      onSelectCharacter(null)
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const n = nodesRef.current.find((o) => o.id === drag.id)
    if (n) {
      n.x = Math.max(32, Math.min(size.w - 32, x - drag.offX))
      n.y = Math.max(32, Math.min(size.h - 32, y - drag.offY))
      draw()
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  if (characters.length === 0) {
    return (
      <div className="rounded-lg border border-[#333] bg-[#111] p-8 text-center text-sm text-slate-500">暂无角色</div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-[420px] rounded-lg border border-[#333] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      />
    </div>
  )
}

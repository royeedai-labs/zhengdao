import { useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  type Edge as RFEdge,
  type Node as RFNode
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Loader2, Users } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { mapCharactersToGraph } from './data-mappers/characters-to-graph'
import { layoutRelationGraph } from './relation-graph-layout'

/**
 * CG-A3.2 — RelationGraphView.
 *
 * 渲染角色关系图 (reactflow + dagre layout)。100+ 角色时建议先打开
 * mainOnly 再展开次要角色, 避免 dagre 计算过慢。
 */

interface CharacterRow {
  id: number
  name: string
  faction?: string | null
  isMain?: boolean
  description?: string
}

interface RelationRow {
  id: number
  source_id: number
  target_id: number
  relation_type: string
  label?: string
  chapter_range_start?: number | null
  chapter_range_end?: number | null
  dynamic?: number | boolean
}

interface RelationGraphApi {
  getCharacters(bookId: number): Promise<CharacterRow[]>
  getRelations(bookId: number): Promise<RelationRow[]>
}

interface Props {
  bookId: number
}

export default function RelationGraphView({ bookId }: Props) {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [relations, setRelations] = useState<RelationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mainOnly, setMainOnly] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const api = window.api as unknown as RelationGraphApi
        const [chars, rels] = await Promise.all([api.getCharacters(bookId), api.getRelations(bookId)])
        if (cancelled) return
        setCharacters(chars || [])
        setRelations(rels || [])
      } catch (err) {
        if (!cancelled) addToast('error', `加载关系数据失败: ${(err as Error).message ?? err}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookId, addToast])

  const { nodes, edges } = useMemo(() => {
    const mapped = mapCharactersToGraph(characters, relations, { mainOnly })
    return layoutRelationGraph(mapped.nodes, mapped.edges, { rankdir: 'LR' })
  }, [characters, relations, mainOnly])

  const rfNodes = useMemo<RFNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: n.data.label }
      })),
    [nodes]
  )

  const rfEdges = useMemo<RFEdge[]>(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated
      })),
    [edges]
  )

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <Users size={12} /> 角色 {characters.length} · 关系 {relations.length}
        </div>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={mainOnly}
            onChange={(e) => setMainOnly(e.target.checked)}
          />
          仅主角色
        </label>
      </div>
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="mr-2 animate-spin" /> 加载中…
          </div>
        ) : rfNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            该作品暂无角色或关系，去 AI 设置 → 关系图谱面板维护。
          </div>
        ) : (
          <ReactFlow nodes={rfNodes} edges={rfEdges} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

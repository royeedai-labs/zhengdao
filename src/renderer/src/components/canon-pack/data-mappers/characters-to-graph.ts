import { formatRelationLabel, normalizeRelationType } from '../../../../../shared/relation-types'

/**
 * CG-A3.1 — characters → reactflow graph mapper.
 *
 * Pure function; no DOM / no IPC. Consumes the same row shape produced
 * by the desktop SQLite repos (character-repo + relation-repo) so the
 * RelationGraphView can wire `data` straight to reactflow without
 * intermediate state. dagre layout 在 view 层做（Node/Edge 给的 position
 * 是 0,0 placeholder）。
 */

export interface CharacterRow {
  id: number
  name: string
  faction?: string | null
  isMain?: boolean
  description?: string
}

export interface RelationRow {
  id: number
  source_id: number
  target_id: number
  relation_type: string
  label?: string
  chapter_range_start?: number | null
  chapter_range_end?: number | null
  dynamic?: number | boolean
}

export interface GraphNode {
  id: string
  position: { x: number; y: number }
  data: {
    label: string
    faction?: string | null
    isMain?: boolean
  }
  type?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  data: {
    kind: string
    chapterRange?: [number, number]
    dynamic?: boolean
  }
  animated?: boolean
}

export interface GraphMapOptions {
  /** Filter relations to only those overlapping this chapter window. */
  chapterRange?: [number, number]
  /** Drop non-main characters and relations that lose either endpoint. */
  mainOnly?: boolean
}

function relationOverlaps(rel: RelationRow, range: [number, number]): boolean {
  const [from, to] = range
  const start = rel.chapter_range_start ?? null
  const end = rel.chapter_range_end ?? null
  if (start === null && end === null) return true
  const relFrom = start ?? -Infinity
  const relTo = end ?? Infinity
  return !(relTo < from || relFrom > to)
}

export function mapCharactersToGraph(
  characters: CharacterRow[],
  relations: RelationRow[],
  opts: GraphMapOptions = {}
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const filteredCharacters = opts.mainOnly ? characters.filter((c) => c.isMain) : characters
  const allowedIds = new Set(filteredCharacters.map((c) => c.id))

  const nodes: GraphNode[] = filteredCharacters.map((c) => ({
    id: String(c.id),
    position: { x: 0, y: 0 },
    data: {
      label: c.name,
      faction: c.faction ?? undefined,
      isMain: c.isMain ?? false
    },
    type: 'characterCard'
  }))

  const edges: GraphEdge[] = []
  for (const rel of relations) {
    if (!allowedIds.has(rel.source_id) || !allowedIds.has(rel.target_id)) continue
    if (rel.source_id === rel.target_id) continue
    if (opts.chapterRange && !relationOverlaps(rel, opts.chapterRange)) continue
    edges.push({
      id: `e-${rel.id}`,
      source: String(rel.source_id),
      target: String(rel.target_id),
      label: formatRelationLabel(rel.relation_type, rel.label),
      data: {
        kind: normalizeRelationType(rel.relation_type),
        chapterRange:
          rel.chapter_range_start != null && rel.chapter_range_end != null
            ? [rel.chapter_range_start, rel.chapter_range_end]
            : undefined,
        dynamic: Boolean(rel.dynamic)
      },
      animated: Boolean(rel.dynamic)
    })
  }
  return { nodes, edges }
}

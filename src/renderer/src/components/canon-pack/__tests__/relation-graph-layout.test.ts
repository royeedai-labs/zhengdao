import { describe, expect, it } from 'vitest'
import { layoutRelationGraph } from '../relation-graph-layout'
import type { GraphEdge, GraphNode } from '../data-mappers/characters-to-graph'

describe('layoutRelationGraph (CG-A3.2)', () => {
  it('returns nodes and edges with same length', () => {
    const nodes: GraphNode[] = [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: '2', position: { x: 0, y: 0 }, data: { label: 'B' } }
    ]
    const edges: GraphEdge[] = [
      { id: 'e-1', source: '1', target: '2', label: 'ally', data: { kind: 'ally' } }
    ]
    const out = layoutRelationGraph(nodes, edges)
    expect(out.nodes).toHaveLength(2)
    expect(out.edges).toHaveLength(1)
  })

  it('assigns non-zero coordinates after layout (LR)', () => {
    const nodes: GraphNode[] = [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: '2', position: { x: 0, y: 0 }, data: { label: 'B' } },
      { id: '3', position: { x: 0, y: 0 }, data: { label: 'C' } }
    ]
    const edges: GraphEdge[] = [
      { id: 'e-1', source: '1', target: '2', label: 'a', data: { kind: 'ally' } },
      { id: 'e-2', source: '2', target: '3', label: 'b', data: { kind: 'enemy' } }
    ]
    const out = layoutRelationGraph(nodes, edges, { rankdir: 'LR' })
    const xs = out.nodes.map((n) => n.position.x)
    expect(new Set(xs).size).toBeGreaterThan(1)
  })

  it('handles empty input without crashing', () => {
    const out = layoutRelationGraph([], [])
    expect(out.nodes).toEqual([])
    expect(out.edges).toEqual([])
  })

  it('layouts 30 nodes / 80 edges within 200ms (perf budget)', () => {
    const nodes: GraphNode[] = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      position: { x: 0, y: 0 },
      data: { label: `n${i + 1}` }
    }))
    const edges: GraphEdge[] = Array.from({ length: 80 }, (_, i) => ({
      id: `e-${i + 1}`,
      source: String(((i * 3) % 30) + 1),
      target: String(((i * 7) % 30) + 1),
      label: 'k',
      data: { kind: 'ally' }
    }))
    const start = performance.now()
    const out = layoutRelationGraph(nodes, edges)
    const elapsed = performance.now() - start
    expect(out.nodes).toHaveLength(30)
    expect(elapsed).toBeLessThan(200)
  })
})

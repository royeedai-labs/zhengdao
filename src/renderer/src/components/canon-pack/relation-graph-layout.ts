import dagre from 'dagre'
import type { GraphEdge, GraphNode } from './data-mappers/characters-to-graph'

/**
 * CG-A3.2 helper — apply dagre layout to a Node[] / Edge[] pair.
 *
 * Pure function pulled out of RelationGraphView so vitest (which runs in
 * node, not jsdom) can cover the layout shape without importing
 * reactflow.
 */

export interface LayoutOptions {
  rankdir?: 'LR' | 'TB'
  nodeWidth?: number
  nodeHeight?: number
  separation?: number
}

export function layoutRelationGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: LayoutOptions = {}
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const rankdir = opts.rankdir ?? 'LR'
  const nodeWidth = opts.nodeWidth ?? 150
  const nodeHeight = opts.nodeHeight ?? 50
  const separation = opts.separation ?? 30

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir, nodesep: separation, ranksep: separation * 1.5 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const positionedNodes: GraphNode[] = nodes.map((node) => {
    const dagreNode = g.node(node.id)
    if (!dagreNode) return node
    return {
      ...node,
      position: {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2
      }
    }
  })

  return { nodes: positionedNodes, edges }
}

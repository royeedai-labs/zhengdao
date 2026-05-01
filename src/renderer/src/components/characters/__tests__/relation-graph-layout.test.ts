import { describe, expect, it } from 'vitest'
import { layoutCharacterRelationGraph } from '../relation-graph-layout'

describe('layoutCharacterRelationGraph', () => {
  it('spreads connected and isolated characters into distinct positions', () => {
    const characters = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: `角色${index + 1}`
    }))
    const relations = [
      { source_id: 1, target_id: 2 },
      { source_id: 1, target_id: 3 },
      { source_id: 3, target_id: 4 },
      { source_id: 5, target_id: 6 }
    ]

    const result = layoutCharacterRelationGraph(characters, relations, 640)
    const positions = new Set(result.nodes.map((node) => `${Math.round(node.x)}:${Math.round(node.y)}`))

    expect(result.nodes).toHaveLength(characters.length)
    expect(positions.size).toBe(characters.length)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  it('uses a grid for large components instead of piling every node at the center', () => {
    const characters = Array.from({ length: 24 }, (_, index) => ({
      id: index + 1,
      name: `角色${index + 1}`
    }))
    const relations = characters.slice(1).map((character) => ({
      source_id: 1,
      target_id: character.id
    }))

    const result = layoutCharacterRelationGraph(characters, relations, 900)
    const xs = new Set(result.nodes.map((node) => Math.round(node.x)))
    const ys = new Set(result.nodes.map((node) => Math.round(node.y)))

    expect(xs.size).toBeGreaterThan(3)
    expect(ys.size).toBeGreaterThan(2)
  })
})

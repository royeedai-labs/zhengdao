import { describe, expect, it } from 'vitest'
import { mapCharactersToGraph, type CharacterRow, type RelationRow } from '../characters-to-graph'

describe('mapCharactersToGraph', () => {
  it('returns empty graph when no characters', () => {
    const { nodes, edges } = mapCharactersToGraph([], [])
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
  })

  it('emits one node per character with stable string IDs', () => {
    const chars: CharacterRow[] = [
      { id: 1, name: '甲' },
      { id: 2, name: '乙' }
    ]
    const { nodes } = mapCharactersToGraph(chars, [])
    expect(nodes.map((n) => n.id)).toEqual(['1', '2'])
    expect(nodes[0]?.data.label).toBe('甲')
  })

  it('uses relation type plus note as the edge label', () => {
    const chars: CharacterRow[] = [
      { id: 1, name: '甲' },
      { id: 2, name: '乙' }
    ]
    const rels: RelationRow[] = [
      { id: 1, source_id: 1, target_id: 2, relation_type: 'enemy', label: '旧案对手' }
    ]

    const { edges } = mapCharactersToGraph(chars, rels)

    expect(edges[0]?.label).toBe('敌对 · 旧案对手')
    expect(edges[0]?.data.kind).toBe('enemy')
  })

  it('skips edges whose endpoints are missing or self-loop', () => {
    const chars: CharacterRow[] = [{ id: 1, name: '甲' }]
    const rels: RelationRow[] = [
      { id: 10, source_id: 1, target_id: 99, relation_type: 'ally' },
      { id: 11, source_id: 1, target_id: 1, relation_type: 'enemy' }
    ]
    const { edges } = mapCharactersToGraph(chars, rels)
    expect(edges).toEqual([])
  })

  it('mainOnly drops non-main characters and edges that lose endpoints', () => {
    const chars: CharacterRow[] = [
      { id: 1, name: '甲', isMain: true },
      { id: 2, name: '乙', isMain: false },
      { id: 3, name: '丙', isMain: true }
    ]
    const rels: RelationRow[] = [
      { id: 1, source_id: 1, target_id: 2, relation_type: 'ally' },
      { id: 2, source_id: 1, target_id: 3, relation_type: 'rival' }
    ]
    const { nodes, edges } = mapCharactersToGraph(chars, rels, { mainOnly: true })
    expect(nodes.map((n) => n.id)).toEqual(['1', '3'])
    expect(edges.map((e) => e.id)).toEqual(['e-2'])
  })

  it('chapterRange filter keeps relations overlapping window + always-on (no range)', () => {
    const chars: CharacterRow[] = [
      { id: 1, name: '甲' },
      { id: 2, name: '乙' }
    ]
    const rels: RelationRow[] = [
      { id: 1, source_id: 1, target_id: 2, relation_type: 'ally' }, // no range → always
      {
        id: 2,
        source_id: 1,
        target_id: 2,
        relation_type: 'enemy',
        chapter_range_start: 1,
        chapter_range_end: 10
      },
      {
        id: 3,
        source_id: 1,
        target_id: 2,
        relation_type: 'romance',
        chapter_range_start: 50,
        chapter_range_end: 100
      }
    ]
    const { edges } = mapCharactersToGraph(chars, rels, { chapterRange: [5, 20] })
    const ids = edges.map((e) => e.id).sort()
    expect(ids).toEqual(['e-1', 'e-2'])
  })

  it('marks dynamic edges animated and exposes chapterRange in data', () => {
    const chars: CharacterRow[] = [
      { id: 1, name: '甲' },
      { id: 2, name: '乙' }
    ]
    const rels: RelationRow[] = [
      {
        id: 7,
        source_id: 1,
        target_id: 2,
        relation_type: 'rival',
        chapter_range_start: 3,
        chapter_range_end: 12,
        dynamic: 1
      }
    ]
    const { edges } = mapCharactersToGraph(chars, rels)
    expect(edges[0]?.animated).toBe(true)
    expect(edges[0]?.data.dynamic).toBe(true)
    expect(edges[0]?.data.chapterRange).toEqual([3, 12])
  })

  it('handles 30 characters × 80 relations within 100ms (perf budget)', () => {
    const chars: CharacterRow[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `角色${i + 1}`,
      isMain: i < 8
    }))
    const rels: RelationRow[] = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      source_id: ((i * 3) % 30) + 1,
      target_id: ((i * 7) % 30) + 1,
      relation_type: i % 2 === 0 ? 'ally' : 'rival'
    }))
    const start = performance.now()
    const { nodes, edges } = mapCharactersToGraph(chars, rels)
    const elapsed = performance.now() - start
    expect(nodes).toHaveLength(30)
    expect(edges.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
  })

  it('handles 120 characters × 240 relations within 500ms (large-work gate)', () => {
    const chars: CharacterRow[] = Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      name: `角色${i + 1}`,
      isMain: i < 16
    }))
    const rels: RelationRow[] = Array.from({ length: 240 }, (_, i) => ({
      id: i + 1,
      source_id: ((i * 5) % 120) + 1,
      target_id: ((i * 11) % 120) + 1,
      relation_type: i % 3 === 0 ? 'ally' : i % 3 === 1 ? 'rival' : 'family'
    }))
    const start = performance.now()
    const { nodes, edges } = mapCharactersToGraph(chars, rels)
    const elapsed = performance.now() - start
    expect(nodes).toHaveLength(120)
    expect(edges.length).toBeGreaterThan(180)
    expect(elapsed).toBeLessThan(500)
  })
})

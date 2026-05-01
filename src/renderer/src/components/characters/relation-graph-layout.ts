export interface CharacterGraphNodeInput {
  id: number
  name: string
}

export interface CharacterGraphRelationInput {
  source_id: number
  target_id: number
}

export interface CharacterGraphLayoutNode {
  id: number
  name: string
  x: number
  y: number
}

export interface CharacterGraphLayoutResult {
  nodes: CharacterGraphLayoutNode[]
  width: number
  height: number
}

interface ComponentLayout {
  nodes: CharacterGraphLayoutNode[]
  width: number
  height: number
}

function buildComponents(
  characters: CharacterGraphNodeInput[],
  relations: CharacterGraphRelationInput[]
): CharacterGraphNodeInput[][] {
  const byId = new Map(characters.map((character) => [character.id, character]))
  const adjacency = new Map<number, Set<number>>()
  for (const character of characters) adjacency.set(character.id, new Set())
  for (const relation of relations) {
    if (relation.source_id === relation.target_id) continue
    if (!byId.has(relation.source_id) || !byId.has(relation.target_id)) continue
    adjacency.get(relation.source_id)?.add(relation.target_id)
    adjacency.get(relation.target_id)?.add(relation.source_id)
  }

  const visited = new Set<number>()
  const components: CharacterGraphNodeInput[][] = []
  for (const character of characters) {
    if (visited.has(character.id)) continue
    const queue = [character.id]
    const ids: number[] = []
    visited.add(character.id)
    while (queue.length > 0) {
      const id = queue.shift()!
      ids.push(id)
      for (const next of adjacency.get(id) || []) {
        if (visited.has(next)) continue
        visited.add(next)
        queue.push(next)
      }
    }
    components.push(
      ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .sort((a, b) => a!.id - b!.id) as CharacterGraphNodeInput[]
    )
  }

  return components.sort((a, b) => b.length - a.length || a[0]!.id - b[0]!.id)
}

function relationDegreeMap(relations: CharacterGraphRelationInput[]): Map<number, number> {
  const degree = new Map<number, number>()
  for (const relation of relations) {
    if (relation.source_id === relation.target_id) continue
    degree.set(relation.source_id, (degree.get(relation.source_id) || 0) + 1)
    degree.set(relation.target_id, (degree.get(relation.target_id) || 0) + 1)
  }
  return degree
}

function layoutComponent(
  component: CharacterGraphNodeInput[],
  degree: Map<number, number>
): ComponentLayout {
  const count = component.length
  if (count === 1) {
    return {
      nodes: [{ id: component[0]!.id, name: component[0]!.name, x: 80, y: 56 }],
      width: 160,
      height: 112
    }
  }
  if (count === 2) {
    return {
      nodes: [
        { id: component[0]!.id, name: component[0]!.name, x: 68, y: 64 },
        { id: component[1]!.id, name: component[1]!.name, x: 232, y: 64 }
      ],
      width: 300,
      height: 128
    }
  }

  if (count > 12) {
    const columns = Math.ceil(Math.sqrt(count * 1.4))
    const spacingX = 176
    const spacingY = 118
    return {
      nodes: component.map((character, index) => ({
        id: character.id,
        name: character.name,
        x: 72 + (index % columns) * spacingX,
        y: 64 + Math.floor(index / columns) * spacingY
      })),
      width: 144 + (columns - 1) * spacingX,
      height: 128 + (Math.ceil(count / columns) - 1) * spacingY
    }
  }

  const sorted = [...component].sort(
    (a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0) || a.id - b.id
  )
  const center = sorted[0]!
  const satellites = sorted.slice(1)
  const radius = Math.max(112, Math.min(220, 48 + satellites.length * 24))
  const box = radius * 2 + 128
  const cx = box / 2
  const cy = box / 2
  const nodes: CharacterGraphLayoutNode[] = [{ id: center.id, name: center.name, x: cx, y: cy }]
  satellites.forEach((character, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / satellites.length
    nodes.push({
      id: character.id,
      name: character.name,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    })
  })
  return { nodes, width: box, height: box }
}

export function layoutCharacterRelationGraph(
  characters: CharacterGraphNodeInput[],
  relations: CharacterGraphRelationInput[],
  viewportWidth = 640
): CharacterGraphLayoutResult {
  if (characters.length === 0) return { nodes: [], width: 0, height: 0 }

  const degree = relationDegreeMap(relations)
  const components = buildComponents(characters, relations).map((component) =>
    layoutComponent(component, degree)
  )
  const rowLimit = Math.max(560, viewportWidth - 96)
  const gapX = 112
  const gapY = 96
  const nodes: CharacterGraphLayoutNode[] = []
  let cursorX = 48
  let cursorY = 48
  let rowHeight = 0
  let maxWidth = 0

  for (const component of components) {
    if (cursorX > 48 && cursorX + component.width > rowLimit) {
      cursorX = 48
      cursorY += rowHeight + gapY
      rowHeight = 0
    }
    for (const node of component.nodes) {
      nodes.push({
        ...node,
        x: node.x + cursorX,
        y: node.y + cursorY
      })
    }
    maxWidth = Math.max(maxWidth, cursorX + component.width + 48)
    cursorX += component.width + gapX
    rowHeight = Math.max(rowHeight, component.height)
  }

  return {
    nodes,
    width: Math.max(maxWidth, rowLimit),
    height: cursorY + rowHeight + 48
  }
}

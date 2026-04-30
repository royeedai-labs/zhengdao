import { describe, expect, it } from 'vitest'
import { buildDesktopCanonPack } from '../workflow/canon-pack'

describe('buildDesktopCanonPack — DI-07 v3.3 contract v0.2', () => {
  it('emits version canon-pack.v0.2', () => {
    const pack = buildDesktopCanonPack({ bookId: 1 })
    expect(pack.version).toBe('canon-pack.v0.2')
    expect(pack.provenance.source).toBe('desktop-local')
    expect(pack.provenance.userConfirmedOnly).toBe(true)
  })

  it('omits relations / events / organizations when desktop has none (v0.1 compat)', () => {
    const pack = buildDesktopCanonPack({ bookId: 1 })
    expect(pack.assets.relations).toBeUndefined()
    expect(pack.assets.events).toBeUndefined()
    expect(pack.assets.organizations).toBeUndefined()
  })

  it('passes through relations with chapterRange + dynamic + label', () => {
    const pack = buildDesktopCanonPack({
      bookId: 1,
      relations: [
        {
          fromId: 10,
          toId: 11,
          kind: 'enemy',
          label: '世仇',
          chapterRange: [1, 50],
          dynamic: true
        }
      ]
    })
    expect(pack.assets.relations).toHaveLength(1)
    expect(pack.assets.relations?.[0]).toEqual({
      fromId: '10',
      toId: '11',
      kind: 'enemy',
      label: '世仇',
      chapterRange: [1, 50],
      dynamic: true
    })
  })

  it('caps relations at 100, events at 50, organizations at 30', () => {
    const relations = Array.from({ length: 150 }, (_, i) => ({
      fromId: i,
      toId: i + 1,
      kind: 'ally'
    }))
    const events = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      title: `事件 ${i}`,
      chapterNumber: i
    }))
    const organizations = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `组织 ${i}`
    }))
    const pack = buildDesktopCanonPack({ bookId: 1, relations, events, organizations })
    expect(pack.assets.relations).toHaveLength(100)
    expect(pack.assets.events).toHaveLength(50)
    expect(pack.assets.organizations).toHaveLength(30)
  })

  it('coerces numeric IDs to strings and applies sane defaults for events / orgs', () => {
    const pack = buildDesktopCanonPack({
      bookId: 1,
      events: [{ id: 7, title: '主角觉醒' }],
      organizations: [{ id: 5, name: '青云宗' }]
    })
    expect(pack.assets.events?.[0]?.id).toBe('7')
    expect(pack.assets.events?.[0]?.eventType).toBe('plot')
    expect(pack.assets.events?.[0]?.importance).toBe('normal')
    expect(pack.assets.organizations?.[0]?.id).toBe('5')
    expect(pack.assets.organizations?.[0]?.orgType).toBe('group')
    expect(pack.assets.organizations?.[0]?.parentId).toBeUndefined()
  })

  it('keeps existing v0.1 fields (characters / foreshadowings / plotNodes) intact', () => {
    const pack = buildDesktopCanonPack({
      bookId: 1,
      characters: [{ id: 1, name: '甲' }],
      foreshadowings: [{ id: 2, text: '伏笔', status: 'open' }],
      plotNodes: [{ id: 3, title: '节点', chapter_number: 5 }]
    })
    expect(pack.assets.characters).toHaveLength(1)
    expect(pack.assets.foreshadowings).toHaveLength(1)
    expect(pack.assets.plotNodes).toHaveLength(1)
    expect(pack.assets.plotNodes[0]?.chapterNumber).toBe(5)
  })
})

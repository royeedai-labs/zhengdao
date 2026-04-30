import { clip, nonEmpty } from './helpers'
import type {
  AiCanonPack,
  AiCanonPackEvent,
  AiCanonPackOrganization,
  AiCanonPackRelation,
  AiWorkProfile
} from './types'

/**
 * SPLIT-008 / DI-07 v3.3 — buildDesktopCanonPack.
 *
 * Shape the local data the renderer has (book + work profile + selection
 * + characters + foreshadowings + plot nodes + local citations + DI-07 v3
 * relations / events / organizations) into the JSON contract the backend
 * Skill execution layer + DI-07 v1 lock panel + CG-A3 visual views all
 * consume. v0.2 keeps the v0.1 fields untouched and only adds three
 * optional asset bundles.
 */

const RELATIONS_CAP = 100
const EVENTS_CAP = 50
const ORGS_CAP = 30

export interface DesktopRelationInput {
  fromId: number
  toId: number
  kind: string
  label?: string
  chapterRange?: [number, number]
  dynamic?: boolean
}

export interface DesktopEventInput {
  id: number
  title: string
  description?: string
  chapterNumber?: number | null
  eventType?: 'plot' | 'character' | 'world' | 'foreshadow'
  importance?: 'low' | 'normal' | 'high'
  relatedCharacterIds?: number[]
}

export interface DesktopOrganizationInput {
  id: number
  name: string
  description?: string
  parentId?: number | null
  orgType?: 'group' | 'faction' | 'company' | 'department'
  memberIds?: number[]
}

export function buildDesktopCanonPack(input: {
  bookId: number
  profile?: AiWorkProfile | null
  currentChapter?: { id: number; title: string; plainText: string } | null
  selectedText?: string
  characters?: Array<{ id: number; name: string; description?: string }>
  foreshadowings?: Array<{ id: number; text: string; status: string }>
  plotNodes?: Array<{ id: number; title: string; description?: string; chapter_number?: number }>
  relations?: DesktopRelationInput[]
  events?: DesktopEventInput[]
  organizations?: DesktopOrganizationInput[]
  localCitations?: Array<{
    ref: string
    sourceId: string
    title?: string
    excerpt: string
    score?: number
  }>
  generatedAt?: string
}): AiCanonPack {
  const profile = input.profile
  const relations = input.relations
    ? input.relations.slice(0, RELATIONS_CAP).map<AiCanonPackRelation>((relation) => ({
        fromId: String(relation.fromId),
        toId: String(relation.toId),
        kind: relation.kind,
        label: nonEmpty(relation.label) ? relation.label : undefined,
        chapterRange: relation.chapterRange,
        dynamic: relation.dynamic
      }))
    : undefined
  const events = input.events
    ? input.events.slice(0, EVENTS_CAP).map<AiCanonPackEvent>((event) => ({
        id: String(event.id),
        title: event.title,
        description: nonEmpty(event.description) ? event.description : undefined,
        chapterNumber: typeof event.chapterNumber === 'number' ? event.chapterNumber : undefined,
        eventType: event.eventType ?? 'plot',
        importance: event.importance ?? 'normal',
        relatedCharacterIds: event.relatedCharacterIds?.map((id) => String(id))
      }))
    : undefined
  const organizations = input.organizations
    ? input.organizations.slice(0, ORGS_CAP).map<AiCanonPackOrganization>((org) => ({
        id: String(org.id),
        name: org.name,
        description: nonEmpty(org.description) ? org.description : undefined,
        parentId:
          typeof org.parentId === 'number' && org.parentId !== null ? String(org.parentId) : undefined,
        orgType: org.orgType ?? 'group',
        memberIds: org.memberIds?.map((id) => String(id))
      }))
    : undefined

  return {
    version: 'canon-pack.v0.2',
    bookId: input.bookId,
    style: {
      styleGuide: profile?.style_guide || undefined,
      genreRules: profile?.genre_rules || undefined,
      contentBoundaries: profile?.content_boundaries || undefined,
      assetRules: profile?.asset_rules || undefined,
      rhythmRules: profile?.rhythm_rules || undefined
    },
    scene: {
      selectedText: nonEmpty(input.selectedText) ? clip(input.selectedText || '', 1600) : undefined,
      currentChapter: input.currentChapter
        ? {
            id: String(input.currentChapter.id),
            title: input.currentChapter.title,
            excerpt: clip(input.currentChapter.plainText || '', 2600)
          }
        : undefined
    },
    assets: {
      characters: (input.characters || []).slice(0, 20).map((character) => ({
        id: String(character.id),
        name: character.name,
        description: nonEmpty(character.description) ? character.description : undefined
      })),
      foreshadowings: (input.foreshadowings || []).slice(0, 20).map((item) => ({
        id: String(item.id),
        text: item.text,
        status: item.status
      })),
      plotNodes: (input.plotNodes || []).slice(0, 20).map((node) => ({
        id: String(node.id),
        title: node.title,
        description: nonEmpty(node.description) ? node.description : undefined,
        chapterNumber: node.chapter_number
      })),
      relations,
      events,
      organizations
    },
    retrieval: {
      mode: (input.localCitations || []).length > 0 ? 'local_keyword' : 'off',
      citations: input.localCitations || []
    },
    provenance: {
      source: 'desktop-local',
      generatedAt: input.generatedAt || new Date().toISOString(),
      userConfirmedOnly: true
    }
  }
}

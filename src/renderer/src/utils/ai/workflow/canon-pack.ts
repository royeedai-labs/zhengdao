import { clip, nonEmpty } from './helpers'
import type { AiCanonPack, AiWorkProfile } from './types'

/**
 * SPLIT-008 — buildDesktopCanonPack: shape the local data the renderer
 * has (book + work profile + selection + characters + foreshadowings +
 * plot nodes + local citations) into the JSON contract that the backend
 * Skill execution layer + DI-07 v1 lock panel both consume.
 */

export function buildDesktopCanonPack(input: {
  bookId: number
  profile?: AiWorkProfile | null
  currentChapter?: { id: number; title: string; plainText: string } | null
  selectedText?: string
  characters?: Array<{ id: number; name: string; description?: string }>
  foreshadowings?: Array<{ id: number; text: string; status: string }>
  plotNodes?: Array<{ id: number; title: string; description?: string; chapter_number?: number }>
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
  return {
    version: 'canon-pack.v0.1',
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
      }))
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

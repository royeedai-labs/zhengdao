export type StoryFactKind =
  | 'character_status'
  | 'character_motivation'
  | 'character_secret'
  | 'timeline'
  | 'setting'
  | 'clue'
  | 'relationship'

export type StoryFactProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface StoryFactProposal {
  id: number
  book_id: number
  source_type: string
  source_ref: string
  fact_kind: StoryFactKind
  subject: string
  fact_key: string
  value: string
  evidence: string
  confidence: number
  status: StoryFactProposalStatus
  chapter_number: number | null
  created_at: string
  updated_at: string
}

export interface StoryBibleCharacter {
  id: number
  name: string
  status: string
  faction?: string
  motivation?: string
  secret?: string
  description?: string
}

export interface StoryBibleTimelineEvent {
  id?: number
  title: string
  description?: string
  chapterNumber?: number | null
  source?: string
}

export interface StoryBibleSnapshot {
  version: 'story-bible.v1'
  bookId: number
  generatedAt: string
  characters: StoryBibleCharacter[]
  timeline: StoryBibleTimelineEvent[]
  settings: Array<{ id?: number; title: string; content: string; category?: string }>
  foreshadowings: Array<{ id: number; text: string; status: string; expectedChapter?: number | null }>
  plotNodes: Array<{ id: number; title: string; chapterNumber?: number; description?: string }>
  pendingFacts: Array<Pick<StoryFactProposal, 'id' | 'fact_kind' | 'subject' | 'fact_key' | 'value' | 'evidence' | 'confidence'>>
}

export interface CaptureStoryFactsInput {
  bookId: number
  sourceType: string
  sourceRef?: string
  text: string
  chapterNumber?: number | null
}

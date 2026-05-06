export type WritingIntelPlatform = 'fanqie' | 'qidian' | 'qimao' | 'zongheng' | 'custom'
export type WritingIntelChannel = 'all' | 'male' | 'female'
export type WritingIntelBoard = 'reading' | 'new_book' | 'peak' | 'monthly_ticket' | 'custom'
export type WritingIntelInsightKind =
  | 'hot_competitive'
  | 'hot_gap'
  | 'low_supply'
  | 'rising'
  | 'promotion'
  | 'risk'
  | 'submission'
  | 'opportunity'

export interface WritingIntelSource {
  id: string
  slug: string
  name: string
  platform: WritingIntelPlatform
  sourceUrl: string
  sourceLabel: string
  rightsNote: string
  status: 'active' | 'paused' | 'archived'
  official: boolean
  sortOrder: number
  lastCapturedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WritingIntelSnapshot {
  id: string
  sourceId: string
  platform: WritingIntelPlatform
  channel: WritingIntelChannel
  board: WritingIntelBoard
  capturedAt: string
  sourceUrl: string
  sourceLabel: string
  rightsNote: string
  official: boolean
  status: 'draft' | 'published' | 'archived'
  summary: string
  metadata: Record<string, unknown>
  importedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface WritingIntelGenreStat {
  id: string
  snapshotId: string
  sourceId: string
  platform: WritingIntelPlatform
  channel: WritingIntelChannel
  board: WritingIntelBoard
  capturedAt: string
  category: string
  bookCount: number
  totalReads: number
  averageReads: number
  topRank: number | null
  newEntryCount: number
  risingCount: number
  fallingCount: number
  promotionCount: number
  saturation: 'low' | 'medium' | 'high' | 'unknown'
  opportunityLabel: string
  createdAt: string
}

export interface WritingIntelRankingEntry {
  id: string
  snapshotId: string
  sourceId: string
  platform: WritingIntelPlatform
  channel: WritingIntelChannel
  board: WritingIntelBoard
  capturedAt: string
  rank: number
  title: string
  author: string
  category: string
  tags: string[]
  wordCount: number | null
  readCount: number | null
  heat: number | null
  score: string | null
  status: string
  sourceBookId: string | null
  sourceUrl: string | null
  synopsis: string
  isNew: boolean
  rankDelta: number | null
  promotedFromNewBook: boolean
  createdAt: string
}

export interface WritingIntelInsightCard {
  id: string
  snapshotId: string | null
  sourceId: string | null
  platform: WritingIntelPlatform
  channel: WritingIntelChannel
  board: WritingIntelBoard
  category: string | null
  kind: WritingIntelInsightKind
  title: string
  summary: string
  evidence: Array<Record<string, unknown>>
  score: number
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface WritingIntelOverviewResponse {
  sources: WritingIntelSource[]
  snapshots: WritingIntelSnapshot[]
  genreStats: WritingIntelGenreStat[]
  insights: WritingIntelInsightCard[]
}

export interface WritingIntelSourcesResponse {
  sources: WritingIntelSource[]
}

export interface WritingIntelGenreStatsResponse {
  genreStats: WritingIntelGenreStat[]
}

export interface WritingIntelRankingsResponse {
  entries: WritingIntelRankingEntry[]
}

export interface WritingIntelInsightsResponse {
  insights: WritingIntelInsightCard[]
}

export interface WritingIntelApiResult<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

export interface WritingIntelQuery {
  platform?: WritingIntelPlatform
  channel?: WritingIntelChannel
  board?: WritingIntelBoard
  snapshotId?: string
  category?: string
  kind?: WritingIntelInsightKind
  limit?: number
}

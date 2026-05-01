import type { Genre } from './genre'

export type DirectorRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'awaiting_accept'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'quota_exceeded'

export type DirectorChapterStatus = 'draft' | 'accepted' | 'rejected' | 'regenerating'
export type DirectorStepName =
  | 'world'
  | 'characters'
  | 'outline'
  | 'volume_strategy'
  | 'rhythm_breakdown'
  | 'chapter_draft'

export type DirectorCanonContext = {
  bookTitle?: string
  workProfile?: {
    styleGuide?: string
    genreRules?: string
    contentBoundaries?: string
    rhythmRules?: string
    assetRules?: string
  }
  characters?: Array<{
    name: string
    description?: string
    faction?: string
    status?: string
  }>
  plotNodes?: Array<{
    chapterNumber?: number
    title: string
    score?: number
    description?: string
  }>
  foreshadowings?: Array<{
    text: string
    status?: string
    expectedChapter?: number | null
  }>
  chapters?: Array<{
    chapterNumber: number
    title: string
    summary?: string
  }>
  minimumCharacterCount?: number
}

export type DirectorEvent =
  | { type: 'run_started'; runId: string; genre: Genre; seed: string; ts: string }
  | { type: 'step_started'; runId: string; stepName: DirectorStepName; ts: string }
  | {
      type: 'step_completed'
      runId: string
      stepName: DirectorStepName
      elapsedMs: number
      cost: number
      usage: Record<string, unknown>
      ts: string
    }
  | { type: 'step_regenerated'; runId: string; stepName: DirectorStepName; attempt: number; ts: string }
  | { type: 'step_awaiting_accept'; runId: string; stepName: DirectorStepName; reason: string; ts: string }
  | { type: 'chapter_draft_completed'; runId: string; chapterIndex: number; wordCount: number; ts: string }
  | { type: 'run_paused'; runId: string; currentStep?: DirectorStepName; ts: string }
  | { type: 'run_resumed'; runId: string; currentStep?: DirectorStepName; ts: string }
  | { type: 'run_cancelled'; runId: string; reason: string; ts: string }
  | { type: 'run_completed'; runId: string; totalCost: number; totalTokens: number; elapsedMs: number; ts: string }
  | { type: 'run_failed'; runId: string; stepName?: DirectorStepName; errorCode: string; errorMessage: string; ts: string }

export type DirectorStartRunInput = {
  bookId: number
  seed: string
  genre: Genre
  options?: {
    writerModel?: string
    criticModel?: string
    auditorModel?: string
    maxChapters?: number
    canonContext?: DirectorCanonContext
  }
}

export type DirectorRunLink = {
  id: number
  book_id: number
  remote_run_id: string
  seed: string
  genre: Genre
  status: DirectorRunStatus
  created_at: string
  updated_at: string
}

export type DirectorChapterCache = {
  id: number
  director_run_link_id: number
  remote_chapter_id: string
  chapter_index: number
  title: string
  content: string
  status: DirectorChapterStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DirectorRemoteRun = {
  id: string
  genre: Genre
  seed: string
  status: DirectorRunStatus
  currentStep?: DirectorStepName
  costUsd?: number
  tokenUsage?: Record<string, unknown>
  history?: Array<{ stepName: DirectorStepName; attempt: number; output: unknown; timestamp: string }>
}

export type DirectorRemoteChapter = {
  id: string
  runId: string
  chapterIndex: number
  title: string
  content: string
  status: DirectorChapterStatus
  metadata: Record<string, unknown>
  acceptedAt?: string
}

export type DirectorStartRunResult = {
  runId: string
  link: DirectorRunLink
}

export type DirectorAcceptChapterInput = {
  bookId: number
  runId: string
  chapterId: string
}

export type DirectorAcceptChapterResult = {
  chapter: DirectorChapterCache
  draft: unknown
}

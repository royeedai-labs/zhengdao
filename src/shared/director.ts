import type { Genre } from './genre'
import type { StoryBibleSnapshot } from './story-bible'

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
export type DirectorRunMode = 'plan_only' | 'sample_draft'
export type DirectorStepName =
  | 'world'
  | 'characters'
  | 'outline'
  | 'volume_strategy'
  | 'rhythm_breakdown'
  | 'planning_audit'
  | 'chapter_draft'

export type DirectorCanonContext = {
  bookTitle?: string
  storyBible?: StoryBibleSnapshot
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

export type DirectorPlanningIssue = {
  category:
    | 'promise'
    | 'rhythm'
    | 'character'
    | 'relationship'
    | 'chapter'
    | 'naming'
    | 'foreshadowing'
    | 'logic'
  severity: 'info' | 'warning' | 'blocking'
  scope: string
  message: string
  recommendation: string
}

export type DirectorPlanningQualityReport = {
  status: 'pass' | 'needs_revision'
  methodology: string
  dynamicStandard: string
  issues: DirectorPlanningIssue[]
  recommendations: string[]
}

export type DirectorPlanningPack = {
  mode: DirectorRunMode
  promise: {
    premise: string
    readerExpectation: string
    centralQuestion: string
    protagonistGoal: string
    coreAppeal: string
    emotionalTone: string
  }
  rhythmProfile: {
    rhythmType: string
    pacingRationale: string
    readerBenefitPrinciple: string
    lowYieldTolerance: string
    expectedBenefitCurve: Array<{
      chapterIndex: number
      expectedReaderBenefit: string
      expectedPressure: string
      expectedPayoffOrHook: string
    }>
  }
  world: {
    name: string
    setting: string
    rules: string[]
    conflict: string
  }
  characters: Array<{
    name: string
    role: string
    motivation?: string
    storyFunction: string
    importance: 'lead' | 'opposition' | 'supporting'
  }>
  relations: Array<{
    sourceName: string
    targetName: string
    tension: string
    storyFunction: string
  }>
  volumes: Array<{
    volumeNumber: number
    title: string
    focusArc: string
    readerPromise: string
  }>
  chapters: Array<{
    chapterIndex: number
    title: string
    purpose: string
    beat: string
    characterFocus: string
    readerBenefit: string
    pressureSource: string
    payoffOrHook: string
    poisonRisk: string
    obstacle: string
    cost: string
    skillUsed?: string
    clueFragments: Array<{
      fragment: string
      source: string
      placement: string
    }>
    causalLinks: Array<{
      because: string
      therefore: string
    }>
    sceneAnchors: {
      location: string
      smell: string
      sound: string
      eraProp: string
      tactileOrTemperature?: string
      visualTexture?: string
    }
    targetWordCount?: number
  }>
  foreshadowLedger: Array<{
    text: string
    status?: string
    expectedChapter?: number | null
  }>
  qualityReport: DirectorPlanningQualityReport
}

export type DirectorStartRunInput = {
  bookId: number
  seed: string
  genre: Genre
  options?: {
    mode?: DirectorRunMode
    writerModel?: string
    criticModel?: string
    auditorModel?: string
    maxChapters?: number
    targetChapterCount?: number
    targetVolumeCount?: number
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
  mode?: DirectorRunMode
  status: DirectorRunStatus
  currentStep?: DirectorStepName
  costUsd?: number
  tokenUsage?: Record<string, unknown>
  history?: Array<{ stepName: DirectorStepName; attempt: number; output: unknown; timestamp: string }>
  planningPack?: DirectorPlanningPack
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

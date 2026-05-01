export interface Book {
  id: number
  title: string
  author: string
  cover_path: string | null
  cover_url?: string | null
  created_at: string
  updated_at: string
  total_words?: number
}

export interface ProjectConfig {
  id: number
  book_id: number
  genre: string
  character_fields: CharacterField[]
  faction_labels: FactionLabel[]
  status_labels: StatusLabel[]
  emotion_labels: EmotionLabel[]
  daily_goal: number
  daily_goal_mode: 'follow_system' | 'custom'
  sensitive_list: string
  editor_font?: string
  editor_font_size?: number
  editor_line_height?: number
  editor_width?: 'narrow' | 'standard' | 'wide'
}

export interface CharacterField {
  key: string
  label: string
  type: 'text' | 'select' | 'number'
  options?: string[]
}

export interface FactionLabel {
  value: string
  label: string
  color: string
}

export interface StatusLabel {
  value: string
  label: string
}

export interface EmotionLabel {
  score: number
  label: string
}

export interface Volume {
  id: number
  book_id: number
  title: string
  sort_order: number
  created_at: string
  chapters?: ChapterMeta[]
}

export interface ChapterMeta {
  id: number
  volume_id: number
  title: string
  word_count: number
  summary?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Chapter extends ChapterMeta {
  content?: string | null
}

export interface Character {
  id: number
  book_id: number
  name: string
  faction: string
  status: string
  custom_fields: Record<string, string>
  description: string
  avatar_path: string | null
  created_at: string
  updated_at: string
}

export interface CharacterAppearance {
  chapter_id: number
  chapter_title: string
  volume_title: string
}

export interface CharacterRelation {
  id: number
  book_id: number
  source_id: number
  target_id: number
  relation_type: string
  label: string
}

export interface CharacterMilestone {
  id: number
  character_id: number
  chapter_number: number
  label: string
  value: string
  created_at: string
}

export interface Plotline {
  id: number
  book_id: number
  name: string
  color: string
  sort_order: number
}

export interface PlotNode {
  id: number
  book_id: number
  chapter_number: number
  title: string
  score: number
  node_type: 'main' | 'branch'
  description: string
  sort_order: number
  plotline_id?: number | null
}

export interface Foreshadowing {
  id: number
  book_id: number
  chapter_id: number
  chapter_title?: string
  text: string
  expected_chapter: number | null
  expected_word_count: number | null
  status: 'pending' | 'warning' | 'resolved'
  auto_suppressed?: number
  created_at: string
}

export interface WikiEntry {
  id: number
  book_id: number
  category: string
  title: string
  content: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Snapshot {
  id: number
  chapter_id: number
  content: string
  word_count: number
  created_at: string
}

export interface DailyStats {
  id: number
  book_id: number
  date: string
  word_count: number
}

export interface Note {
  id: number
  book_id: number
  content: string
  created_at: string
}

export interface Annotation {
  id: number
  chapter_id: number
  text_anchor: string
  content: string
  created_at: string
}

export type ModalType =
  | null
  | 'character'
  | 'fullCharacters'
  | 'settings'
  | 'plotNode'
  | 'newVolume'
  | 'newChapter'
  | 'foreshadow'
  | 'foreshadowBoard'
  | 'quickNotes'
  | 'projectSettings'
  | 'snapshot'
  | 'export'
  | 'confirm'
  | 'newBook'
  | 'login'
  | 'commandPalette'
  | 'styleAnalysis'
  | 'globalSearch'
  | 'trash'
  | 'characterCompare'
  | 'stats'
  | 'textAnalysis'
  | 'bookOverview'
  | 'consistencyCheck'
  | 'aiSettings'
  | 'appSettings'
  | 'chapterReview'
  | 'publishCheck'
  | 'formatTemplate'
  | 'dialogueRewrite'
  | 'worldConsistency'
  | 'citationsManager'
  | 'citationPicker'
  | 'referencesBuild'
  | 'teamManagement'
  | 'canonPack'
  | 'directorPanel'
  | 'visualStudio'
  | 'mcpSettings'
  | 'marketScanDeconstruct'

export interface GenrePreset {
  id: string
  name: string
  character_fields: CharacterField[]
  faction_labels: FactionLabel[]
  status_labels: StatusLabel[]
  emotion_labels: EmotionLabel[]
}

export interface GenreTemplate {
  id: number
  slug: string
  name: string
  character_fields: CharacterField[]
  faction_labels: FactionLabel[]
  status_labels: StatusLabel[]
  emotion_labels: EmotionLabel[]
  is_seed: number
  created_at: string
  updated_at: string
}

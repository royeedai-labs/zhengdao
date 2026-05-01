import { create } from 'zustand'
import type { ModalType } from '@/types'
import { isThemeId, resolveThemeMode, type ThemeId } from '@/utils/themes'
import { syncCurrentTitlebarOverlay } from '@/utils/window-shell'
import {
  clampWorkspacePanelWidth,
  clampWorkspaceLayoutPanelSizes,
  createClassicWorkspaceLayoutSnapshot,
  getDefaultWorkspacePanelWidth,
  isWorkspaceLayoutPresetId,
  isRightPanelTab,
  resolveDefaultBottomPanelOpen,
  resolveWorkspaceLayoutPresetSnapshot,
  sanitizeWorkspaceLayoutSnapshot,
  terminalPercentToHeight,
  workspacePanelPercentToWidth,
  type RightPanelTab,
  type WorkspaceLayoutPanelSizes,
  type WorkspaceLayoutPresetDefinition,
  type WorkspaceLayoutPresetId,
  type WorkspaceLayoutSnapshot,
  type WorkspacePanelKind
} from '@/utils/workspace-layout'
import {
  clampAiAssistantLauncherPosition,
  clampAiAssistantPanelRect,
  createDefaultAiAssistantLauncherPosition,
  createDefaultAiAssistantPanelRect,
  type AiAssistantLauncherPosition,
  type AiAssistantPanelRect
} from '@/components/ai/panel-layout'
import { createInitialSaveStatus, type ChapterSaveStatus } from '../utils/daily-workbench'
import type { AssistantSurface } from '../../../shared/ai-book-creation'

const THEME_STORAGE_KEY = 'write-ui-theme'
const BOTTOM_PANEL_OPEN_STORAGE_KEY = 'write-bottom-panel-open'
const BOTTOM_PANEL_HEIGHT_STORAGE_KEY = 'write-bottom-panel-height'
const LEFT_PANEL_WIDTH_STORAGE_KEY = 'write-left-panel-width'
const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'write-right-panel-width'
const RIGHT_PANEL_TAB_STORAGE_KEY = 'write-right-panel-tab'
const TOPBAR_TOOLS_COLLAPSED_STORAGE_KEY = 'write-topbar-tools-collapsed'
const AI_ASSISTANT_PANEL_RECT_STORAGE_KEY = 'write-ai-assistant-panel-rect'
const AI_ASSISTANT_LAUNCHER_POSITION_STORAGE_KEY = 'write-ai-assistant-launcher-position'
const WORKSPACE_LAYOUT_ACTIVE_PRESET_STORAGE_KEY = 'write-workspace-layout-active-preset'
const WORKSPACE_LAYOUT_CURRENT_SNAPSHOT_STORAGE_KEY = 'write-workspace-layout-current-snapshot'
const WORKSPACE_LAYOUT_CLASSIC_SNAPSHOT_STORAGE_KEY = 'write-workspace-layout-classic-snapshot'
const WORKSPACE_LAYOUT_CUSTOM_PRESETS_STORAGE_KEY = 'write-workspace-layout-custom-presets'
const WORKSPACE_LAYOUT_MIGRATED_STORAGE_KEY = 'write-workspace-layout-v2-migrated'

function clampBottomPanelHeight(height: number): number {
  if (typeof window === 'undefined') {
    return Math.max(220, Math.min(height, 560))
  }
  const maxHeight = Math.max(220, Math.floor(window.innerHeight * 0.7))
  return Math.max(220, Math.min(Math.round(height), maxHeight))
}

function readStoredTheme(): string {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v && isThemeId(v)) return v
  } catch {
    void 0
  }
  return 'system'
}

function prefersDarkTheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === 'undefined') return
  const resolved = resolveThemeMode(theme, prefersDarkTheme())
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themeMode = theme
  document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
  syncCurrentTitlebarOverlay()
}

const initialTheme = readStoredTheme() as ThemeId

function readStoredBottomPanelHeight(): number {
  try {
    const raw = localStorage.getItem(BOTTOM_PANEL_HEIGHT_STORAGE_KEY)
    if (!raw) return 320
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return 320
    return clampBottomPanelHeight(parsed)
  } catch {
    return 320
  }
}

function readStoredBottomPanelOpen(): boolean {
  try {
    return resolveDefaultBottomPanelOpen(localStorage.getItem(BOTTOM_PANEL_OPEN_STORAGE_KEY))
  } catch {
    return resolveDefaultBottomPanelOpen(null)
  }
}

function persistBottomPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(BOTTOM_PANEL_OPEN_STORAGE_KEY, String(open))
  } catch {
    void 0
  }
}

function readStoredWorkspacePanelWidth(kind: WorkspacePanelKind): number {
  const storageKey = kind === 'left' ? LEFT_PANEL_WIDTH_STORAGE_KEY : RIGHT_PANEL_WIDTH_STORAGE_KEY
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return getDefaultWorkspacePanelWidth(kind, viewportWidth)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return getDefaultWorkspacePanelWidth(kind, viewportWidth)
    return clampWorkspacePanelWidth(kind, parsed, viewportWidth)
  } catch {
    return getDefaultWorkspacePanelWidth(kind, viewportWidth)
  }
}

function persistWorkspacePanelWidth(kind: WorkspacePanelKind, width: number): void {
  const storageKey = kind === 'left' ? LEFT_PANEL_WIDTH_STORAGE_KEY : RIGHT_PANEL_WIDTH_STORAGE_KEY
  try {
    localStorage.setItem(storageKey, String(width))
  } catch {
    void 0
  }
}

function readStoredRightPanelTab(): RightPanelTab {
  try {
    const raw = localStorage.getItem(RIGHT_PANEL_TAB_STORAGE_KEY)
    if (raw && isRightPanelTab(raw)) return raw
  } catch {
    void 0
  }
  return 'ai'
}

function persistRightPanelTab(tab: RightPanelTab): void {
  try {
    localStorage.setItem(RIGHT_PANEL_TAB_STORAGE_KEY, tab)
  } catch {
    void 0
  }
}

function getViewportWidth(): number {
  return typeof window === 'undefined' ? 1440 : window.innerWidth
}

function getViewportHeight(): number {
  return typeof window === 'undefined' ? 900 : window.innerHeight
}

function readStoredWorkspaceLayoutPresetId(): WorkspaceLayoutPresetId {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_ACTIVE_PRESET_STORAGE_KEY)
    if (raw && isWorkspaceLayoutPresetId(raw)) return raw
  } catch {
    void 0
  }
  return 'default'
}

function persistWorkspaceLayoutPresetId(presetId: WorkspaceLayoutPresetId): void {
  try {
    localStorage.setItem(WORKSPACE_LAYOUT_ACTIVE_PRESET_STORAGE_KEY, presetId)
  } catch {
    void 0
  }
}

function readStoredWorkspaceLayoutSnapshot(): WorkspaceLayoutSnapshot | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_CURRENT_SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WorkspaceLayoutSnapshot>
    return sanitizeWorkspaceLayoutSnapshot(parsed)
  } catch {
    return null
  }
}

function readStoredClassicWorkspaceLayoutSnapshot(): WorkspaceLayoutSnapshot | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_CLASSIC_SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WorkspaceLayoutSnapshot>
    return sanitizeWorkspaceLayoutSnapshot(parsed)
  } catch {
    return null
  }
}

function persistClassicWorkspaceLayoutSnapshot(snapshot: WorkspaceLayoutSnapshot): void {
  try {
    localStorage.setItem(
      WORKSPACE_LAYOUT_CLASSIC_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(sanitizeWorkspaceLayoutSnapshot(snapshot))
    )
  } catch {
    void 0
  }
}

function persistWorkspaceLayoutSnapshot(snapshot: WorkspaceLayoutSnapshot): void {
  try {
    localStorage.setItem(
      WORKSPACE_LAYOUT_CURRENT_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(sanitizeWorkspaceLayoutSnapshot(snapshot))
    )
  } catch {
    void 0
  }
}

function createCurrentWorkspaceLayoutSnapshot(input: {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  bottomPanelOpen: boolean
  sizes: WorkspaceLayoutPanelSizes
}): WorkspaceLayoutSnapshot {
  return sanitizeWorkspaceLayoutSnapshot(input)
}

function readStoredCustomWorkspaceLayoutPresets(): WorkspaceLayoutPresetDefinition[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_CUSTOM_PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): WorkspaceLayoutPresetDefinition | null => {
        if (!item || typeof item !== 'object') return null
        const id = typeof item.id === 'string' && item.id.startsWith('custom:') ? item.id : null
        const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim().slice(0, 24) : null
        if (!id || !label) return null
        return {
          id: id as `custom:${string}`,
          label,
          description: '自定义工作区布局',
          builtin: false,
          snapshot: sanitizeWorkspaceLayoutSnapshot((item as { snapshot?: Partial<WorkspaceLayoutSnapshot> }).snapshot)
        }
      })
      .filter((item): item is WorkspaceLayoutPresetDefinition => Boolean(item))
      .slice(0, 12)
  } catch {
    return []
  }
}

function persistCustomWorkspaceLayoutPresets(presets: WorkspaceLayoutPresetDefinition[]): void {
  try {
    localStorage.setItem(WORKSPACE_LAYOUT_CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets.slice(0, 12)))
  } catch {
    void 0
  }
}

function readStoredWorkspaceLayoutMigrated(): boolean {
  try {
    return localStorage.getItem(WORKSPACE_LAYOUT_MIGRATED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persistWorkspaceLayoutMigrated(): void {
  try {
    localStorage.setItem(WORKSPACE_LAYOUT_MIGRATED_STORAGE_KEY, 'true')
  } catch {
    void 0
  }
}

const initialWorkspaceLayoutMigrated = readStoredWorkspaceLayoutMigrated()
const initialClassicWorkspaceLayoutSnapshot =
  readStoredClassicWorkspaceLayoutSnapshot() ??
  createClassicWorkspaceLayoutSnapshot({
    leftPanelWidth: readStoredWorkspacePanelWidth('left'),
    rightPanelWidth: readStoredWorkspacePanelWidth('right'),
    bottomPanelHeight: readStoredBottomPanelHeight(),
    bottomPanelOpen: readStoredBottomPanelOpen(),
    viewportWidth: getViewportWidth(),
    viewportHeight: getViewportHeight()
  })
if (!initialWorkspaceLayoutMigrated) {
  persistClassicWorkspaceLayoutSnapshot(initialClassicWorkspaceLayoutSnapshot)
}
const initialWorkspaceLayoutSnapshot =
  readStoredWorkspaceLayoutSnapshot() ??
  (initialWorkspaceLayoutMigrated
    ? initialClassicWorkspaceLayoutSnapshot
    : {
        ...resolveWorkspaceLayoutPresetSnapshot('default'),
        bottomPanelOpen: readStoredBottomPanelOpen()
      })

let workspaceLayoutPersistTimer: ReturnType<typeof setTimeout> | null = null

function writeWorkspaceLayoutState(presetId: WorkspaceLayoutPresetId, snapshot: WorkspaceLayoutSnapshot): void {
  const next = sanitizeWorkspaceLayoutSnapshot(snapshot)
  persistWorkspaceLayoutPresetId(presetId)
  persistWorkspaceLayoutSnapshot(next)
  persistBottomPanelOpen(next.bottomPanelOpen)
  persistWorkspacePanelWidth('left', workspacePanelPercentToWidth('left', next.sizes.left, getViewportWidth()))
  persistWorkspacePanelWidth('right', workspacePanelPercentToWidth('right', next.sizes.right, getViewportWidth()))
  try {
    localStorage.setItem(
      BOTTOM_PANEL_HEIGHT_STORAGE_KEY,
      String(terminalPercentToHeight(next.sizes.terminal, getViewportHeight()))
    )
  } catch {
    void 0
  }
}

function persistWorkspaceLayoutState(
  presetId: WorkspaceLayoutPresetId,
  snapshot: WorkspaceLayoutSnapshot,
  options: { defer?: boolean } = {}
): void {
  if (workspaceLayoutPersistTimer) {
    clearTimeout(workspaceLayoutPersistTimer)
    workspaceLayoutPersistTimer = null
  }
  if (!options.defer) {
    writeWorkspaceLayoutState(presetId, snapshot)
    return
  }
  workspaceLayoutPersistTimer = setTimeout(() => {
    workspaceLayoutPersistTimer = null
    writeWorkspaceLayoutState(presetId, snapshot)
  }, 160)
}

function readStoredTopbarToolsCollapsed(): boolean {
  try {
    return localStorage.getItem(TOPBAR_TOOLS_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persistTopbarToolsCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(TOPBAR_TOOLS_COLLAPSED_STORAGE_KEY, String(collapsed))
  } catch {
    void 0
  }
}

function readStoredAiAssistantPanelRect(): AiAssistantPanelRect {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16, width: 420, height: 680 }
  }

  try {
    const raw = localStorage.getItem(AI_ASSISTANT_PANEL_RECT_STORAGE_KEY)
    if (!raw) return createDefaultAiAssistantPanelRect(window.innerWidth, window.innerHeight)
    const parsed = JSON.parse(raw) as Partial<AiAssistantPanelRect>
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return createDefaultAiAssistantPanelRect(window.innerWidth, window.innerHeight)
    }
    return clampAiAssistantPanelRect(parsed as AiAssistantPanelRect, window.innerWidth, window.innerHeight)
  } catch {
    return createDefaultAiAssistantPanelRect(window.innerWidth, window.innerHeight)
  }
}

let aiAssistantPanelRectPersistTimer: ReturnType<typeof setTimeout> | null = null
let aiAssistantLauncherPositionPersistTimer: ReturnType<typeof setTimeout> | null = null

function persistAiAssistantPanelRect(rect: AiAssistantPanelRect, options: { defer?: boolean } = {}): void {
  if (typeof window === 'undefined') return
  if (aiAssistantPanelRectPersistTimer) {
    clearTimeout(aiAssistantPanelRectPersistTimer)
    aiAssistantPanelRectPersistTimer = null
  }
  if (options.defer) {
    aiAssistantPanelRectPersistTimer = setTimeout(() => {
      aiAssistantPanelRectPersistTimer = null
      persistAiAssistantPanelRect(rect)
    }, 160)
    return
  }
  try {
    localStorage.setItem(AI_ASSISTANT_PANEL_RECT_STORAGE_KEY, JSON.stringify(rect))
  } catch {
    void 0
  }
}

function readStoredAiAssistantLauncherPosition(): AiAssistantLauncherPosition {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16 }
  }

  try {
    const raw = localStorage.getItem(AI_ASSISTANT_LAUNCHER_POSITION_STORAGE_KEY)
    if (!raw) return createDefaultAiAssistantLauncherPosition(window.innerWidth, window.innerHeight)
    const parsed = JSON.parse(raw) as Partial<AiAssistantLauncherPosition>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return createDefaultAiAssistantLauncherPosition(window.innerWidth, window.innerHeight)
    }
    return clampAiAssistantLauncherPosition(
      parsed as AiAssistantLauncherPosition,
      window.innerWidth,
      window.innerHeight
    )
  } catch {
    return createDefaultAiAssistantLauncherPosition(window.innerWidth, window.innerHeight)
  }
}

function persistAiAssistantLauncherPosition(
  position: AiAssistantLauncherPosition,
  options: { defer?: boolean } = {}
): void {
  if (typeof window === 'undefined') return
  if (aiAssistantLauncherPositionPersistTimer) {
    clearTimeout(aiAssistantLauncherPositionPersistTimer)
    aiAssistantLauncherPositionPersistTimer = null
  }
  if (options.defer) {
    aiAssistantLauncherPositionPersistTimer = setTimeout(() => {
      aiAssistantLauncherPositionPersistTimer = null
      persistAiAssistantLauncherPosition(position)
    }, 160)
    return
  }
  try {
    localStorage.setItem(AI_ASSISTANT_LAUNCHER_POSITION_STORAGE_KEY, JSON.stringify(position))
  } catch {
    void 0
  }
}

if (typeof document !== 'undefined') {
  applyThemeToDocument(initialTheme)
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemThemeChange = () => {
    if (readStoredTheme() === 'system') applyThemeToDocument('system')
  }
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onSystemThemeChange)
  } else if (typeof media.addListener === 'function') {
    media.addListener(onSystemThemeChange)
  }
}

type TypewriterPosition = 'center' | 'upper' | 'lower'

type AiAssistantOpenOptions = {
  input?: string
  autoSend?: boolean
  surface?: AssistantSurface
}

export type InlineAiDraft = {
  id: number
  title: string
  payload: Record<string, unknown>
  chapterId: number
  conversationId: number | null
  retryInput: string
}

export type AiChapterDraft = {
  id: number
  title: string
  content: string
  summary: string
  volumeId: number | null
  volumeTitle: string
  conversationId: number | null
  retryInput: string
}

type AiAssistantCommand = {
  id: number
  input: string
  autoSend: boolean
  surface?: AssistantSurface
}

interface ModalEntry {
  type: ModalType
  data: Record<string, unknown> | null
}

interface UIStore {
  leftPanelOpen: boolean
  leftPanelWidth: number
  rightPanelOpen: boolean
  rightPanelWidth: number
  rightPanelTab: RightPanelTab
  bottomPanelOpen: boolean
  bottomPanelHeight: number
  workspaceLayoutPresetId: WorkspaceLayoutPresetId
  workspaceLayoutPanelSizes: WorkspaceLayoutPanelSizes
  customWorkspaceLayoutPresets: WorkspaceLayoutPresetDefinition[]
  workspaceLayoutMigrated: boolean
  topbarToolsCollapsed: boolean
  blackRoomMode: boolean
  blackRoomTextColor: 'green' | 'white'

  focusMode: boolean
  typewriterPosition: TypewriterPosition
  smartTypewriter: boolean

  splitView: boolean
  splitChapterId: number | null

  aiAssistantOpen: boolean
  aiAssistantPanelRect: AiAssistantPanelRect
  aiAssistantLauncherPosition: AiAssistantLauncherPosition
  aiAssistantSelectionText: string
  aiAssistantSelectionChapterId: number | null
  aiAssistantSelectionFrom: number | null
  aiAssistantSelectionTo: number | null
  aiAssistantCommand: AiAssistantCommand | null
  inlineAiDraft: InlineAiDraft | null
  aiChapterDraft: AiChapterDraft | null
  chapterSaveStatus: ChapterSaveStatus

  activeModal: ModalType
  modalData: Record<string, unknown> | null
  modalStack: ModalEntry[]

  toggleLeftPanel: () => void
  setLeftPanelWidth: (width: number) => void
  toggleRightPanel: () => void
  setRightPanelWidth: (width: number) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setBottomPanelOpen: (open: boolean) => void
  toggleBottomPanel: () => void
  setBottomPanelHeight: (height: number) => void
  resetBottomPanelHeight: () => void
  setWorkspaceLayoutPanelSizes: (sizes: Partial<WorkspaceLayoutPanelSizes>) => void
  applyWorkspaceLayoutPreset: (presetId: WorkspaceLayoutPresetId) => void
  saveCurrentWorkspaceLayoutPreset: (name: string) => WorkspaceLayoutPresetDefinition | null
  deleteCustomWorkspaceLayoutPreset: (presetId: WorkspaceLayoutPresetId) => void
  markWorkspaceLayoutMigrated: () => void
  setTopbarToolsCollapsed: (collapsed: boolean) => void
  toggleTopbarToolsCollapsed: () => void
  setBlackRoomMode: (flag: boolean) => void
  toggleBlackRoomTextColor: () => void

  toggleFocusMode: () => void
  setTypewriterPosition: (pos: TypewriterPosition) => void
  toggleSmartTypewriter: () => void

  toggleSplitView: () => void
  setSplitChapterId: (id: number | null) => void

  openAiAssistant: (options?: AiAssistantOpenOptions | string | null) => void
  closeAiAssistant: () => void
  consumeAiAssistantCommand: (id: number) => void
  setAiAssistantPanelRect: (rect: AiAssistantPanelRect) => void
  setAiAssistantLauncherPosition: (position: AiAssistantLauncherPosition) => void
  setAiAssistantSelection: (data: {
    text: string
    chapterId: number | null
    from: number | null
    to: number | null
  }) => void
  setInlineAiDraft: (draft: InlineAiDraft | null) => void
  clearInlineAiDraft: (draftId?: number | null) => void
  setAiChapterDraft: (draft: AiChapterDraft | null) => void
  updateAiChapterDraft: (
    updates: Partial<Pick<AiChapterDraft, 'title' | 'content' | 'summary' | 'volumeId' | 'volumeTitle'>>
  ) => void
  clearAiChapterDraft: (draftId?: number | null) => void
  setChapterSaveStatus: (status: ChapterSaveStatus) => void
  markChapterDirty: (chapterId: number) => void
  markChapterSaving: (chapterId: number) => void
  markChapterSaved: (chapterId: number, savedAt?: string) => void
  markChapterSaveError: (chapterId: number, error: string) => void

  theme: ThemeId
  setTheme: (theme: string) => void

  openModal: (type: ModalType, data?: Record<string, unknown> | null) => void
  closeModal: () => void
  pushModal: (type: ModalType, data?: Record<string, unknown> | null) => void

  onboardingTourSignal: number
  triggerOnboardingTour: () => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  leftPanelOpen: initialWorkspaceLayoutSnapshot.leftPanelOpen,
  leftPanelWidth: readStoredWorkspacePanelWidth('left'),
  rightPanelOpen: initialWorkspaceLayoutSnapshot.rightPanelOpen,
  rightPanelWidth: readStoredWorkspacePanelWidth('right'),
  rightPanelTab: readStoredRightPanelTab(),
  bottomPanelOpen: initialWorkspaceLayoutSnapshot.bottomPanelOpen,
  bottomPanelHeight: readStoredBottomPanelHeight(),
  workspaceLayoutPresetId: readStoredWorkspaceLayoutPresetId(),
  workspaceLayoutPanelSizes: initialWorkspaceLayoutSnapshot.sizes,
  customWorkspaceLayoutPresets: readStoredCustomWorkspaceLayoutPresets(),
  workspaceLayoutMigrated: initialWorkspaceLayoutMigrated,
  topbarToolsCollapsed: readStoredTopbarToolsCollapsed(),
  blackRoomMode: false,
  blackRoomTextColor: 'green',

  focusMode: false,
  typewriterPosition: 'center',
  smartTypewriter: true,

  splitView: false,
  splitChapterId: null,

  aiAssistantOpen: false,
  aiAssistantPanelRect: readStoredAiAssistantPanelRect(),
  aiAssistantLauncherPosition: readStoredAiAssistantLauncherPosition(),
  aiAssistantSelectionText: '',
  aiAssistantSelectionChapterId: null,
  aiAssistantSelectionFrom: null,
  aiAssistantSelectionTo: null,
  aiAssistantCommand: null,
  inlineAiDraft: null,
  aiChapterDraft: null,
  chapterSaveStatus: createInitialSaveStatus(),

  activeModal: null,
  modalData: null,
  modalStack: [],

  onboardingTourSignal: 0,
  triggerOnboardingTour: () => set((s) => ({ onboardingTourSignal: s.onboardingTourSignal + 1 })),

  toggleLeftPanel: () =>
    set((s) => {
      const nextSnapshot = createCurrentWorkspaceLayoutSnapshot({
        leftPanelOpen: !s.leftPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
        bottomPanelOpen: s.bottomPanelOpen,
        sizes: s.workspaceLayoutPanelSizes
      })
      persistWorkspaceLayoutState('custom', nextSnapshot)
      return { leftPanelOpen: nextSnapshot.leftPanelOpen, workspaceLayoutPresetId: 'custom' }
    }),
  setLeftPanelWidth: (width) => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
    const next = clampWorkspacePanelWidth('left', width, viewportWidth)
    persistWorkspacePanelWidth('left', next)
    set({ leftPanelWidth: next })
  },
  toggleRightPanel: () =>
    set((s) => {
      const nextSnapshot = createCurrentWorkspaceLayoutSnapshot({
        leftPanelOpen: s.leftPanelOpen,
        rightPanelOpen: !s.rightPanelOpen,
        bottomPanelOpen: s.bottomPanelOpen,
        sizes: s.workspaceLayoutPanelSizes
      })
      persistWorkspaceLayoutState('custom', nextSnapshot)
      return { rightPanelOpen: nextSnapshot.rightPanelOpen, workspaceLayoutPresetId: 'custom' }
    }),
  setRightPanelWidth: (width) => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
    const next = clampWorkspacePanelWidth('right', width, viewportWidth)
    persistWorkspacePanelWidth('right', next)
    set({ rightPanelWidth: next })
  },
  setRightPanelTab: (tab) => {
    persistRightPanelTab(tab)
    set((s) => ({
      rightPanelTab: tab,
      aiAssistantOpen: tab === 'ai' ? true : s.aiAssistantOpen
    }))
  },
  setBottomPanelOpen: (open) => {
    set((s) => {
      const nextSnapshot = createCurrentWorkspaceLayoutSnapshot({
        leftPanelOpen: s.leftPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
        bottomPanelOpen: open,
        sizes: s.workspaceLayoutPanelSizes
      })
      persistWorkspaceLayoutState('custom', nextSnapshot)
      return { bottomPanelOpen: nextSnapshot.bottomPanelOpen, workspaceLayoutPresetId: 'custom' }
    })
  },
  toggleBottomPanel: () =>
    set((s) => {
      const nextSnapshot = createCurrentWorkspaceLayoutSnapshot({
        leftPanelOpen: s.leftPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
        bottomPanelOpen: !s.bottomPanelOpen,
        sizes: s.workspaceLayoutPanelSizes
      })
      persistWorkspaceLayoutState('custom', nextSnapshot)
      return { bottomPanelOpen: nextSnapshot.bottomPanelOpen, workspaceLayoutPresetId: 'custom' }
    }),
  setBottomPanelHeight: (height) => {
    const next = clampBottomPanelHeight(height)
    try {
      localStorage.setItem(BOTTOM_PANEL_HEIGHT_STORAGE_KEY, String(next))
    } catch {
      void 0
    }
    set({ bottomPanelHeight: next })
  },
  resetBottomPanelHeight: () => {
    const next = 320
    try {
      localStorage.setItem(BOTTOM_PANEL_HEIGHT_STORAGE_KEY, String(next))
    } catch {
      void 0
    }
    set({ bottomPanelHeight: next })
  },
  setWorkspaceLayoutPanelSizes: (sizes) => {
    set((s) => {
      const nextSizes = clampWorkspaceLayoutPanelSizes({ ...s.workspaceLayoutPanelSizes, ...sizes })
      const nextSnapshot = createCurrentWorkspaceLayoutSnapshot({
        leftPanelOpen: s.leftPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
        bottomPanelOpen: s.bottomPanelOpen,
        sizes: nextSizes
      })
      persistWorkspaceLayoutState(s.workspaceLayoutPresetId, nextSnapshot, { defer: true })
      return {
        workspaceLayoutPanelSizes: nextSizes,
        leftPanelWidth: workspacePanelPercentToWidth('left', nextSizes.left, getViewportWidth()),
        rightPanelWidth: workspacePanelPercentToWidth('right', nextSizes.right, getViewportWidth()),
        bottomPanelHeight: terminalPercentToHeight(nextSizes.terminal, getViewportHeight())
      }
    })
  },
  applyWorkspaceLayoutPreset: (presetId) => {
    const customPresets = get().customWorkspaceLayoutPresets
    const classicSnapshot =
      readStoredClassicWorkspaceLayoutSnapshot() ??
      createClassicWorkspaceLayoutSnapshot({
        leftPanelWidth: readStoredWorkspacePanelWidth('left'),
        rightPanelWidth: readStoredWorkspacePanelWidth('right'),
        bottomPanelHeight: readStoredBottomPanelHeight(),
        bottomPanelOpen: readStoredBottomPanelOpen(),
        viewportWidth: getViewportWidth(),
        viewportHeight: getViewportHeight()
      })
    const snapshot = resolveWorkspaceLayoutPresetSnapshot(presetId, customPresets, classicSnapshot)
    persistWorkspaceLayoutState(presetId, snapshot)
    set({
      workspaceLayoutPresetId: presetId,
      workspaceLayoutPanelSizes: snapshot.sizes,
      leftPanelOpen: snapshot.leftPanelOpen,
      rightPanelOpen: snapshot.rightPanelOpen,
      bottomPanelOpen: snapshot.bottomPanelOpen,
      leftPanelWidth: workspacePanelPercentToWidth('left', snapshot.sizes.left, getViewportWidth()),
      rightPanelWidth: workspacePanelPercentToWidth('right', snapshot.sizes.right, getViewportWidth()),
      bottomPanelHeight: terminalPercentToHeight(snapshot.sizes.terminal, getViewportHeight())
    })
  },
  saveCurrentWorkspaceLayoutPreset: (name) => {
    const trimmed = name.trim().slice(0, 24)
    if (!trimmed) return null
    const state = get()
    const preset: WorkspaceLayoutPresetDefinition = {
      id: `custom:${Date.now().toString(36)}`,
      label: trimmed,
      description: '自定义工作区布局',
      builtin: false,
      snapshot: createCurrentWorkspaceLayoutSnapshot({
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        sizes: state.workspaceLayoutPanelSizes
      })
    }
    const nextPresets = [
      preset,
      ...state.customWorkspaceLayoutPresets.filter((item) => item.label !== preset.label)
    ].slice(0, 12)
    persistCustomWorkspaceLayoutPresets(nextPresets)
    persistWorkspaceLayoutState(preset.id, preset.snapshot)
    set({
      customWorkspaceLayoutPresets: nextPresets,
      workspaceLayoutPresetId: preset.id
    })
    return preset
  },
  deleteCustomWorkspaceLayoutPreset: (presetId) => {
    set((s) => {
      const nextPresets = s.customWorkspaceLayoutPresets.filter((item) => item.id !== presetId)
      persistCustomWorkspaceLayoutPresets(nextPresets)
      const nextPresetId = s.workspaceLayoutPresetId === presetId ? 'custom' : s.workspaceLayoutPresetId
      persistWorkspaceLayoutPresetId(nextPresetId)
      return {
        customWorkspaceLayoutPresets: nextPresets,
        workspaceLayoutPresetId: nextPresetId
      }
    })
  },
  markWorkspaceLayoutMigrated: () => {
    persistWorkspaceLayoutMigrated()
    set({ workspaceLayoutMigrated: true })
  },
  setTopbarToolsCollapsed: (collapsed) => {
    persistTopbarToolsCollapsed(collapsed)
    set({ topbarToolsCollapsed: collapsed })
  },
  toggleTopbarToolsCollapsed: () =>
    set((s) => {
      const next = !s.topbarToolsCollapsed
      persistTopbarToolsCollapsed(next)
      return { topbarToolsCollapsed: next }
    }),
  setBlackRoomMode: (flag) => set({ blackRoomMode: flag }),
  toggleBlackRoomTextColor: () =>
    set((s) => ({ blackRoomTextColor: s.blackRoomTextColor === 'green' ? 'white' : 'green' })),

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setTypewriterPosition: (pos) => set({ typewriterPosition: pos }),
  toggleSmartTypewriter: () => set((s) => ({ smartTypewriter: !s.smartTypewriter })),

  toggleSplitView: () => set((s) => ({ splitView: !s.splitView })),
  setSplitChapterId: (id) => set({ splitChapterId: id }),

  openAiAssistant: (options = null) =>
    set((s) => {
      const input = typeof options === 'object' && options ? options.input?.trim() || '' : ''
      persistRightPanelTab('ai')
      persistWorkspaceLayoutState(
        'custom',
        createCurrentWorkspaceLayoutSnapshot({
          leftPanelOpen: s.leftPanelOpen,
          rightPanelOpen: true,
          bottomPanelOpen: s.bottomPanelOpen,
          sizes: s.workspaceLayoutPanelSizes
        })
      )
      return {
        workspaceLayoutPresetId: 'custom',
        rightPanelOpen: true,
        rightPanelTab: 'ai',
        aiAssistantOpen: true,
        aiAssistantCommand: input
          ? {
              id: Date.now(),
              input,
              autoSend: Boolean(typeof options === 'object' && options?.autoSend),
              surface: typeof options === 'object' ? options?.surface : undefined
            }
          : typeof options === 'object' && options?.surface
            ? {
                id: Date.now(),
                input: '',
                autoSend: false,
                surface: options.surface
              }
            : null
      }
    }),
  closeAiAssistant: () =>
    set((s) => {
      persistWorkspaceLayoutState(
        'custom',
        createCurrentWorkspaceLayoutSnapshot({
          leftPanelOpen: s.leftPanelOpen,
          rightPanelOpen: false,
          bottomPanelOpen: s.bottomPanelOpen,
          sizes: s.workspaceLayoutPanelSizes
        })
      )
      return { aiAssistantOpen: false, rightPanelOpen: false, workspaceLayoutPresetId: 'custom' }
    }),
  consumeAiAssistantCommand: (id) =>
    set((s) => ({
      aiAssistantCommand: s.aiAssistantCommand?.id === id ? null : s.aiAssistantCommand
    })),
  setAiAssistantPanelRect: (rect) => {
    const next =
      typeof window === 'undefined' ? rect : clampAiAssistantPanelRect(rect, window.innerWidth, window.innerHeight)
    persistAiAssistantPanelRect(next, { defer: true })
    set({ aiAssistantPanelRect: next })
  },
  setAiAssistantLauncherPosition: (position) => {
    const next =
      typeof window === 'undefined'
        ? position
        : clampAiAssistantLauncherPosition(position, window.innerWidth, window.innerHeight)
    persistAiAssistantLauncherPosition(next, { defer: true })
    set({ aiAssistantLauncherPosition: next })
  },
  setAiAssistantSelection: ({ text, chapterId, from, to }) =>
    set({
      aiAssistantSelectionText: text,
      aiAssistantSelectionChapterId: chapterId,
      aiAssistantSelectionFrom: from,
      aiAssistantSelectionTo: to
    }),
  setInlineAiDraft: (draft) => set({ inlineAiDraft: draft }),
  clearInlineAiDraft: (draftId = null) =>
    set((s) => {
      if (draftId != null && s.inlineAiDraft?.id !== draftId) return {}
      return { inlineAiDraft: null }
    }),
  setAiChapterDraft: (draft) => set({ aiChapterDraft: draft }),
  updateAiChapterDraft: (updates) =>
    set((s) => (s.aiChapterDraft ? { aiChapterDraft: { ...s.aiChapterDraft, ...updates } } : {})),
  clearAiChapterDraft: (draftId = null) =>
    set((s) => {
      if (draftId != null && s.aiChapterDraft?.id !== draftId) return {}
      return { aiChapterDraft: null }
    }),
  setChapterSaveStatus: (status) => set({ chapterSaveStatus: status }),
  markChapterDirty: (chapterId) =>
    set((s) =>
      s.chapterSaveStatus.kind === 'dirty' && s.chapterSaveStatus.chapterId === chapterId
        ? s
        : {
          chapterSaveStatus: {
            kind: 'dirty',
            chapterId,
            savedAt: null,
            error: null
          }
        }
    ),
  markChapterSaving: (chapterId) =>
    set((s) =>
      s.chapterSaveStatus.kind === 'saving' && s.chapterSaveStatus.chapterId === chapterId
        ? s
        : {
          chapterSaveStatus: {
            kind: 'saving',
            chapterId,
            savedAt: null,
            error: null
          }
        }
    ),
  markChapterSaved: (chapterId, savedAt = new Date().toISOString()) =>
    set((s) =>
      s.chapterSaveStatus.kind === 'saved' && s.chapterSaveStatus.chapterId === chapterId
        ? s
        : {
          chapterSaveStatus: {
            kind: 'saved',
            chapterId,
            savedAt,
            error: null
          }
        }
    ),
  markChapterSaveError: (chapterId, error) =>
    set((s) =>
      s.chapterSaveStatus.kind === 'error' &&
      s.chapterSaveStatus.chapterId === chapterId &&
      s.chapterSaveStatus.error === error
        ? s
        : {
          chapterSaveStatus: {
            kind: 'error',
            chapterId,
            savedAt: null,
            error
          }
        }
    ),

  theme: initialTheme,
  setTheme: (theme) => {
    const next = isThemeId(theme) ? theme : 'system'
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      void 0
    }
    applyThemeToDocument(next)
    set({ theme: next })
  },

  openModal: (type, data = null) => set({ activeModal: type, modalData: data, modalStack: [] }),

  pushModal: (type, data = null) => {
    const { activeModal, modalData, modalStack } = get()
    if (activeModal) {
      set({
        modalStack: [...modalStack, { type: activeModal, data: modalData }],
        activeModal: type,
        modalData: data
      })
    } else {
      set({ activeModal: type, modalData: data })
    }
  },

  closeModal: () => {
    const { modalStack } = get()
    if (modalStack.length > 0) {
      const prev = modalStack[modalStack.length - 1]
      set({
        activeModal: prev.type,
        modalData: prev.data,
        modalStack: modalStack.slice(0, -1)
      })
    } else {
      set({ activeModal: null, modalData: null })
    }
  }
}))

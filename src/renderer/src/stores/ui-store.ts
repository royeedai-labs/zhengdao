import { create } from 'zustand'
import type { ModalType } from '@/types'
import { isThemeId, resolveThemeMode, type ThemeId } from '@/utils/themes'
import {
  clampWorkspacePanelWidth,
  getDefaultWorkspacePanelWidth,
  isRightPanelTab,
  type RightPanelTab,
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

const THEME_STORAGE_KEY = 'write-ui-theme'
const BOTTOM_PANEL_HEIGHT_STORAGE_KEY = 'write-bottom-panel-height'
const LEFT_PANEL_WIDTH_STORAGE_KEY = 'write-left-panel-width'
const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'write-right-panel-width'
const RIGHT_PANEL_TAB_STORAGE_KEY = 'write-right-panel-tab'
const TOPBAR_TOOLS_COLLAPSED_STORAGE_KEY = 'write-topbar-tools-collapsed'
const AI_ASSISTANT_PANEL_RECT_STORAGE_KEY = 'write-ai-assistant-panel-rect'
const AI_ASSISTANT_LAUNCHER_POSITION_STORAGE_KEY = 'write-ai-assistant-launcher-position'

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
  return 'foreshadow'
}

function persistRightPanelTab(tab: RightPanelTab): void {
  try {
    localStorage.setItem(RIGHT_PANEL_TAB_STORAGE_KEY, tab)
  } catch {
    void 0
  }
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

function persistAiAssistantPanelRect(rect: AiAssistantPanelRect): void {
  if (typeof window === 'undefined') return
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
    return clampAiAssistantLauncherPosition(parsed as AiAssistantLauncherPosition, window.innerWidth, window.innerHeight)
  } catch {
    return createDefaultAiAssistantLauncherPosition(window.innerWidth, window.innerHeight)
  }
}

function persistAiAssistantLauncherPosition(position: AiAssistantLauncherPosition): void {
  if (typeof window === 'undefined') return
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
  topbarToolsCollapsed: boolean
  blackRoomMode: boolean
  blackRoomTextColor: 'green' | 'white'

  focusMode: boolean
  typewriterPosition: TypewriterPosition
  smartTypewriter: boolean

  splitView: boolean
  splitChapterId: number | null

  aiAssistantOpen: boolean
  aiAssistantSkillKey: string | null
  aiAssistantPanelRect: AiAssistantPanelRect
  aiAssistantLauncherPosition: AiAssistantLauncherPosition
  aiAssistantSelectionText: string
  aiAssistantSelectionChapterId: number | null
  aiAssistantSelectionFrom: number | null
  aiAssistantSelectionTo: number | null

  activeModal: ModalType
  modalData: Record<string, unknown> | null
  modalStack: ModalEntry[]

  toggleLeftPanel: () => void
  setLeftPanelWidth: (width: number) => void
  toggleRightPanel: () => void
  setRightPanelWidth: (width: number) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  toggleBottomPanel: () => void
  setBottomPanelHeight: (height: number) => void
  resetBottomPanelHeight: () => void
  setTopbarToolsCollapsed: (collapsed: boolean) => void
  toggleTopbarToolsCollapsed: () => void
  setBlackRoomMode: (flag: boolean) => void
  toggleBlackRoomTextColor: () => void

  toggleFocusMode: () => void
  setTypewriterPosition: (pos: TypewriterPosition) => void
  toggleSmartTypewriter: () => void

  toggleSplitView: () => void
  setSplitChapterId: (id: number | null) => void

  openAiAssistant: (skillKey?: string | null) => void
  closeAiAssistant: () => void
  setAiAssistantSkillKey: (skillKey: string | null) => void
  setAiAssistantPanelRect: (rect: AiAssistantPanelRect) => void
  setAiAssistantLauncherPosition: (position: AiAssistantLauncherPosition) => void
  setAiAssistantSelection: (data: {
    text: string
    chapterId: number | null
    from: number | null
    to: number | null
  }) => void

  theme: ThemeId
  setTheme: (theme: string) => void

  openModal: (type: ModalType, data?: Record<string, unknown> | null) => void
  closeModal: () => void
  pushModal: (type: ModalType, data?: Record<string, unknown> | null) => void

  onboardingTourSignal: number
  triggerOnboardingTour: () => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  leftPanelOpen: true,
  leftPanelWidth: readStoredWorkspacePanelWidth('left'),
  rightPanelOpen: true,
  rightPanelWidth: readStoredWorkspacePanelWidth('right'),
  rightPanelTab: readStoredRightPanelTab(),
  bottomPanelOpen: false,
  bottomPanelHeight: readStoredBottomPanelHeight(),
  topbarToolsCollapsed: readStoredTopbarToolsCollapsed(),
  blackRoomMode: false,
  blackRoomTextColor: 'green',

  focusMode: false,
  typewriterPosition: 'center',
  smartTypewriter: true,

  splitView: false,
  splitChapterId: null,

  aiAssistantOpen: false,
  aiAssistantSkillKey: null,
  aiAssistantPanelRect: readStoredAiAssistantPanelRect(),
  aiAssistantLauncherPosition: readStoredAiAssistantLauncherPosition(),
  aiAssistantSelectionText: '',
  aiAssistantSelectionChapterId: null,
  aiAssistantSelectionFrom: null,
  aiAssistantSelectionTo: null,

  activeModal: null,
  modalData: null,
  modalStack: [],

  onboardingTourSignal: 0,
  triggerOnboardingTour: () =>
    set((s) => ({ onboardingTourSignal: s.onboardingTourSignal + 1 })),

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setLeftPanelWidth: (width) => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
    const next = clampWorkspacePanelWidth('left', width, viewportWidth)
    persistWorkspacePanelWidth('left', next)
    set({ leftPanelWidth: next })
  },
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelWidth: (width) => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
    const next = clampWorkspacePanelWidth('right', width, viewportWidth)
    persistWorkspacePanelWidth('right', next)
    set({ rightPanelWidth: next })
  },
  setRightPanelTab: (tab) => {
    persistRightPanelTab(tab)
    set({ rightPanelTab: tab })
  },
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
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

  openAiAssistant: (skillKey = null) =>
    set((state) => {
      const rect =
        typeof window === 'undefined'
          ? state.aiAssistantPanelRect
          : clampAiAssistantPanelRect(state.aiAssistantPanelRect, window.innerWidth, window.innerHeight)
      persistAiAssistantPanelRect(rect)
      return {
        aiAssistantOpen: true,
        aiAssistantSkillKey: skillKey,
        aiAssistantPanelRect: rect
      }
    }),
  closeAiAssistant: () => set({ aiAssistantOpen: false }),
  setAiAssistantSkillKey: (skillKey) => set({ aiAssistantSkillKey: skillKey }),
  setAiAssistantPanelRect: (rect) => {
    const next =
      typeof window === 'undefined'
        ? rect
        : clampAiAssistantPanelRect(rect, window.innerWidth, window.innerHeight)
    persistAiAssistantPanelRect(next)
    set({ aiAssistantPanelRect: next })
  },
  setAiAssistantLauncherPosition: (position) => {
    const next =
      typeof window === 'undefined'
        ? position
        : clampAiAssistantLauncherPosition(position, window.innerWidth, window.innerHeight)
    persistAiAssistantLauncherPosition(next)
    set({ aiAssistantLauncherPosition: next })
  },
  setAiAssistantSelection: ({ text, chapterId, from, to }) =>
    set({
      aiAssistantSelectionText: text,
      aiAssistantSelectionChapterId: chapterId,
      aiAssistantSelectionFrom: from,
      aiAssistantSelectionTo: to
    }),

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

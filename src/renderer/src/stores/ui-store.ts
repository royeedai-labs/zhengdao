import { create } from 'zustand'
import type { ModalType } from '@/types'
import { THEME_IDS } from '@/utils/themes'
import {
  clampAiAssistantPanelRect,
  createDefaultAiAssistantPanelRect,
  type AiAssistantPanelRect
} from '@/components/ai/panel-layout'

const THEME_STORAGE_KEY = 'write-ui-theme'
const BOTTOM_PANEL_HEIGHT_STORAGE_KEY = 'write-bottom-panel-height'
const AI_ASSISTANT_PANEL_RECT_STORAGE_KEY = 'write-ai-assistant-panel-rect'

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
    if (v && (THEME_IDS as readonly string[]).includes(v)) return v
  } catch {
    void 0
  }
  return 'dark'
}

const initialTheme = readStoredTheme()

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

if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = initialTheme
}

type TypewriterPosition = 'center' | 'upper' | 'lower'

interface ModalEntry {
  type: ModalType
  data: Record<string, unknown> | null
}

interface UIStore {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  bottomPanelOpen: boolean
  bottomPanelHeight: number
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
  aiAssistantSelectionText: string
  aiAssistantSelectionChapterId: number | null
  aiAssistantSelectionFrom: number | null
  aiAssistantSelectionTo: number | null

  activeModal: ModalType
  modalData: Record<string, unknown> | null
  modalStack: ModalEntry[]

  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleBottomPanel: () => void
  setBottomPanelHeight: (height: number) => void
  resetBottomPanelHeight: () => void
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
  setAiAssistantSelection: (data: {
    text: string
    chapterId: number | null
    from: number | null
    to: number | null
  }) => void

  theme: string
  setTheme: (theme: string) => void

  openModal: (type: ModalType, data?: Record<string, unknown> | null) => void
  closeModal: () => void
  pushModal: (type: ModalType, data?: Record<string, unknown> | null) => void

  onboardingTourSignal: number
  triggerOnboardingTour: () => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: false,
  bottomPanelHeight: readStoredBottomPanelHeight(),
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
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
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
  setAiAssistantSelection: ({ text, chapterId, from, to }) =>
    set({
      aiAssistantSelectionText: text,
      aiAssistantSelectionChapterId: chapterId,
      aiAssistantSelectionFrom: from,
      aiAssistantSelectionTo: to
    }),

  theme: initialTheme,
  setTheme: (theme) => {
    const next = (THEME_IDS as readonly string[]).includes(theme) ? theme : 'dark'
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      void 0
    }
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = next
    }
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

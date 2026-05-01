import { create } from 'zustand'

export interface ZhengdaoUser {
  id: string
  email: string
  role: 'user' | 'admin'
  tier: 'free' | 'pro' | 'team'
  pro: boolean
  pointsBalance: number
  emailVerified: boolean
  displayName?: string | null
}

interface AuthLoginResult {
  ok: boolean
  loginUrl?: string
  error?: string
}

const SYNC_TOGGLE_KEY = 'zhengdao_sync_enabled'

function hasOfficialSyncEntitlement(user: ZhengdaoUser | null): boolean {
  return Boolean(user && (user.pro || user.tier === 'pro' || user.tier === 'team'))
}

interface AuthStore {
  user: ZhengdaoUser | null
  loading: boolean
  syncing: boolean
  syncEnabled: boolean
  lastBookSyncAt: string | null

  loadUser: () => Promise<void>
  loadBookSyncMeta: (bookId: number | null) => Promise<void>
  login: () => Promise<AuthLoginResult>
  logout: () => Promise<void>
  syncUploadBook: (bookId: number) => Promise<void>
  syncAllBooks: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => Promise<void>
  applyAuthUpdate: (user: ZhengdaoUser | null) => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: false,
  syncing: false,
  syncEnabled: false,
  lastBookSyncAt: null,

  loadUser: async () => {
    set({ loading: true })
    try {
      const user = (await window.api.authGetUser()) as ZhengdaoUser | null
      const raw = await window.api.getAppState(SYNC_TOGGLE_KEY)
      const syncEnabled = raw === null ? hasOfficialSyncEntitlement(user) : raw === '1'
      set({ user, syncEnabled })
    } finally {
      set({ loading: false })
    }
  },

  loadBookSyncMeta: async (bookId) => {
    if (bookId == null) {
      set({ lastBookSyncAt: null })
      return
    }
    const raw = await window.api.getAppState(`sync_book_${bookId}`)
    if (!raw) {
      set({ lastBookSyncAt: null })
      return
    }
    try {
      const j = JSON.parse(raw) as { at?: string }
      set({ lastBookSyncAt: j.at ?? null })
    } catch {
      set({ lastBookSyncAt: null })
    }
  },

  login: async () => {
    set({ loading: true })
    try {
      const result = (await window.api.authLogin()) as AuthLoginResult
      if (!result.ok) return result
      return result
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    await window.api.authLogout()
    set({ user: null, lastBookSyncAt: null })
  },

  syncUploadBook: async (bookId: number) => {
    set({ syncing: true })
    try {
      await window.api.syncUploadBook(bookId)
      await get().loadBookSyncMeta(bookId)
    } finally {
      set({ syncing: false })
    }
  },

  syncAllBooks: async () => {
    set({ syncing: true })
    try {
      await window.api.syncAllBooks()
    } finally {
      set({ syncing: false })
    }
  },

  setSyncEnabled: async (enabled: boolean) => {
    await window.api.setAppState(SYNC_TOGGLE_KEY, enabled ? '1' : '0')
    set({ syncEnabled: enabled })
  },

  applyAuthUpdate: (user) => {
    set({ user })
  }
}))

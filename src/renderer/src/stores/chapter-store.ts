import { create } from 'zustand'
import type { Volume, Chapter } from '@/types'

interface ChapterStore {
  volumes: Volume[]
  currentChapter: Chapter | null
  loading: boolean
  loadVolumes: (bookId: number) => Promise<void>
  selectChapter: (id: number) => Promise<void>
  forceReloadCurrentChapter: () => Promise<void>
  createVolume: (bookId: number, title: string) => Promise<Volume>
  createChapter: (volumeId: number, title: string, content?: string, summary?: string) => Promise<Chapter>
  updateChapterContent: (id: number, content: string, wordCount: number) => Promise<void>
  updateChapterTitle: (id: number, title: string) => Promise<void>
  updateChapterSummary: (id: number, summary: string) => Promise<void>
  updateVolumeTitle: (id: number, title: string) => Promise<void>
  deleteVolume: (id: number) => Promise<void>
  deleteChapter: (id: number) => Promise<void>
  reorderChapters: (volumeId: number, chapterIds: number[]) => Promise<void>
  reorderVolumes: (bookId: number, volumeIds: number[]) => Promise<void>
  moveChapter: (chapterId: number, targetVolumeId: number) => Promise<void>
  getTotalWords: () => number
  getCurrentChapterNumber: () => number
}

export const useChapterStore = create<ChapterStore>((set, get) => ({
  volumes: [],
  currentChapter: null,
  loading: false,

  loadVolumes: async (bookId) => {
    set({ loading: true })
    try {
      const volumes = await window.api.getVolumesWithChapterMeta(bookId)
      set({ volumes })
    } finally {
      set({ loading: false })
    }
  },

  selectChapter: async (id) => {
    const chapter = await window.api.getChapter(id)
    set({ currentChapter: chapter ?? null })
  },

  forceReloadCurrentChapter: async () => {
    const cur = get().currentChapter
    if (!cur) return
    const chapter = await window.api.getChapter(cur.id)
    set({ currentChapter: null })
    await new Promise((r) => setTimeout(r, 0))
    set({ currentChapter: chapter ?? null })
  },

  createVolume: async (bookId, title) => {
    const vol = await window.api.createVolume({ book_id: bookId, title })
    await get().loadVolumes(bookId)
    return vol
  },

  createChapter: async (volumeId, title, content, summary) => {
    const ch = await window.api.createChapter({ volume_id: volumeId, title, content, summary })
    const { volumes } = get()
    const vol = volumes.find((v) => v.chapters?.some((c) => c.volume_id === volumeId) || v.id === volumeId)
    if (vol) {
      await get().loadVolumes(vol.book_id)
    }
    return ch
  },

  updateChapterContent: async (id, content, wordCount) => {
    await window.api.updateChapter(id, { content, word_count: wordCount })
    const { currentChapter: cur, volumes } = get()
    const updated_at = new Date().toISOString()
    if (cur && cur.id === id) {
      set({
        currentChapter: { ...cur, content, word_count: wordCount, updated_at },
        volumes: volumes.map((v) => ({
          ...v,
          chapters: v.chapters?.map((c) => (c.id === id ? { ...c, word_count: wordCount, updated_at } : c))
        }))
      })
      return
    }
    set({
      volumes: volumes.map((v) => ({
        ...v,
        chapters: v.chapters?.map((c) => (c.id === id ? { ...c, word_count: wordCount, updated_at } : c))
      }))
    })
  },

  updateChapterTitle: async (id, title) => {
    await window.api.updateChapterTitle(id, title)
    const { currentChapter, volumes } = get()
    if (currentChapter && currentChapter.id === id) {
      set({ currentChapter: { ...currentChapter, title } })
    }
    set({
      volumes: volumes.map((v) => ({
        ...v,
        chapters: v.chapters?.map((c) => (c.id === id ? { ...c, title } : c))
      }))
    })
  },

  updateChapterSummary: async (id, summary) => {
    await window.api.updateChapterSummary(id, summary)
    const { currentChapter, volumes } = get()
    if (currentChapter?.id === id) {
      set({ currentChapter: { ...currentChapter, summary } })
    }
    set({
      volumes: volumes.map((v) => ({
        ...v,
        chapters: v.chapters?.map((c) => (c.id === id ? { ...c, summary } : c))
      }))
    })
  },

  updateVolumeTitle: async (id, title) => {
    await window.api.updateVolume(id, title)
    set({ volumes: get().volumes.map((v) => (v.id === id ? { ...v, title } : v)) })
  },

  deleteVolume: async (id) => {
    const vol = get().volumes.find((v) => v.id === id)
    await window.api.deleteVolume(id)
    const cur = get().currentChapter
    if (cur && vol?.chapters?.some((c) => c.id === cur.id)) {
      set({ currentChapter: null })
    }
    if (vol) await get().loadVolumes(vol.book_id)
  },

  deleteChapter: async (id) => {
    const { volumes, currentChapter } = get()
    const vol = volumes.find((v) => v.chapters?.some((c) => c.id === id))
    await window.api.deleteChapter(id)
    if (currentChapter?.id === id) {
      set({ currentChapter: null })
    }
    if (vol) await get().loadVolumes(vol.book_id)
  },

  reorderChapters: async (volumeId, chapterIds) => {
    await window.api.reorderChapters(volumeId, chapterIds)
    const bookId = get().volumes.find((v) => v.id === volumeId)?.book_id
    if (bookId) await get().loadVolumes(bookId)
  },

  reorderVolumes: async (bookId, volumeIds) => {
    await window.api.reorderVolumes(bookId, volumeIds)
    await get().loadVolumes(bookId)
  },

  moveChapter: async (chapterId, targetVolumeId) => {
    await window.api.moveChapter(chapterId, targetVolumeId)
    const bookId =
      get().volumes.find((v) => v.id === targetVolumeId)?.book_id ??
      get().volumes.find((v) => v.chapters?.some((c) => c.id === chapterId))?.book_id
    if (bookId) await get().loadVolumes(bookId)
  },

  getTotalWords: () => {
    return get().volumes.reduce(
      (sum, v) => sum + (v.chapters?.reduce((s, c) => s + c.word_count, 0) || 0),
      0
    )
  },

  getCurrentChapterNumber: () => {
    const { volumes, currentChapter } = get()
    if (!currentChapter) return 0
    let num = 0
    for (const vol of volumes) {
      for (const ch of vol.chapters || []) {
        num++
        if (ch.id === currentChapter.id) return num
      }
    }
    return num
  }
}))

import { create } from 'zustand'
import type { Book } from '@/types'
import type { Genre } from '../../../shared/genre'

interface CreateBookOptions {
  productGenre?: Genre
  coverSourcePath?: string
}

interface BookStore {
  books: Book[]
  currentBookId: number | null
  loading: boolean
  loadBooks: () => Promise<void>
  openBook: (id: number) => void
  closeBook: () => void
  createBook: (title: string, author: string, options?: CreateBookOptions) => Promise<Book>
  deleteBook: (id: number) => Promise<void>
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  currentBookId: null,
  loading: false,

  loadBooks: async () => {
    set({ loading: true })
    try {
      const books = await window.api.getBooks()
      set({ books })
    } finally {
      set({ loading: false })
    }
  },

  openBook: (id) => {
    set({ currentBookId: id })
  },

  closeBook: () => {
    set({ currentBookId: null })
  },

  createBook: async (title, author, options = {}) => {
    const wasEmpty = get().books.length === 0
    try {
      const book = await window.api.createBook({ title, author, ...options })
      await get().loadBooks()
      if (wasEmpty) {
        try {
          sessionStorage.setItem('write_pending_onboarding', '1')
        } catch {
          void 0
        }
      }
      return book
    } catch (err) {
      console.error('[BookStore] createBook failed:', err)
      throw err
    }
  },

  deleteBook: async (id) => {
    try {
      await window.api.deleteBook(id)
      const { currentBookId } = get()
      if (currentBookId === id) {
        set({ currentBookId: null })
      }
      await get().loadBooks()
    } catch (err) {
      console.error('[BookStore] deleteBook failed:', err)
      throw err
    }
  }
}))

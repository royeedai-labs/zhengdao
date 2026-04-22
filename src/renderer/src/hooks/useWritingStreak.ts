import { useCallback, useEffect, useState } from 'react'
import { useBookStore } from '@/stores/book-store'

export function useWritingStreak() {
  const bookId = useBookStore((s) => s.currentBookId)
  const [streak, setStreak] = useState(0)

  const refresh = useCallback(async () => {
    if (!bookId) return
    const stats = (await window.api.getAchievementStats(bookId)) as { streak: number }
    setStreak(stats.streak)
  }, [bookId])

  useEffect(() => {
    let cancelled = false

    const refreshStreak = async () => {
      if (!bookId) return
      const stats = (await window.api.getAchievementStats(bookId)) as { streak: number }
      if (!cancelled) setStreak(stats.streak)
    }

    void refreshStreak()
    const id = setInterval(() => {
      void refreshStreak()
    }, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [bookId])

  return { streak: bookId ? streak : 0, refresh }
}

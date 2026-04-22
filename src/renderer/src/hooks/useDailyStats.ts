import { useEffect, useState, useCallback, useRef } from 'react'
import { useBookStore } from '@/stores/book-store'

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function useDailyStats() {
  const bookId = useBookStore((s) => s.currentBookId)
  const [todayWords, setTodayWords] = useState(0)
  const todayWordsRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!bookId) return
    const today = getToday()
    const stats = await window.api.getDailyStats(bookId, today)
    const count = (stats as { word_count: number })?.word_count || 0
    todayWordsRef.current = count
    setTodayWords(count)
  }, [bookId])

  const addWords = useCallback(
    async (count: number) => {
      if (!bookId) return
      const today = getToday()
      const newTotal = todayWordsRef.current + count
      todayWordsRef.current = newTotal
      await window.api.updateDailyStats(bookId, today, newTotal)
      setTodayWords(newTotal)
    },
    [bookId]
  )

  useEffect(() => {
    let cancelled = false

    const refreshDailyStats = async () => {
      if (!bookId) return
      const today = getToday()
      const stats = await window.api.getDailyStats(bookId, today)
      const count = (stats as { word_count: number })?.word_count || 0
      if (cancelled) return
      todayWordsRef.current = count
      setTodayWords(count)
    }

    void refreshDailyStats()
    const interval = setInterval(() => {
      void refreshDailyStats()
    }, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [bookId])

  return { todayWords: bookId ? todayWords : 0, refresh, addWords }
}

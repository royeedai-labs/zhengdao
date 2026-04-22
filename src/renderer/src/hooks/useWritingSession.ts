import { useEffect, useRef, useState, useMemo } from 'react'
import { useChapterStore } from '@/stores/chapter-store'

function formatSession(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s`
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h > 0) return `${h}h ${rest}m`
  return `${m}m`
}

export function useWritingSession(bookId: number | null) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [sessionWords, setSessionWords] = useState(0)
  const sessionIdRef = useRef<number | null>(null)
  const startWordsRef = useRef(0)
  const startedClockRef = useRef<number | null>(null)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    let tick: ReturnType<typeof setInterval> | undefined

    void (async () => {
      while (useChapterStore.getState().loading) {
        await new Promise((r) => setTimeout(r, 40))
        if (cancelled) return
      }
      startWordsRef.current = useChapterStore.getState().getTotalWords()
      const created = (await window.api.createSession(bookId)) as { id: number }
      if (cancelled) {
        await window.api.endSession(created.id, 0)
        return
      }
      sessionIdRef.current = created.id
      startedClockRef.current = Date.now()
      tick = setInterval(() => {
        if (startedClockRef.current != null) {
          setElapsedMs(Date.now() - startedClockRef.current)
        }
        const sw = Math.max(
          0,
          useChapterStore.getState().getTotalWords() - startWordsRef.current
        )
        setSessionWords(sw)
      }, 1000)
    })()

    return () => {
      cancelled = true
      if (tick) clearInterval(tick)
      const sid = sessionIdRef.current
      sessionIdRef.current = null
      startedClockRef.current = null
      if (sid != null) {
        const words = Math.max(
          0,
          useChapterStore.getState().getTotalWords() - startWordsRef.current
        )
        void window.api.endSession(sid, words)
      }
    }
  }, [bookId])

  const sessionTime = useMemo(() => formatSession(elapsedMs), [elapsedMs])

  return {
    sessionTime,
    sessionWords
  }
}

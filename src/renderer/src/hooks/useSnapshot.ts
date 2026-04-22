import { useEffect, useRef } from 'react'
import { useChapterStore } from '@/stores/chapter-store'

export function useSnapshot() {
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const lastSnapshotRef = useRef<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!currentChapter) return

    lastSnapshotRef.current = currentChapter.content || ''

    intervalRef.current = setInterval(async () => {
      const chapter = useChapterStore.getState().currentChapter
      if (!chapter || !chapter.content) return
      if (chapter.content === lastSnapshotRef.current) return

      try {
        await window.api.createSnapshot({
          chapter_id: chapter.id,
          content: chapter.content,
          word_count: chapter.word_count
        })
        lastSnapshotRef.current = chapter.content
      } catch (err) {
        console.error('[Snapshot] Failed to create snapshot:', err)
      }
    }, 60_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [currentChapter, currentChapter?.id])
}

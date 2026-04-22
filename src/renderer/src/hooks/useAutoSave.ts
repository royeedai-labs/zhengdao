import { useCallback } from 'react'

export function useAutoSave() {
  const saveDraft = useCallback(
    (chapterId: number, html: string) => {
      try {
        localStorage.setItem(`draft_${chapterId}`, html)
      } catch {
        return
      }
    },
    []
  )

  const clearDraft = useCallback((chapterId: number) => {
    try {
      localStorage.removeItem(`draft_${chapterId}`)
    } catch {
      return
    }
  }, [])

  const getDraft = useCallback((chapterId: number): string | null => {
    try {
      return localStorage.getItem(`draft_${chapterId}`)
    } catch {
      return null
    }
  }, [])

  return { saveDraft, clearDraft, getDraft }
}

import { useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'

function clearDraftKeys(drafts: { key: string }[]) {
  for (const { key } of drafts) {
    try {
      localStorage.removeItem(key)
    } catch {
      return
    }
  }
}

export function useCrashRecovery() {
  const openModal = useUIStore((s) => s.openModal)

  useEffect(() => {
    const drafts: { key: string; chapterId: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('draft_')) {
        const id = parseInt(key.replace('draft_', ''), 10)
        if (!isNaN(id)) {
          drafts.push({ key, chapterId: id })
        }
      }
    }

    if (drafts.length > 0) {
      openModal('confirm', {
        title: '检测到未保存的内容',
        message: `发现 ${drafts.length} 个未保存的草稿。是否恢复？选择"取消"将丢弃这些草稿。`,
        onConfirm: async () => {
          for (const { key, chapterId } of drafts) {
            const content = localStorage.getItem(key)
            if (content) {
              try {
                const text = content.replace(/<[^>]+>/g, '').replace(/\s/g, '')
                await window.api.updateChapter(chapterId, {
                  content,
                  word_count: text.length
                })
              } catch (err) {
                console.error(`[CrashRecovery] Failed to restore draft for chapter ${chapterId}:`, err)
              }
              localStorage.removeItem(key)
            }
          }
        },
        onCancel: () => {
          clearDraftKeys(drafts)
        }
      })
    }
  }, [openModal])
}

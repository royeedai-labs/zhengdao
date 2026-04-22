import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useUIStore } from '@/stores/ui-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useUpdateStore } from '@/stores/update-store'

export default function BlackRoomMode() {
  const { blackRoomMode, blackRoomTextColor } = useUIStore()
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const updateChapterContent = useChapterStore((s) => s.updateChapterContent)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')

  const persistChapter = useCallback(
    async (chapterId: number, html: string, wordCount: number) => {
      await updateChapterContent(chapterId, html, wordCount)
      lastSavedRef.current = html
      try {
        localStorage.removeItem(`draft_${chapterId}`)
      } catch {
        return
      }
    },
    [updateChapterContent]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: { depth: 100 } }),
      Placeholder.configure({ placeholder: '开始你的创作...' })
    ],
    editorProps: {
      attributes: {
        class:
          'max-w-3xl mx-auto font-serif text-[19px] leading-[2.2] tracking-wide focus:outline-none min-h-[60vh]'
      }
    },
    onUpdate: ({ editor: e }) => {
      if (!currentChapter) return
      const html = e.getHTML()
      try {
        localStorage.setItem(`draft_${currentChapter.id}`, html)
      } catch {
        return
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const scheduledChapterId = currentChapter.id
      saveTimerRef.current = setTimeout(async () => {
        if (useChapterStore.getState().currentChapter?.id !== scheduledChapterId) return
        const text = e.getText()
        const wordCount = text.replace(/\s/g, '').length
        await persistChapter(scheduledChapterId, html, wordCount)
      }, 800)
    }
  })

  const flushPendingSave = useCallback(async () => {
    if (!editor || !currentChapter) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const html = editor.getHTML()
    if (html === lastSavedRef.current) return

    const wordCount = editor.getText().replace(/\s/g, '').length
    await persistChapter(currentChapter.id, html, wordCount)
  }, [currentChapter, editor, persistChapter])

  useEffect(() => {
    if (!editor || !currentChapter) return
    const content = currentChapter.content || ''
    if (content !== lastSavedRef.current) {
      editor.commands.setContent(content || '<p></p>')
      lastSavedRef.current = content
    }
  }, [editor, currentChapter])

  useEffect(() => {
    if (blackRoomMode) {
      window.api.setFullScreen(true)
    }
    return () => {
      window.api.setFullScreen(false)
    }
  }, [blackRoomMode])

  useEffect(() => {
    useUpdateStore.getState().setPrepareInstallHandler(blackRoomMode && currentChapter && editor ? flushPendingSave : null)

    return () => {
      useUpdateStore.getState().setPrepareInstallHandler(null)
    }
  }, [blackRoomMode, currentChapter, editor, flushPendingSave])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      if (editor && currentChapter) {
        const html = editor.getHTML()
        if (html !== lastSavedRef.current) {
          const text = editor.getText()
          const wc = text.replace(/\s/g, '').length
          void updateChapterContent(currentChapter.id, html, wc)
        }
      }
    }
  }, [editor, currentChapter, updateChapterContent])

  if (!blackRoomMode) return null

  const textColor = blackRoomTextColor === 'green' ? '#00ff00' : '#e0e0e0'
  const wordCount = currentChapter?.word_count?.toLocaleString() || 0

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center select-text">
      <div className="max-w-3xl w-full px-8 flex-1 overflow-y-auto py-20" style={{ color: textColor }}>
        {currentChapter?.title && (
          <h2 className="text-center text-lg opacity-40 mb-12 font-sans">{currentChapter.title}</h2>
        )}
        <EditorContent editor={editor} />
      </div>
      <div className="absolute bottom-4 right-6 text-xs opacity-30 font-mono space-x-4" style={{ color: textColor }}>
        <span>{wordCount} 字</span>
        <span>ESC 退出</span>
        <span>Ctrl+T 切换颜色</span>
      </div>
    </div>
  )
}

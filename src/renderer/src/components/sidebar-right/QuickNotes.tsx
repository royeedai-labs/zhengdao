import { useCallback, useEffect, useState } from 'react'
import { Lightbulb, Plus, Trash2 } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useUIStore } from '@/stores/ui-store'

interface NoteItem {
  id: number
  content: string
  created_at: string
}

export default function QuickNotes() {
  const bookId = useBookStore((s) => s.currentBookId)!
  const pushModal = useUIStore((s) => s.pushModal)
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [input, setInput] = useState('')

  const loadNotes = useCallback(async () => {
    const data = await window.api.getNotes(bookId)
    setNotes(data as NoteItem[])
  }, [bookId])

  useEffect(() => {
    let cancelled = false

    const refreshNotes = async () => {
      try {
        const data = await window.api.getNotes(bookId)
        if (!cancelled) setNotes(data as NoteItem[])
      } catch {
        if (!cancelled) setNotes([])
      }
    }

    void refreshNotes()
    return () => {
      cancelled = true
    }
  }, [bookId])

  const addNote = async () => {
    if (!input.trim()) return
    await window.api.createNote({ book_id: bookId, content: input.trim() })
    setInput('')
    void loadNotes()
  }

  const removeNote = async (id: number) => {
    await window.api.deleteNote(id)
    void loadNotes()
  }

  return (
    <div className="p-4 h-full min-h-0 flex flex-col">
      <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center mb-3 uppercase tracking-wider">
        <Lightbulb size={14} className="mr-1.5 text-[var(--brand-primary)]" /> 灵感速记
      </h3>
      <div className="flex gap-1 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
          placeholder="记下灵感..."
          className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
        />
        <button
          onClick={addNote}
          title="新增灵感"
          aria-label="新增灵感"
          className="p-1 text-[var(--brand-primary)] hover:text-[var(--accent-secondary)] transition"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {notes.map((note) => (
          <div key={note.id} className="flex items-start gap-1 group text-[11px]">
            <span className="flex-1 text-[var(--text-secondary)] leading-relaxed">{note.content}</span>
            <button
              onClick={() =>
                pushModal('confirm', {
                  title: '删除灵感',
                  message: '确定删除这条灵感速记吗？',
                  onConfirm: async () => {
                    await removeNote(note.id)
                  }
                })}
              title="删除灵感"
              aria-label="删除灵感"
              className="shrink-0 p-0.5 text-[var(--text-muted)] hover:text-[var(--danger-primary)] opacity-0 group-hover:opacity-100 transition"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

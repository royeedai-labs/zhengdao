import { useMemo, useState } from 'react'
import { Eye, X, Save } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'

export default function ForeshadowModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData) as { selectedText?: string } | null
  const bookId = useBookStore((s) => s.currentBookId)!
  const { volumes, currentChapter } = useChapterStore()
  const createForeshadowing = useForeshadowStore((s) => s.createForeshadowing)

  const chaptersFlat = useMemo(() => {
    const list: { id: number; label: string }[] = []
    for (const v of volumes) {
      for (const ch of v.chapters || []) {
        list.push({ id: ch.id, label: `${v.title} / ${ch.title}` })
      }
    }
    return list
  }, [volumes])

  const [chapterId, setChapterId] = useState<number | ''>(() => currentChapter?.id ?? '')
  const [text, setText] = useState(modalData?.selectedText || '')
  const [expectedChapter, setExpectedChapter] = useState('')
  const [expectedWords, setExpectedWords] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) return
    await createForeshadowing({
      book_id: bookId,
      chapter_id: chapterId === '' ? undefined : Number(chapterId),
      text: text.trim(),
      expected_chapter: expectedChapter ? Number(expectedChapter) : undefined,
      expected_word_count: expectedWords ? Number(expectedWords) : undefined
    })
    closeModal()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="flex items-center space-x-2 text-[var(--warning-primary)] font-bold">
            <Eye size={18} />
            <span>埋设伏笔</span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">锚定章节（可选）</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--warning-primary)]"
            >
              <option value="">不关联具体章节</option>
              {chaptersFlat.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">伏笔内容</label>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--warning-primary)]"
              placeholder="记录下你要回收的伏笔..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">预计在第 N 章回收</label>
              <input
                type="number"
                value={expectedChapter}
                onChange={(e) => setExpectedChapter(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] font-mono text-sm"
                placeholder="可选"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">预计全书字数达</label>
              <input
                type="number"
                value={expectedWords}
                onChange={(e) => setExpectedWords(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] font-mono text-sm"
                placeholder="可选"
              />
            </div>
          </div>
        </div>

        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3">
          <button onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[var(--warning-primary)] hover:brightness-105 disabled:opacity-40 text-[var(--text-inverse)] rounded"
          >
            <Save size={14} /> 保存伏笔
          </button>
        </div>
      </div>
    </div>
  )
}

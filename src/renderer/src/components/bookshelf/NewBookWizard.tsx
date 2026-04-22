import { useState } from 'react'
import { X, Save, ChevronRight, BookOpen } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useConfigStore } from '@/stores/config-store'
import { GENRE_PRESETS } from '@/utils/genre-presets'

export default function NewBookWizard() {
  const closeModal = useUIStore((s) => s.closeModal)
  const createBook = useBookStore((s) => s.createBook)
  const initConfig = useConfigStore((s) => s.initConfig)
  const openBook = useBookStore((s) => s.openBook)
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState('urban')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const book = await createBook(title.trim(), author.trim())
      await initConfig(book.id, genre)
      openBook(book.id)
      closeModal()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-[520px] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <BookOpen size={18} />
            <span>新建作品 ({step}/2)</span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5 flex-1">
          {step === 1 && (
            <>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">作品名称</label>
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2.5 text-[var(--text-primary)] text-lg focus:outline-none focus:border-[var(--accent-primary)] transition"
                  placeholder="例如：重生之金融巨子"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">笔名 (选填)</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition"
                  placeholder="你的笔名"
                />
              </div>
            </>
          )}
          {step === 2 && (
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-3">选择题材模板</label>
              <div className="space-y-2">
                {GENRE_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => setGenre(preset.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      genre === preset.id
                        ? 'bg-[var(--accent-surface)] border-[var(--accent-border)] text-[var(--accent-secondary)]'
                        : 'bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <div className="font-bold text-sm mb-1">{preset.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      字段: {preset.character_fields.map((f) => f.label).join('、')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3">
          <button onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          {step === 1 && (
            <button
              onClick={() => title.trim() && setStep(2)}
              disabled={!title.trim()}
              className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-contrast)] rounded flex items-center transition shadow-lg shadow-[0_10px_24px_rgba(63,111,159,0.16)]"
            >
              下一步 <ChevronRight size={14} className="ml-1" />
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded flex items-center transition shadow-lg shadow-[0_10px_24px_rgba(63,111,159,0.16)]"
            >
              <Save size={14} className="mr-1" /> {submitting ? '创建中...' : '确认创建'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Layers, X, Save } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useChapterStore } from '@/stores/chapter-store'

export default function NewVolumeModal() {
  const { modalData, closeModal } = useUIStore()
  const createVolume = useChapterStore((s) => s.createVolume)
  const data = modalData as { book_id?: number } | null
  const bookId = data?.book_id

  const [title, setTitle] = useState('')

  const handleSubmit = async () => {
    if (!bookId || !title.trim()) return
    await createVolume(bookId, title.trim())
    closeModal()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-[440px] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <Layers size={18} />
            <span>新建卷</span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">卷标题</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              placeholder="例如：第一卷 潜龙勿用"
            />
          </div>
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3">
          <button onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !bookId}
            className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded"
          >
            <Save size={14} /> 创建
          </button>
        </div>
      </div>
    </div>
  )
}

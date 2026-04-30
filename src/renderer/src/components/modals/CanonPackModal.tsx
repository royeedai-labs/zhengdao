import { useMemo } from 'react'
import { Network, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useUIStore } from '@/stores/ui-store'
import CanonPackPanel, { type CanonPackTab } from '../canon-pack/CanonPackPanel'

/**
 * CG-A3.3 — CanonPackModal.
 *
 * Canon Pack 三视图 (关系图谱 / 时间线 / 组织架构) 的全屏 Modal 入口,
 * 由 AiAssistantDock 的 header 按钮 + AiSettingsModal 三 section 的
 * 「查看图」跳转按钮触发。modalData.initialTab 决定首屏激活哪一 view。
 */

export default function CanonPackModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData)
  const bookId = useBookStore((s) => s.currentBookId)

  const initialTab = useMemo<CanonPackTab>(() => {
    const data = modalData as { initialTab?: CanonPackTab } | null
    return data?.initialTab ?? 'relations'
  }, [modalData])

  if (!bookId) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <Network size={18} className="text-[var(--accent-secondary)]" />
            Canon Pack 视图
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <CanonPackPanel bookId={bookId} initialTab={initialTab} />
        </div>
      </div>
    </div>
  )
}

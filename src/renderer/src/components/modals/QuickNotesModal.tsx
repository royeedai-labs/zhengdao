import { Lightbulb, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import QuickNotes from '@/components/sidebar-right/QuickNotes'

export default function QuickNotesModal() {
  const closeModal = useUIStore((s) => s.closeModal)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[76vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <Lightbulb size={17} className="text-[var(--brand-primary)]" />
            <span>灵感速记</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            title="关闭"
            aria-label="关闭灵感速记"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--bg-secondary)]">
          <QuickNotes />
        </div>
      </div>
    </div>
  )
}

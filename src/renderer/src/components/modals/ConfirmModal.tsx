import { useCallback, useEffect, useRef } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'

export default function ConfirmModal() {
  const { modalData, closeModal } = useUIStore()
  const data = modalData as {
    title?: string
    message?: string
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
  } | null

  const handleConfirm = async () => {
    try {
      await data?.onConfirm?.()
    } finally {
      closeModal()
    }
  }

  const handleCancel = useCallback(() => {
    data?.onCancel?.()
    closeModal()
  }, [closeModal, data])

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    window.addEventListener('keydown', handler)
    dialogRef.current?.focus()
    return () => window.removeEventListener('keydown', handler)
  }, [handleCancel])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-[420px] rounded-xl shadow-2xl overflow-hidden focus:outline-none"
      >
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div id="confirm-title" className="flex items-center space-x-2 text-[var(--danger-primary)] font-bold">
            <AlertCircle size={18} />
            <span>{data?.title || '确认操作'}</span>
          </div>
          <button onClick={handleCancel} aria-label="关闭" title="关闭" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-[var(--text-primary)] text-sm leading-relaxed">{data?.message || '确定要执行此操作吗？'}</p>
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3">
          <button onClick={handleCancel} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs bg-[var(--danger-primary)] hover:brightness-105 text-[var(--text-inverse)] rounded flex items-center transition"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

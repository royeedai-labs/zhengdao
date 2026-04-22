import { useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react'
import type { Toast, ToastType } from '@/stores/toast-store'
import { useToastStore } from '@/stores/toast-store'

const typeStyles: Record<
  ToastType,
  { iconWrap: string; Icon: typeof CheckCircle }
> = {
  success: {
    iconWrap: 'bg-[var(--success-surface)] text-[var(--success-primary)]',
    Icon: CheckCircle
  },
  warning: {
    iconWrap: 'bg-[var(--warning-surface)] text-[var(--warning-primary)]',
    Icon: AlertTriangle
  },
  error: {
    iconWrap: 'bg-[var(--danger-surface)] text-[var(--danger-primary)]',
    Icon: XCircle
  },
  info: {
    iconWrap: 'bg-[var(--info-surface)] text-[var(--info-primary)]',
    Icon: Info
  }
}

function ToastRow({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [leaving, setLeaving] = useState(false)
  const { iconWrap, Icon } = typeStyles[toast.type]

  const dismiss = useCallback(() => {
    setLeaving(true)
    window.setTimeout(() => removeToast(toast.id), 200)
  }, [removeToast, toast.id])

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2.5 shadow-lg transition-opacity duration-200 ease-out ${
        leaving ? 'opacity-0' : 'toast-slide-in opacity-100'
      }`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconWrap}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--text-primary)]">{toast.message}</p>
      <button
        type="button"
        aria-label="关闭通知"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  )
}

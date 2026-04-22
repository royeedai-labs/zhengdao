import { Download } from 'lucide-react'
import { useUpdateStore } from '@/stores/update-store'
import { shouldShowUpdateButton } from '@/utils/update-visibility'

interface UpdateActionButtonProps {
  variant?: 'workspace' | 'bookshelf'
}

export default function UpdateActionButton({ variant = 'workspace' }: UpdateActionButtonProps) {
  const snapshot = useUpdateStore((s) => s.snapshot)
  const installing = useUpdateStore((s) => s.installing)
  const installReadyUpdate = useUpdateStore((s) => s.installReadyUpdate)

  if (!shouldShowUpdateButton(snapshot, installing)) return null

  const title = installing
    ? '正在准备安装更新'
    : snapshot.version
      ? `新版本 ${snapshot.version} 已下载，点击立即重启安装`
      : '新版本已下载，点击立即重启安装'

  const classes =
    variant === 'bookshelf'
      ? 'flex items-center px-4 py-2 rounded-lg text-sm font-bold transition shadow-lg bg-[var(--success-primary)] hover:brightness-105 text-[var(--text-inverse)] disabled:opacity-70 disabled:cursor-not-allowed'
      : 'flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold border border-[var(--success-border)] text-[var(--success-primary)] hover:bg-[var(--success-surface)] transition shrink-0 min-h-8 disabled:opacity-70 disabled:cursor-not-allowed'

  return (
    <button
      type="button"
      title={title}
      disabled={installing}
      onClick={() => {
        void installReadyUpdate()
      }}
      className={classes}
    >
      <Download size={variant === 'bookshelf' ? 16 : 14} />
      <span>{installing ? '更新中…' : '更新'}</span>
    </button>
  )
}

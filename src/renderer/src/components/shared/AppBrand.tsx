import { PenTool } from 'lucide-react'

interface AppBrandProps {
  compact?: boolean
}

export default function AppBrand({ compact = false }: AppBrandProps) {
  return (
    <div className="flex items-center gap-3 text-[var(--text-primary)]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <PenTool size={compact ? 15 : 16} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-[0.24em] text-[var(--brand-primary)]">证道</span>
        {!compact ? (
          <span className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
            Novel Studio
          </span>
        ) : null}
      </div>
    </div>
  )
}

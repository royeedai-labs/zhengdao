import BrandMark from './BrandMark'

interface AppBrandProps {
  compact?: boolean
}

export default function AppBrand({ compact = false }: AppBrandProps) {
  return (
    <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
      <BrandMark
        size={compact ? 30 : 34}
        className="shrink-0 drop-shadow-[0_10px_18px_rgba(47,95,145,0.16)]"
      />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-[0.16em] text-[var(--brand-primary)]">证道</span>
        {!compact ? (
          <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Novel Studio
          </span>
        ) : null}
      </div>
    </div>
  )
}

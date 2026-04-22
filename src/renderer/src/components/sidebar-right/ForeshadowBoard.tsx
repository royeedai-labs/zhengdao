import { useState, type ReactNode } from 'react'
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import type { Foreshadowing } from '@/types'

type SectionTone = {
  border: string
  bg: string
  text: string
  icon: string
  empty: string
}

function StatusActionButton({
  label,
  title,
  icon,
  onClick,
  variant
}: {
  label: string
  title: string
  icon: ReactNode
  onClick: () => void
  variant: 'neutral' | 'accent'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
        variant === 'accent'
          ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15'
          : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function ForeshadowCard({
  foreshadowing,
  tone,
  onBack,
  onForward,
  backLabel,
  forwardLabel
}: {
  foreshadowing: Foreshadowing
  tone: SectionTone
  onBack?: () => void
  onForward?: () => void
  backLabel?: string
  forwardLabel?: string
}) {
  return (
    <article
      className={`rounded-lg border-l-4 px-3 py-3 ${tone.bg}`}
      style={{ borderLeftColor: 'currentColor' }}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${tone.icon}`}>
          {foreshadowing.status === 'pending' ? (
            <Sparkles size={14} />
          ) : foreshadowing.status === 'warning' ? (
            <BellRing size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] leading-6 font-medium break-words ${tone.text}`}>{foreshadowing.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
            {foreshadowing.chapter_title && <span>来源：{foreshadowing.chapter_title}</span>}
            {foreshadowing.expected_chapter !== null && <span>预计章节：第 {foreshadowing.expected_chapter} 章</span>}
            {foreshadowing.expected_word_count !== null && (
              <span>预计字数：{foreshadowing.expected_word_count.toLocaleString()}</span>
            )}
          </div>
          {(onBack || onForward) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onBack && backLabel && (
                <StatusActionButton
                  label={backLabel}
                  title={backLabel}
                  icon={<ChevronLeft size={12} />}
                  onClick={onBack}
                  variant="neutral"
                />
              )}
              {onForward && forwardLabel && (
                <StatusActionButton
                  label={forwardLabel}
                  title={forwardLabel}
                  icon={<ChevronRight size={12} />}
                  onClick={onForward}
                  variant="accent"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function ForeshadowSection({
  title,
  count,
  icon,
  tone,
  open,
  onToggle,
  children,
  emptyLabel
}: {
  title: string
  count: number
  icon: ReactNode
  tone: SectionTone
  open: boolean
  onToggle: () => void
  children: ReactNode
  emptyLabel: string
}) {
  return (
    <section className={`overflow-hidden rounded-lg border ${tone.border}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition ${tone.bg}`}
        title={`${title}（${count}）`}
      >
        <span className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${tone.text}`}>
          {icon}
          {title}
          <span className="font-mono opacity-75">({count})</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 ${tone.icon} transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--border-primary)] px-3 py-3 space-y-3 bg-[var(--bg-secondary)]">
          {count === 0 ? <p className={`py-2 text-center text-[11px] ${tone.empty}`}>{emptyLabel}</p> : children}
        </div>
      )}
    </section>
  )
}

export default function ForeshadowBoard() {
  const { foreshadowings, updateStatus } = useForeshadowStore()
  const pending = foreshadowings.filter((foreshadowing) => foreshadowing.status === 'pending')
  const warnings = foreshadowings.filter((foreshadowing) => foreshadowing.status === 'warning')
  const resolved = foreshadowings.filter((foreshadowing) => foreshadowing.status === 'resolved')

  const [openPending, setOpenPending] = useState(true)
  const [openWarning, setOpenWarning] = useState(true)
  const [openResolved, setOpenResolved] = useState(false)

  const total = foreshadowings.length

  const pendingTone: SectionTone = {
    border: 'border-[var(--info-border)]',
    bg: 'bg-[var(--info-surface)]',
    text: 'text-[var(--text-primary)]',
    icon: 'text-[var(--info-primary)]',
    empty: 'text-[var(--text-muted)]'
  }
  const warningTone: SectionTone = {
    border: 'border-[var(--warning-border)]',
    bg: 'bg-[var(--warning-surface)]',
    text: 'text-[var(--text-primary)]',
    icon: 'text-[var(--warning-primary)]',
    empty: 'text-[var(--text-muted)]'
  }
  const resolvedTone: SectionTone = {
    border: 'border-[var(--success-border)]',
    bg: 'bg-[var(--success-surface)]',
    text: 'text-[var(--text-primary)]',
    icon: 'text-[var(--success-primary)]',
    empty: 'text-[var(--text-muted)]'
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
          <AlertCircle size={13} className="shrink-0 text-[var(--warning-primary)]" />
          伏笔看板
        </h3>
        {warnings.length > 0 && (
          <span className="whitespace-nowrap rounded-full border border-[var(--warning-border)] bg-[var(--warning-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--warning-primary)] animate-pulse">
            {warnings.length} 催债中
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="py-3 text-center text-[11px] text-[var(--text-muted)]">暂无伏笔</p>
      ) : (
        <div className="space-y-2.5">
          <ForeshadowSection
            title="待发酵"
            count={pending.length}
            icon={<Sparkles size={13} className="shrink-0" />}
            tone={pendingTone}
            open={openPending}
            onToggle={() => setOpenPending((value) => !value)}
            emptyLabel="暂无待发酵伏笔"
          >
            {pending.map((foreshadowing) => (
              <ForeshadowCard
                key={foreshadowing.id}
                foreshadowing={foreshadowing}
                tone={pendingTone}
                onForward={() => void updateStatus(foreshadowing.id, 'warning')}
                forwardLabel="推进到催债中"
              />
            ))}
          </ForeshadowSection>

          <ForeshadowSection
            title="催债中"
            count={warnings.length}
            icon={<BellRing size={13} className="shrink-0 animate-pulse" />}
            tone={warningTone}
            open={openWarning}
            onToggle={() => setOpenWarning((value) => !value)}
            emptyLabel="暂无催债中的伏笔"
          >
            {warnings.map((foreshadowing) => (
              <ForeshadowCard
                key={foreshadowing.id}
                foreshadowing={foreshadowing}
                tone={warningTone}
                onBack={() => void updateStatus(foreshadowing.id, 'pending')}
                onForward={() => void updateStatus(foreshadowing.id, 'resolved')}
                backLabel="回退到待发酵"
                forwardLabel="标记为已回收"
              />
            ))}
          </ForeshadowSection>

          <ForeshadowSection
            title="已回收"
            count={resolved.length}
            icon={<CheckCircle2 size={13} className="shrink-0" />}
            tone={resolvedTone}
            open={openResolved}
            onToggle={() => setOpenResolved((value) => !value)}
            emptyLabel="暂无已回收伏笔"
          >
            {resolved.map((foreshadowing) => (
              <ForeshadowCard
                key={foreshadowing.id}
                foreshadowing={foreshadowing}
                tone={resolvedTone}
                onBack={() => void updateStatus(foreshadowing.id, 'warning')}
                backLabel="回退到催债中"
              />
            ))}
          </ForeshadowSection>
        </div>
      )}
    </div>
  )
}

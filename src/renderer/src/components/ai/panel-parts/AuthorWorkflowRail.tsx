import {
  BarChart3,
  BookOpenText,
  Bot,
  Clapperboard,
  FileCheck2,
  Image,
  PenLine,
  Rocket,
  ScanText,
  Search
} from 'lucide-react'

export type AuthorWorkflowActionId =
  | 'bookPlan'
  | 'daily'
  | 'chapterReview'
  | 'deslop'
  | 'publishCheck'
  | 'director'
  | 'visual'
  | 'intel'
  | 'deconstruct'

export type AuthorWorkflowAction = {
  id: AuthorWorkflowActionId
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
}

function WorkflowIcon({ id }: { id: AuthorWorkflowActionId }) {
  switch (id) {
    case 'bookPlan':
      return <BookOpenText size={14} />
    case 'daily':
      return <Rocket size={14} />
    case 'chapterReview':
      return <Bot size={14} />
    case 'deslop':
      return <ScanText size={14} />
    case 'publishCheck':
      return <FileCheck2 size={14} />
    case 'director':
      return <Clapperboard size={14} />
    case 'visual':
      return <Image size={14} />
    case 'intel':
      return <BarChart3 size={14} />
    case 'deconstruct':
      return <Search size={14} />
  }
}

export function AuthorWorkflowRail({ actions }: { actions: AuthorWorkflowAction[] }): JSX.Element {
  return (
    <div className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <PenLine size={12} />
        作者任务流
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-secondary)] bg-[var(--surface-primary)] px-2.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-surface)] hover:text-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <WorkflowIcon id={action.id} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

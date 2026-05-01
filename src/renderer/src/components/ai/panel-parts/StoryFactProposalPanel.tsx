import { Check, Database, X } from 'lucide-react'
import type { StoryFactProposal } from '../../../../../shared/story-bible'

interface StoryFactProposalPanelProps {
  proposals: StoryFactProposal[]
  busyIds: number[]
  onAccept: (id: number) => void
  onReject: (id: number) => void
}

const FACT_KIND_LABELS: Record<string, string> = {
  character_status: '人物状态',
  character_motivation: '人物动机',
  character_secret: '人物秘密',
  timeline: '时间线',
  setting: '设定',
  clue: '线索',
  relationship: '关系'
}

export function StoryFactProposalPanel(props: StoryFactProposalPanelProps) {
  if (props.proposals.length === 0) return null

  return (
    <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
        <Database size={14} /> 待确认事实
      </div>
      <div className="space-y-2">
        {props.proposals.slice(0, 6).map((proposal) => {
          const busy = props.busyIds.includes(proposal.id)
          return (
            <article key={proposal.id} className="rounded-md border border-[var(--border-secondary)] p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--text-primary)]">
                    {FACT_KIND_LABELS[proposal.fact_kind] || proposal.fact_kind} · {proposal.subject || proposal.fact_key}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">{proposal.value}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                    {proposal.evidence}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="icon-btn h-7 w-7"
                    title="确认写入事实库"
                    disabled={busy}
                    onClick={() => props.onAccept(proposal.id)}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn h-7 w-7"
                    title="拒绝这个事实候选"
                    disabled={busy}
                    onClick={() => props.onReject(proposal.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

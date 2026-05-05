import { forwardRef } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import type { AiContextChip, AiSkillTemplate } from '@/utils/ai/assistant-workflow'
import { buildAssistantMessageDisplay } from '../message-display'
import { SkillFeedbackForm } from '../SkillFeedbackForm'
import type { QuickActionItem } from './AssistantPanelComposer'
import { readAuthorThoughtBlock } from '../../../../../shared/assistant-presentation'

/**
 * SPLIT-006 phase 2 — scrollable conversation surface.
 *
 * Renders three layers stacked top-down:
 *   1. Starter quick actions (only when message list is empty / chapter
 *      editor is on a blank chapter)
 *   2. Context chip row (passive: shows what context is attached)
 *   3. Message list with structured-draft rendering for assistant
 *      messages whose `display.kind === 'drafts'`
 *
 * The parent panel slots a <DraftListPanel /> + error banner directly
 * after this component as separate JSX siblings; this component does
 * not render either, but it does take the scroll ref so the parent
 * can keep auto-scrolling as new messages arrive.
 */

export interface MessageStreamMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
  metadata?: Record<string, unknown>
}

export interface MessageStreamAreaProps {
  messages: MessageStreamMessage[]
  contextChips: AiContextChip[]
  showStarterActions: boolean
  starterDescription: string
  starterFooter: string
  quickActions: QuickActionItem[]
  skills: AiSkillTemplate[]
  onSeedSkill: (skill: AiSkillTemplate, input: string | undefined) => void
  onPrefillInput: (input: string) => void
  onRunQuickAction?: (action: QuickActionItem) => void
  children?: React.ReactNode
}

export const MessageStreamArea = forwardRef<HTMLDivElement, MessageStreamAreaProps>(
  function MessageStreamArea(props, ref): JSX.Element {
    return (
      <div
        ref={ref}
        className="flex-1 space-y-3 overflow-y-auto p-3 select-text"
      >
        {props.showStarterActions && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
              {props.starterDescription}
              {props.starterFooter}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {props.quickActions.map((action) => {
                const skill = props.skills.find((item) => item.key === action.key)
                const actionInput = action.input
                return (
                  <button
                    key={action.key}
                    type="button"
                    disabled={(!skill && !actionInput) || action.disabled}
                    onClick={() => {
                      if (skill) props.onSeedSkill(skill, actionInput)
                      else if (action.key === 'remove_ai_tone' && actionInput && props.onRunQuickAction) {
                        props.onRunQuickAction(action)
                      }
                      else if (actionInput) props.onPrefillInput(actionInput)
                    }}
                    className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-left transition hover:border-[var(--accent-border)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                      <Sparkles size={13} className="text-[var(--accent-primary)]" /> {action.label}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[10px] text-[var(--text-muted)]">
                      {action.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {props.contextChips.map((chip) => (
            <span
              key={chip.id}
              className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
            >
              {chip.label}
            </span>
          ))}
        </div>

        {props.messages.map((message) => {
          const display = buildAssistantMessageDisplay(message)
          const authorThought = readAuthorThoughtBlock(message.metadata?.authorThought)
          const streamingLabel =
            message.role === 'assistant' && message.streaming
              ? message.streamingLabel || 'AI 正在回复...'
              : ''
          const feedbackRunId =
            typeof message.metadata?.skill_run_id === 'string'
              ? message.metadata.skill_run_id
              : typeof message.metadata?.runId === 'string'
                ? message.metadata.runId
                : ''
          const feedbackSkillId =
            typeof message.metadata?.skill_id === 'string'
              ? message.metadata.skill_id
              : typeof message.metadata?.skill_key === 'string'
                ? message.metadata.skill_key
                : ''

          return (
            <div
              key={message.id}
              className={`rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'ml-8 border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]'
                  : 'mr-8 border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
              }`}
            >
              {streamingLabel && (
                <div className="mb-2 flex items-center gap-1.5 whitespace-normal text-[10px] font-semibold text-[var(--accent-secondary)]">
                  <Loader2 size={11} className="animate-spin" />
                  <span>{streamingLabel}</span>
                </div>
              )}
              {authorThought && (
                <details className="mb-3 whitespace-normal rounded-md border border-[var(--accent-border)] bg-[var(--accent-surface)] p-2.5">
                  <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-secondary)]">
                    创作取舍 · 展开
                  </summary>
                  <div className="mt-2 space-y-1.5 text-xs text-[var(--text-primary)]">
                    {authorThought.lines.map((line, index) => (
                      <div key={`${message.id}-thought-${index}`} className="leading-relaxed">
                        {line}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {display.kind === 'drafts' ? (
                <div className="space-y-2 whitespace-normal">
                  <div className="text-xs text-[var(--text-secondary)]">{display.intro}</div>
                  <div className="space-y-2">
                    {display.drafts.map((draft, index) => (
                      <div
                        key={`${draft.title}-${index}`}
                        className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2"
                      >
                        <div className="font-medium text-[var(--text-primary)]">{draft.title}</div>
                        {draft.summary && (
                          <div className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                            {draft.summary}
                          </div>
                        )}
                        {draft.fields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {draft.fields.map((field) => (
                              <span
                                key={`${draft.title}-${field.label}`}
                                className="rounded border border-[var(--border-primary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                              >
                                {field.label}: {field.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                display.text
              )}
              {message.role === 'assistant' && !message.streaming && feedbackRunId && feedbackSkillId && (
                <div className="mt-3 whitespace-normal">
                  <SkillFeedbackForm
                    runId={feedbackRunId}
                    skillId={feedbackSkillId}
                    surface="desktop-ai-dock"
                  />
                </div>
              )}
            </div>
          )
        })}

        {props.children}
      </div>
    )
  }
)

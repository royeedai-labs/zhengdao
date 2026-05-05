import { Send } from 'lucide-react'
import type { AiSkillTemplate } from '@/utils/ai/assistant-workflow'
import { shouldSubmitAiAssistantInput } from '../input-behavior'
import {
  ASSISTANT_INTERACTION_MODE_OPTIONS,
  type AssistantInteractionMode
} from '../assistant-interaction-mode'

/**
 * SPLIT-006 phase 2 — bottom composer (quick action buttons + input + send).
 *
 * `quickActions` is a derived list provided by the parent (resolves
 * starter prompts vs chapter-editor surface). Each action is either:
 *   - tied to a `skill` (resolved by key)  → calls onSeedSkill(skill, input)
 *   - or a freeform input prefill → calls onPrefillInput(input)
 *
 * The composer keeps no state of its own; `value` + `onChange` drive
 * the textarea controlled-component pattern.
 */

export interface QuickActionItem {
  key: string
  label: string
  description: string
  disabled: boolean
  input?: string
}

export interface AssistantPanelComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
  assistantMode: AssistantInteractionMode
  onAssistantModeChange: (mode: AssistantInteractionMode) => void
  quickActions: QuickActionItem[]
  skills: AiSkillTemplate[]
  onSeedSkill: (skill: AiSkillTemplate, input: string | undefined) => void
  onPrefillInput: (input: string) => void
}

export function AssistantPanelComposer(props: AssistantPanelComposerProps): JSX.Element {
  return (
    <div className="shrink-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
      <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
        {ASSISTANT_INTERACTION_MODE_OPTIONS.map((mode) => {
          const active = props.assistantMode === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => props.onAssistantModeChange(mode.id)}
              className={`rounded-md px-2 py-1.5 text-left transition ${
                active
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title={mode.description}
              aria-pressed={active}
            >
              <div className="text-[11px] font-bold">{mode.label}</div>
              <div className="mt-0.5 line-clamp-1 text-[10px] opacity-80">{mode.description}</div>
            </button>
          )
        })}
      </div>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {props.quickActions.map((action) => {
          const skill = props.skills.find((item) => item.key === action.key)
          const actionInput = action.input
          return (
            <button
              key={action.key}
              type="button"
              disabled={(!skill && !actionInput) || action.disabled || props.loading}
              onClick={() => {
                if (skill) props.onSeedSkill(skill, actionInput)
                else if (actionInput) props.onPrefillInput(actionInput)
              }}
              className="truncate rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-45"
              title={action.description}
            >
              {action.label}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onKeyDown={(event) => {
            if (shouldSubmitAiAssistantInput(event)) {
              event.preventDefault()
              props.onSubmit()
            }
          }}
          placeholder="直接描述你要 AI 做什么。Enter 发送，Shift + Enter 换行"
          className="field resize-none text-xs"
        />
        <button
          type="button"
          disabled={!props.value.trim() || props.loading}
          onClick={() => props.onSubmit()}
          className="primary-btn self-stretch px-3"
          title="发送"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

import {
  BookOpen,
  Bot,
  MessageSquare,
  MessageSquarePlus,
  MessagesSquare,
  Network,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react'

/**
 * SPLIT-006 phase 2 — AiAssistantPanel header toolbar.
 *
 * Provider label + 9 toolbar buttons (history toggle / new conversation /
 * clear conversation / script-only dialogue rewrite / world-consistency /
 * academic-only citations / team space / AI settings / close).
 *
 * Genre-conditional buttons (`profileGenre === 'script' | 'academic'`)
 * are rendered inside the toolbar so call sites only have to wire one
 * sub-component.
 */

export interface AssistantPanelHeaderProps {
  title: string
  providerLabel: string
  conversationListOpen: boolean
  profileGenre: string | undefined | null
  hasSelectedTextForCurrentChapter: boolean
  selectedText: string
  onToggleConversationList: () => void
  onCreateConversation: () => void
  onClearConversation: () => void
  onOpenDialogueRewrite: (selectedText: string) => void
  onOpenWorldConsistency: () => void
  onOpenCitationsManager: () => void
  onOpenTeamManagement: () => void
  onOpenAiSettings: () => void
  onOpenCanonPack: () => void
  onClose: () => void
}

export function AssistantPanelHeader(props: AssistantPanelHeaderProps): JSX.Element {
  const dialogueSelection = props.hasSelectedTextForCurrentChapter ? props.selectedText : ''

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
        <Bot size={17} className="text-[var(--accent-primary)]" />
        <span className="min-w-0 truncate">{props.title}</span>
        <span className="min-w-0 truncate rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-secondary)]">
          {props.providerLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => props.onToggleConversationList()}
          title="会话列表"
          className={`rounded p-1.5 ${
            props.conversationListOpen
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MessageSquare size={16} />
        </button>
        <button
          type="button"
          onClick={() => props.onCreateConversation()}
          title="新建 AI 会话"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <MessageSquarePlus size={16} />
        </button>
        <button
          type="button"
          onClick={() => props.onClearConversation()}
          title="清空当前会话"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-surface)] hover:text-[var(--danger-primary)]"
        >
          <Trash2 size={16} />
        </button>
        {props.profileGenre === 'script' && (
          <button
            type="button"
            onClick={() => props.onOpenDialogueRewrite(dialogueSelection)}
            title="对白块改写 (剧本)"
            className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
          >
            <MessagesSquare size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => props.onOpenWorldConsistency()}
          title="世界观一致性检查 (Canon Pack)"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
        >
          <ShieldCheck size={16} />
        </button>
        <button
          type="button"
          onClick={() => props.onOpenCanonPack()}
          title="Canon Pack 视图 (关系图谱 / 时间线 / 组织架构)"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
        >
          <Network size={16} />
        </button>
        {props.profileGenre === 'academic' && (
          <button
            type="button"
            onClick={() => props.onOpenCitationsManager()}
            title="学术引文管理 (academic)"
            className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
          >
            <BookOpen size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => props.onOpenTeamManagement()}
          title="团队空间 (DI-06)"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]"
        >
          <Users size={16} />
        </button>
        <button
          type="button"
          onClick={() => props.onOpenAiSettings()}
          title="AI 能力与上下文"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <Settings2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => props.onClose()}
          title="收起 AI 助手"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

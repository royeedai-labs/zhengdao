import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Bot,
  Clapperboard,
  Image,
  MessageSquare,
  MessageSquarePlus,
  MessagesSquare,
  MoreHorizontal,
  Network,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react'
import {
  getAssistantToolActionGroups,
  type AssistantToolAction,
  type AssistantToolActionId
} from '../assistant-toolbar-actions'

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
  onOpenDirectorPanel: () => void
  onOpenVisualStudio: () => void
  onOpenWritingIntel: () => void
  onOpenMcpSettings: () => void
  onOpenMarketScanDeconstruct: () => void
  onOpenAiSettings: () => void
  onOpenCanonPack: () => void
  onClose: () => void
}

function AssistantToolIcon({ id }: { id: AssistantToolActionId }) {
  switch (id) {
    case 'dialogueRewrite':
      return <MessagesSquare size={15} />
    case 'worldConsistency':
      return <ShieldCheck size={15} />
    case 'directorPanel':
      return <Clapperboard size={15} />
    case 'canonPack':
      return <Network size={15} />
    case 'visualStudio':
      return <Image size={15} />
    case 'writingIntel':
      return <BarChart3 size={15} />
    case 'marketScanDeconstruct':
      return <Search size={15} />
    case 'mcpSettings':
      return <ServerCog size={15} />
    case 'citationsManager':
      return <BookOpen size={15} />
    case 'teamManagement':
      return <Users size={15} />
    case 'aiSettings':
      return <Settings2 size={15} />
  }
}

export function AssistantPanelHeader(props: AssistantPanelHeaderProps): JSX.Element {
  const dialogueSelection = props.hasSelectedTextForCurrentChapter ? props.selectedText : ''
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const toolMenuRef = useRef<HTMLDivElement>(null)
  const toolGroups = getAssistantToolActionGroups(props.profileGenre)

  useEffect(() => {
    if (!toolMenuOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!toolMenuRef.current?.contains(target)) setToolMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [toolMenuOpen])

  const runToolAction = (action: AssistantToolAction) => {
    setToolMenuOpen(false)
    switch (action.id) {
      case 'dialogueRewrite':
        props.onOpenDialogueRewrite(dialogueSelection)
        break
      case 'worldConsistency':
        props.onOpenWorldConsistency()
        break
      case 'directorPanel':
        props.onOpenDirectorPanel()
        break
      case 'canonPack':
        props.onOpenCanonPack()
        break
      case 'visualStudio':
        props.onOpenVisualStudio()
        break
      case 'writingIntel':
        props.onOpenWritingIntel()
        break
      case 'marketScanDeconstruct':
        props.onOpenMarketScanDeconstruct()
        break
      case 'mcpSettings':
        props.onOpenMcpSettings()
        break
      case 'citationsManager':
        props.onOpenCitationsManager()
        break
      case 'teamManagement':
        props.onOpenTeamManagement()
        break
      case 'aiSettings':
        props.onOpenAiSettings()
        break
    }
  }

  return (
    <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
        <Bot size={17} className="text-[var(--accent-primary)]" />
        <span className="min-w-0 truncate">{props.title}</span>
        <span
          className="max-w-[132px] shrink-0 truncate rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-secondary)]"
          title={`当前 AI 账号：${props.providerLabel}`}
        >
          {props.providerLabel}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
        <div className="relative" ref={toolMenuRef}>
          <button
            type="button"
            onClick={() => setToolMenuOpen((open) => !open)}
            title="AI 工具与设置"
            aria-label="AI 工具与设置"
            aria-haspopup="menu"
            aria-expanded={toolMenuOpen}
            className={`rounded p-1.5 ${
              toolMenuOpen
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-secondary)]'
            }`}
          >
            <MoreHorizontal size={16} />
          </button>
          {toolMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-[260px] rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] py-1 shadow-xl"
            >
              {toolGroups.map((group, index) => (
                <div key={group.id}>
                  {index > 0 && <div className="my-1 border-t border-[var(--border-primary)]" />}
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {group.label}
                  </div>
                  {group.actions.map((action) => (
                    <button
                      key={action.id}
                      role="menuitem"
                      type="button"
                      onClick={() => runToolAction(action)}
                      title={action.title}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      <AssistantToolIcon id={action.id} />
                      <span className="min-w-0 truncate">{action.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
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

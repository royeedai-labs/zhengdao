import type { ReactNode } from 'react'
import { AlertCircle, Lightbulb, Users } from 'lucide-react'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useCharacterStore } from '@/stores/character-store'
import { useUIStore } from '@/stores/ui-store'
import type { RightPanelTab } from '@/utils/workspace-layout'
import ForeshadowBoard from './ForeshadowBoard'
import ActiveCharacters from './ActiveCharacters'
import QuickNotes from './QuickNotes'

function ContextTabButton({
  tab,
  active,
  label,
  count,
  icon,
  onClick
}: {
  tab: RightPanelTab
  active: boolean
  label: string
  count?: number
  icon: ReactNode
  onClick: (tab: RightPanelTab) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onClick(tab)}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-[11px] font-semibold transition ${
        active
          ? 'border-[var(--accent-primary)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
          : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-muted)]">
          {count}
        </span>
      )}
    </button>
  )
}

export default function RightPanel() {
  const rightPanelTab = useUIStore((s) => s.rightPanelTab)
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab)
  const warningCount = useForeshadowStore((s) => s.getWarningCount())
  const characterCount = useCharacterStore((s) => s.characters.length)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex shrink-0 border-b border-[var(--border-primary)] bg-[var(--surface-secondary)]" role="tablist">
        <ContextTabButton
          tab="foreshadow"
          active={rightPanelTab === 'foreshadow'}
          label="伏笔"
          count={warningCount}
          icon={<AlertCircle size={13} />}
          onClick={setRightPanelTab}
        />
        <ContextTabButton
          tab="characters"
          active={rightPanelTab === 'characters'}
          label="角色"
          count={characterCount}
          icon={<Users size={13} />}
          onClick={setRightPanelTab}
        />
        <ContextTabButton
          tab="notes"
          active={rightPanelTab === 'notes'}
          label="灵感"
          icon={<Lightbulb size={13} />}
          onClick={setRightPanelTab}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightPanelTab === 'foreshadow' && <ForeshadowBoard />}
        {rightPanelTab === 'characters' && <ActiveCharacters />}
        {rightPanelTab === 'notes' && <QuickNotes />}
      </div>
    </div>
  )
}

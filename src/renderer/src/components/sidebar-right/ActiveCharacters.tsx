import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useCharacterStore } from '@/stores/character-store'
import { useConfigStore } from '@/stores/config-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useUIStore } from '@/stores/ui-store'

const FACTION_UI: Record<
  string,
  { bar: string; name: string; badge: string; hoverBorder: string }
> = {
  indigo: {
    bar: 'bg-[var(--accent-primary)]',
    name: 'text-[var(--accent-secondary)]',
    badge: 'bg-[var(--accent-surface)] border border-[var(--accent-border)] text-[var(--accent-secondary)]',
    hoverBorder: 'hover:border-[var(--accent-border)]'
  },
  red: {
    bar: 'bg-[var(--danger-primary)]',
    name: 'text-[var(--danger-primary)]',
    badge: 'bg-[var(--danger-surface)] border border-[var(--danger-border)] text-[var(--danger-primary)]',
    hoverBorder: 'hover:border-[var(--danger-border)]'
  },
  amber: {
    bar: 'bg-[var(--warning-primary)]',
    name: 'text-[var(--warning-primary)]',
    badge: 'bg-[var(--warning-surface)] border border-[var(--warning-border)] text-[var(--warning-primary)]',
    hoverBorder: 'hover:border-[var(--warning-border)]'
  },
  slate: {
    bar: 'bg-[var(--text-muted)]',
    name: 'text-[var(--text-primary)]',
    badge: 'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)]',
    hoverBorder: 'hover:border-[var(--border-secondary)]'
  }
}

export default function ActiveCharacters() {
  const characters = useCharacterStore((s) => s.characters)
  const config = useConfigStore((s) => s.config)
  const openModal = useUIStore((s) => s.openModal)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const factionLabels = config?.faction_labels || []
  const [filter, setFilter] = useState<'all' | 'current'>('all')
  const [currentCharIds, setCurrentCharIds] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    const chapterId = currentChapter?.id
    if (!chapterId) return

    const fetchAppearances = async () => {
      try {
        const ids: number[] = await window.api.getChapterAppearances(chapterId)
        if (!cancelled) setCurrentCharIds(ids)
      } catch {
        if (!cancelled) setCurrentCharIds([])
      }
    }
    void fetchAppearances()
    return () => {
      cancelled = true
    }
  }, [currentChapter?.id])

  const currentCharIdSet = useMemo(
    () => new Set(currentChapter?.id ? currentCharIds : []),
    [currentChapter?.id, currentCharIds]
  )

  const getFactionUi = (faction: string) => {
    const f = factionLabels.find((l) => l.value === faction)
    const key = f?.color && FACTION_UI[f.color] ? f.color : 'slate'
    return FACTION_UI[key] || FACTION_UI.slate
  }

  const filteredChars =
    filter === 'current'
      ? characters.filter((c) => currentCharIdSet.has(c.id))
      : characters

  const displayChars = filteredChars.slice(0, 12)

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center uppercase tracking-wider">
          <Users size={14} className="mr-1.5 text-[var(--accent-primary)]" /> 角色速览
        </h3>
        <div className="flex text-[9px] bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)] overflow-hidden">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 transition ${filter === 'all' ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            全部
          </button>
          <button
            onClick={() => setFilter('current')}
            className={`px-2 py-0.5 transition ${filter === 'current' ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            本章
          </button>
        </div>
      </div>
      {displayChars.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)] text-center py-2">
          {filter === 'current' ? '本章暂无出场角色' : '暂无角色'}
        </p>
      ) : (
        <div className="space-y-2">
          {displayChars.map((char) => {
            const ui = getFactionUi(char.faction)
            const inChapter = currentCharIdSet.has(char.id)
            return (
              <div
                key={char.id}
                onClick={() => openModal('character', { ...char })}
                className={`bg-[var(--surface-secondary)] p-3 rounded border border-[var(--border-primary)] ${ui.hoverBorder} cursor-pointer transition-colors shadow-sm relative overflow-hidden`}
              >
                <div className={`absolute top-0 left-0 w-1 h-full ${ui.bar}`} />
                <div className="flex justify-between items-center pl-2">
                  <span className={`font-bold ${ui.name} text-sm tracking-wide`}>
                    {char.name}
                    {inChapter && filter === 'all' && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--success-primary)] align-middle" title="本章出场" />
                    )}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ui.badge}`}>
                    {factionLabels.find((l) => l.value === char.faction)?.label || char.faction}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

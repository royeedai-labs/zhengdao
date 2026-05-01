import { useEffect, useMemo, useState } from 'react'
import { Users, X, Search, UserPlus, Trash2, Scale, GitBranch, LayoutGrid, ScanLine } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useCharacterStore } from '@/stores/character-store'
import { useConfigStore } from '@/stores/config-store'
import { useBookStore } from '@/stores/book-store'
import RelationGraph from '@/components/characters/RelationGraph'
import AppearanceTimeline from '@/components/characters/AppearanceTimeline'
import type { Character, CharacterRelation } from '@/types'
import { RELATION_TYPES, relationColor, relationTypeLabel } from '@/constants/relation-types'

type LibTab = 'list' | 'graph' | 'timeline'

export default function FullCharactersModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const pushModal = useUIStore((s) => s.pushModal)
  const bookId = useBookStore((s) => s.currentBookId)!
  const { characters, deleteCharacter } = useCharacterStore()
  const config = useConfigStore((s) => s.config)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<LibTab>('list')
  const [relations, setRelations] = useState<CharacterRelation[]>([])
  const [graphSel, setGraphSel] = useState<number | null>(null)

  const [chapterList, setChapterList] = useState<Array<{ id: number; title: string }>>([])
  const [appearPairs, setAppearPairs] = useState<{ character_id: number; chapter_id: number }[]>([])

  const [relSource, setRelSource] = useState<number | ''>('')
  const [relTarget, setRelTarget] = useState<number | ''>('')
  const [relType, setRelType] = useState(RELATION_TYPES[0]?.value ?? 'ally')
  const [relLabel, setRelLabel] = useState('')

  const factionLabels = config?.faction_labels || []

  const factionColor = (faction: string) =>
    factionLabels.find((f) => f.value === faction)?.color ?? '#64748b'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return characters
    return characters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
    )
  }, [characters, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Character[]>()
    for (const c of filtered) {
      const list = map.get(c.faction) || []
      list.push(c)
      map.set(c.faction, list)
    }
    return map
  }, [filtered])

  useEffect(() => {
    if (tab !== 'graph') return
    void window.api.getRelations(bookId).then(setRelations)
  }, [bookId, tab])

  useEffect(() => {
    if (tab !== 'timeline') return
    void Promise.all([
      window.api.getAllChaptersForBook(bookId),
      window.api.getBookAppearances(bookId)
    ]).then(([chs, pairs]) => {
      const list = (chs as Array<{ id: number; title: string }>).map((c) => ({
        id: c.id,
        title: c.title
      }))
      setChapterList(list)
      setAppearPairs(pairs as { character_id: number; chapter_id: number }[])
    })
  }, [bookId, tab])

  const appearanceMap = useMemo(() => {
    const m = new Map<number, Set<number>>()
    for (const p of appearPairs) {
      const set = m.get(p.character_id) ?? new Set<number>()
      set.add(p.chapter_id)
      m.set(p.character_id, set)
    }
    return m
  }, [appearPairs])

  const factionLabel = (value: string) => factionLabels.find((f) => f.value === value)?.label || value

  const handleDelete = (c: Character) => {
    pushModal('confirm', {
      title: '删除角色',
      message: `确定删除角色「${c.name}」吗？`,
      onConfirm: () => deleteCharacter(c.id)
    })
  }

  const refreshRelations = () => {
    void window.api.getRelations(bookId).then(setRelations)
  }

  const handleCreateRelation = async () => {
    if (relSource === '' || relTarget === '' || relSource === relTarget) return
    try {
      await window.api.createRelation(bookId, relSource, relTarget, relType, relLabel.trim())
      setRelLabel('')
      refreshRelations()
    } catch {
      void 0
    }
  }

  const nodeRelations = graphSel
    ? relations.filter((r) => r.source_id === graphSel || r.target_id === graphSel)
    : []

  const graphSelected = graphSel !== null ? characters.find((c) => c.id === graphSel) : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-full max-w-[900px] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <Users size={18} />
            <span>角色总库</span>
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'list'
                ? 'border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent-border)]'
            }`}
          >
            <LayoutGrid size={14} /> 角色列表
          </button>
          <button
            type="button"
            onClick={() => setTab('graph')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'graph'
                ? 'border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent-border)]'
            }`}
          >
            <GitBranch size={14} /> 关系图谱
          </button>
          <button
            type="button"
            onClick={() => setTab('timeline')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'timeline'
                ? 'border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent-border)]'
            }`}
          >
            出场时间线
          </button>
          <div className="flex-1 min-w-[8px]" />
          <button
            type="button"
            onClick={() => pushModal('characterCompare')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)] transition"
          >
            <Scale size={14} /> 对比
          </button>
          <button
            type="button"
            onClick={() => pushModal('consistencyCheck')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-amber-500/50 transition"
          >
            <ScanLine size={14} /> 一致性检查
          </button>
        </div>

        {tab === 'list' && (
          <div className="p-4 border-b border-[var(--border-primary)] flex gap-3 items-center shrink-0">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="按姓名或备注搜索..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
              />
            </div>
            <button
              type="button"
              onClick={() => pushModal('character', { isNew: true })}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] text-xs font-bold rounded-lg transition shrink-0"
            >
              <UserPlus size={14} /> 新建角色
            </button>
          </div>
        )}

        {tab === 'graph' && (
          <div className="p-4 border-b border-[var(--border-primary)] shrink-0 space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">角色 A</label>
                <select
                  value={relSource === '' ? '' : String(relSource)}
                  onChange={(e) => setRelSource(e.target.value ? Number(e.target.value) : '')}
                  className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] min-w-[120px]"
                >
                  <option value="">选择</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">角色 B</label>
                <select
                  value={relTarget === '' ? '' : String(relTarget)}
                  onChange={(e) => setRelTarget(e.target.value ? Number(e.target.value) : '')}
                  className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] min-w-[120px]"
                >
                  <option value="">选择</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">关系类型</label>
                <select
                  value={relType}
                  onChange={(e) => setRelType(e.target.value)}
                  className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] min-w-[100px]"
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">备注（可选）</label>
                <input
                  value={relLabel}
                  onChange={(e) => setRelLabel(e.target.value)}
                  placeholder="关系备注"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)]"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateRelation()}
                className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] text-xs font-bold rounded-lg shrink-0"
              >
                新建关系
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {tab === 'list' && (
            <>
              {filtered.length === 0 ? (
                <p className="text-center text-[var(--text-muted)] text-sm py-12">暂无匹配角色</p>
              ) : (
                Array.from(grouped.entries()).map(([faction, list]) => (
                  <div key={faction}>
                    <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                      {factionLabel(faction)}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {list.map((c) => (
                        <div
                          key={c.id}
                          className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4 hover:border-[var(--accent-border)] transition group relative"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(c)
                            }}
                            className="absolute top-3 right-3 p-1 text-[var(--text-muted)] hover:text-[var(--danger-primary)] opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="text-left w-full"
                            onClick={() => pushModal('character', { ...c })}
                          >
                            <div className="font-bold text-[var(--text-primary)] pr-8">{c.name}</div>
                            <div className="text-[11px] text-[var(--accent-secondary)] mt-1">{factionLabel(c.faction)}</div>
                            <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2">{c.description || '无备注'}</p>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'graph' && (
            <div className="space-y-3">
              <RelationGraph
                characters={characters}
                relations={relations}
                selectedId={graphSel}
                onSelectCharacter={setGraphSel}
              />
              {graphSelected && (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{graphSelected.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">{factionLabel(graphSelected.faction)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => pushModal('character', { ...graphSelected })}
                      className="text-xs text-[var(--accent-secondary)] hover:text-[var(--accent-primary)] shrink-0"
                    >
                      编辑档案
                    </button>
                  </div>
                  {nodeRelations.length > 0 && (
                    <ul className="mt-3 space-y-1 text-[11px] text-[var(--text-secondary)]">
                      {nodeRelations.map((r) => {
                        const other =
                          r.source_id === graphSel
                            ? characters.find((x) => x.id === r.target_id)
                            : characters.find((x) => x.id === r.source_id)
                        const typeLabel = relationTypeLabel(r.relation_type)
                        return (
                          <li key={r.id}>
                            <span style={{ color: relationColor(r.relation_type) }}>
                              {typeLabel}
                            </span>{' '}
                            → {other?.name ?? '?'}
                            {r.label ? ` · ${r.label}` : ''}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <AppearanceTimeline
              characters={characters}
              chapters={chapterList}
              appearanceChapterIds={appearanceMap}
              factionColor={factionColor}
            />
          )}
        </div>
      </div>
    </div>
  )
}

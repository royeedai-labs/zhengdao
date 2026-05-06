import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserRound } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'

interface CharacterRow {
  id: number
  name: string
  faction?: string | null
  status?: string | null
  description?: string
  avatar_path?: string | null
  custom_fields?: Record<string, unknown>
}

interface RelationRow {
  source_id: number
  target_id: number
}

interface AppearanceRow {
  character_id: number
  chapter_id: number
}

interface ChapterMetaRow {
  id: number
  title: string
}

interface VolumeMetaRow {
  title: string
  chapters?: ChapterMetaRow[]
}

interface CharacterCardsApi {
  getCharacters(bookId: number): Promise<CharacterRow[]>
  getRelations(bookId: number): Promise<RelationRow[]>
  getBookAppearances(bookId: number): Promise<AppearanceRow[]>
  getVolumesWithChapterMeta(bookId: number): Promise<VolumeMetaRow[]>
}

interface Props {
  bookId: number
}

export default function CharacterCardsView({ bookId }: Props) {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [relations, setRelations] = useState<RelationRow[]>([])
  const [appearances, setAppearances] = useState<AppearanceRow[]>([])
  const [chapterTitles, setChapterTitles] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const api = window.api as unknown as CharacterCardsApi
        const [chars, rels, appearanceRows, volumeRows] = await Promise.all([
          api.getCharacters(bookId),
          api.getRelations(bookId),
          api.getBookAppearances(bookId),
          api.getVolumesWithChapterMeta(bookId)
        ])
        if (cancelled) return
        setCharacters(chars || [])
        setRelations(rels || [])
        setAppearances(appearanceRows || [])
        const titles = new Map<number, string>()
        for (const volume of volumeRows || []) {
          for (const chapter of volume.chapters || []) {
            titles.set(chapter.id, `${volume.title} / ${chapter.title}`)
          }
        }
        setChapterTitles(titles)
      } catch (err) {
        if (!cancelled) addToast('error', `加载角色卡失败: ${(err as Error).message ?? err}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookId, addToast])

  const relationCounts = useMemo(() => {
    const counts = new Map<number, number>()
    relations.forEach((relation) => {
      counts.set(relation.source_id, (counts.get(relation.source_id) || 0) + 1)
      counts.set(relation.target_id, (counts.get(relation.target_id) || 0) + 1)
    })
    return counts
  }, [relations])

  const appearanceMap = useMemo(() => {
    const map = new Map<number, AppearanceRow[]>()
    appearances.forEach((appearance) => {
      const rows = map.get(appearance.character_id) || []
      rows.push(appearance)
      map.set(appearance.character_id, rows)
    })
    return map
  }, [appearances])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
        <Loader2 size={14} className="mr-2 animate-spin" /> 加载中…
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
        该作品暂无角色卡。
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg-secondary)] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => {
          const customFields = character.custom_fields || {}
          const aliases = Array.isArray(customFields.aliases) ? customFields.aliases.slice(0, 3) : []
          const characterAppearances = appearanceMap.get(character.id) || []
          const latestChapters = characterAppearances
            .slice(-3)
            .map((appearance) => chapterTitles.get(appearance.chapter_id))
            .filter((title): title is string => Boolean(title))
          return (
            <article
              key={character.id}
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--accent-surface)] text-[var(--accent-secondary)]">
                  {character.avatar_path ? (
                    <img src={character.avatar_path} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={22} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{character.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-[var(--text-muted)]">
                    {character.faction && <span>{character.faction}</span>}
                    {character.status && <span>{character.status}</span>}
                    <span>关系 {relationCounts.get(character.id) || 0}</span>
                    <span>出场 {characterAppearances.length}</span>
                  </div>
                </div>
              </div>
              {latestChapters.length > 0 && (
                <div className="mt-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1.5">
                  <div className="text-[10px] text-[var(--text-muted)]">最近出场章节</div>
                  <div className="mt-1 space-y-0.5">
                    {latestChapters.map((title) => (
                      <div key={`${character.id}-${title}`} className="truncate text-[11px] text-[var(--text-secondary)]">
                        {title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {aliases.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {aliases.map((alias) => (
                    <span
                      key={String(alias)}
                      className="rounded border border-[var(--border-primary)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]"
                    >
                      {String(alias)}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">
                {character.description || '暂无角色描述。'}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { CalendarClock, Plus, Save, Trash2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'

/**
 * DI-07 v3.4 — EventsEditor.
 *
 * 编辑 canon_events 表行: title / chapter / type / importance / related
 * characters。CG-A3 TimelineView 消费同一份数据按 chapter_number 排序。
 */

interface CharacterRow {
  id: number
  name: string
}

type EventType = 'plot' | 'character' | 'world' | 'foreshadow'
type Importance = 'low' | 'normal' | 'high'

interface CanonEventRow {
  id: number
  book_id: number
  title: string
  description: string
  chapter_number: number | null
  event_type: EventType
  importance: Importance
  related_character_ids: number[]
}

interface EventDraft extends Partial<CanonEventRow> {
  _key: string
  _new?: boolean
}

interface EventsApi {
  getCanonEvents(bookId: number): Promise<CanonEventRow[]>
  createCanonEvent(input: Record<string, unknown>): Promise<CanonEventRow>
  updateCanonEvent(id: number, patch: Record<string, unknown>): Promise<void>
  deleteCanonEvent(id: number): Promise<void>
  getCharacters(bookId: number): Promise<CharacterRow[]>
}

const EVENT_TYPES: Array<{ id: EventType; label: string }> = [
  { id: 'plot', label: '剧情' },
  { id: 'character', label: '角色' },
  { id: 'world', label: '世界观' },
  { id: 'foreshadow', label: '伏笔' }
]

const IMPORTANCE_OPTS: Array<{ id: Importance; label: string }> = [
  { id: 'low', label: '低' },
  { id: 'normal', label: '普通' },
  { id: 'high', label: '高' }
]

function makeKey(): string {
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface Props {
  bookId: number
}

export default function EventsEditor({ bookId }: Props) {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [rows, setRows] = useState<EventDraft[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  async function load() {
    setLoading(true)
    try {
      const api = window.api as unknown as EventsApi
      const [chars, events] = await Promise.all([api.getCharacters(bookId), api.getCanonEvents(bookId)])
      setCharacters(chars || [])
      setRows((events || []).map((e) => ({ ...e, _key: `e-${e.id}` })))
    } catch (err) {
      addToast('error', `事件数据加载失败: ${(err as Error).message ?? err}`)
    } finally {
      setLoading(false)
    }
  }

  function patchRow(key: string, patch: Partial<EventDraft>) {
    setRows((cur) => cur.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }

  async function saveRow(key: string) {
    const row = rows.find((r) => r._key === key)
    if (!row || !row.title || !row.title.trim()) {
      addToast('warning', '事件标题不能为空')
      return
    }
    const api = window.api as unknown as EventsApi
    const payload = {
      book_id: bookId,
      title: row.title,
      chapter_number: row.chapter_number ?? null,
      event_type: row.event_type ?? 'plot',
      importance: row.importance ?? 'normal',
      related_character_ids: row.related_character_ids ?? []
    }
    try {
      if (row._new) {
        await api.createCanonEvent(payload)
        addToast('success', '事件已创建')
      } else if (row.id) {
        await api.updateCanonEvent(row.id, payload)
        addToast('success', '事件已更新')
      }
      await load()
    } catch (err) {
      addToast('error', `保存失败: ${(err as Error).message ?? err}`)
    }
  }

  async function removeRow(key: string) {
    const row = rows.find((r) => r._key === key)
    if (!row) return
    if (row._new || !row.id) {
      setRows((cur) => cur.filter((r) => r._key !== key))
      return
    }
    const api = window.api as unknown as EventsApi
    try {
      await api.deleteCanonEvent(row.id)
      addToast('success', '事件已删除')
      await load()
    } catch (err) {
      addToast('error', `删除失败: ${(err as Error).message ?? err}`)
    }
  }

  function addBlankRow() {
    setRows((cur) => [
      ...cur,
      {
        _key: makeKey(),
        _new: true,
        title: '',
        chapter_number: null,
        event_type: 'plot',
        importance: 'normal',
        related_character_ids: []
      }
    ])
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <CalendarClock size={14} /> 事件时间线（DI-07 v3）
          <span className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
            {rows.length}
          </span>
        </div>
        <button type="button" onClick={addBlankRow} className="primary-btn !text-xs">
          <Plus size={12} /> 新增事件
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">该作品暂无事件，点击「新增事件」开始维护。</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row._key} className="grid grid-cols-12 gap-2 rounded border border-[var(--border-primary)] p-2 text-xs">
              <input
                type="text"
                value={row.title ?? ''}
                onChange={(e) => patchRow(row._key, { title: e.target.value })}
                placeholder="事件标题"
                className="field col-span-4 !py-1 !text-xs"
              />
              <input
                type="number"
                value={row.chapter_number ?? ''}
                onChange={(e) =>
                  patchRow(row._key, { chapter_number: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="章节"
                className="field col-span-2 !py-1 !text-xs"
              />
              <select
                value={row.event_type ?? 'plot'}
                onChange={(e) => patchRow(row._key, { event_type: e.target.value as EventType })}
                className="field col-span-2 !py-1 !text-xs"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={row.importance ?? 'normal'}
                onChange={(e) => patchRow(row._key, { importance: e.target.value as Importance })}
                className="field col-span-2 !py-1 !text-xs"
              >
                {IMPORTANCE_OPTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <button type="button" onClick={() => void saveRow(row._key)} className="primary-btn !px-2 !py-1 !text-xs">
                  <Save size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => void removeRow(row._key)}
                  className="rounded border border-[var(--border-primary)] px-2 py-1 text-[var(--text-muted)] hover:text-red-500"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              {characters.length > 0 && (
                <div className="col-span-12 flex flex-wrap gap-1 pt-1 text-[11px]">
                  <span className="text-[var(--text-muted)]">关联角色：</span>
                  {characters.map((c) => {
                    const ids = row.related_character_ids ?? []
                    const active = ids.includes(c.id)
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() =>
                          patchRow(row._key, {
                            related_character_ids: active ? ids.filter((id) => id !== c.id) : [...ids, c.id]
                          })
                        }
                        className={`rounded border px-1.5 py-0.5 ${
                          active
                            ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                            : 'border-[var(--border-primary)] text-[var(--text-muted)]'
                        }`}
                      >
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

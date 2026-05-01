import { useEffect, useState } from 'react'
import { ExternalLink, Network, Plus, Save, Trash2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { RELATION_TYPES, normalizeRelationType } from '@/constants/relation-types'

/**
 * DI-07 v3.4 — RelationsEditor.
 *
 * 表格编辑作品的角色关系: from/to/kind/chapter 区间/dynamic。提交后
 * 直接落入桌面 character_relations 表 (含 v24 ALTER 字段)。CG-A3
 * RelationGraphView 消费同一份数据。
 */

interface CharacterRow {
  id: number
  name: string
}

interface RelationRow {
  id: number
  book_id: number
  source_id: number
  target_id: number
  relation_type: string
  label: string
  chapter_range_start: number | null
  chapter_range_end: number | null
  dynamic: number
}

interface RelationDraft extends Partial<RelationRow> {
  _key: string
  _new?: boolean
}

function makeKey(): string {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface RelationsApi {
  getRelations(bookId: number): Promise<RelationRow[]>
  createRelation(
    bookId: number,
    sourceId: number,
    targetId: number,
    relationType: string,
    label: string
  ): Promise<RelationRow>
  updateRelation(id: number, relationType: string, label: string): Promise<void>
  deleteRelation(id: number): Promise<void>
}

interface Props {
  bookId: number
}

export default function RelationsEditor({ bookId }: Props) {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [rows, setRows] = useState<RelationDraft[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((s) => s.addToast)
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)

  function viewGraph() {
    closeModal()
    openModal('canonPack', { initialTab: 'relations' })
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  async function load() {
    setLoading(true)
    try {
      const api = window.api as unknown as RelationsApi & {
        getCharacters(bookId: number): Promise<CharacterRow[]>
      }
      const [chars, relations] = await Promise.all([api.getCharacters(bookId), api.getRelations(bookId)])
      setCharacters(chars || [])
      setRows((relations || []).map((r) => ({ ...r, relation_type: normalizeRelationType(r.relation_type), _key: `r-${r.id}` })))
    } catch (err) {
      addToast('error', `关系数据加载失败: ${(err as Error).message ?? err}`)
    } finally {
      setLoading(false)
    }
  }

  function patchRow(key: string, patch: Partial<RelationDraft>) {
    setRows((cur) => cur.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }

  async function saveRow(key: string) {
    const row = rows.find((r) => r._key === key)
    if (!row || !row.source_id || !row.target_id || !row.relation_type) {
      addToast('warning', '请先选择 from/to/kind 三个字段')
      return
    }
    const api = window.api as unknown as RelationsApi
    try {
      if (row._new) {
        await api.createRelation(bookId, row.source_id, row.target_id, row.relation_type, row.label ?? '')
        addToast('success', '关系已创建')
      } else if (row.id) {
        await api.updateRelation(row.id, row.relation_type, row.label ?? '')
        addToast('success', '关系已更新')
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
    const api = window.api as unknown as RelationsApi
    try {
      await api.deleteRelation(row.id)
      addToast('success', '关系已删除')
      await load()
    } catch (err) {
      addToast('error', `删除失败: ${(err as Error).message ?? err}`)
    }
  }

  function addBlankRow() {
    setRows((cur) => [...cur, { _key: makeKey(), _new: true, relation_type: 'ally', label: '' }])
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Network size={14} /> 关系图谱（DI-07 v3）
          <span className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
            {rows.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={viewGraph}
            className="rounded border border-[var(--border-primary)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)]"
          >
            <ExternalLink size={11} className="mr-1 inline" />查看图
          </button>
          <button type="button" onClick={addBlankRow} className="primary-btn !text-xs">
            <Plus size={12} /> 新增关系
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">加载中…</p>
      ) : characters.length < 2 ? (
        <p className="text-xs text-[var(--text-muted)]">至少需要 2 个角色才能维护关系，先去角色卡创建。</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">该作品暂无关系，点击「新增关系」开始维护。</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-[var(--text-muted)]">
            <tr>
              <th className="py-1 pr-2">From</th>
              <th className="py-1 pr-2">To</th>
              <th className="py-1 pr-2">类型</th>
              <th className="py-1 pr-2">标签</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._key} className="border-t border-[var(--border-primary)]">
                <td className="py-1 pr-2">
                  <select
                    value={row.source_id ?? ''}
                    onChange={(e) => patchRow(row._key, { source_id: Number(e.target.value) || undefined })}
                    className="field !py-1 !text-xs"
                  >
                    <option value="">— 选择 —</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <select
                    value={row.target_id ?? ''}
                    onChange={(e) => patchRow(row._key, { target_id: Number(e.target.value) || undefined })}
                    className="field !py-1 !text-xs"
                  >
                    <option value="">— 选择 —</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <select
                    value={row.relation_type ?? 'ally'}
                    onChange={(e) => patchRow(row._key, { relation_type: e.target.value })}
                    className="field !py-1 !text-xs"
                  >
                    {RELATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    value={row.label ?? ''}
                    onChange={(e) => patchRow(row._key, { label: e.target.value })}
                    placeholder="自由备注"
                    className="field !py-1 !text-xs"
                  />
                </td>
                <td className="py-1 text-right">
                  <button type="button" onClick={() => void saveRow(row._key)} className="primary-btn !px-2 !py-1 !text-xs">
                    <Save size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeRow(row._key)}
                    className="ml-1 rounded border border-[var(--border-primary)] px-2 py-1 text-[var(--text-muted)] hover:text-red-500"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Building2, ExternalLink, Plus, Save, Trash2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'

/**
 * DI-07 v3.4 — OrganizationsEditor.
 *
 * 编辑 canon_organizations 树: name/parent/type。父节点选择器仅限同
 * book 内已存在的组织。CG-A3 OrgChartView 消费 getCanonOrgTree 输出的
 * 递归结构。
 */

type OrgType = 'group' | 'faction' | 'company' | 'department'

interface CanonOrgRow {
  id: number
  book_id: number
  name: string
  description: string
  parent_id: number | null
  org_type: OrgType
}

interface OrgDraft extends Partial<CanonOrgRow> {
  _key: string
  _new?: boolean
}

interface OrgsApi {
  getCanonOrgs(bookId: number): Promise<CanonOrgRow[]>
  createCanonOrg(input: Record<string, unknown>): Promise<CanonOrgRow>
  updateCanonOrg(id: number, patch: Record<string, unknown>): Promise<void>
  deleteCanonOrg(id: number): Promise<void>
}

const ORG_TYPES: Array<{ id: OrgType; label: string }> = [
  { id: 'group', label: '组织' },
  { id: 'faction', label: '派系' },
  { id: 'company', label: '公司' },
  { id: 'department', label: '部门' }
]

function makeKey(): string {
  return `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface Props {
  bookId: number
}

export default function OrganizationsEditor({ bookId }: Props) {
  const [rows, setRows] = useState<OrgDraft[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((s) => s.addToast)
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)

  function viewGraph() {
    closeModal()
    openModal('canonPack', { initialTab: 'orgchart' })
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  async function load() {
    setLoading(true)
    try {
      const api = window.api as unknown as OrgsApi
      const orgs = await api.getCanonOrgs(bookId)
      setRows((orgs || []).map((o) => ({ ...o, _key: `o-${o.id}` })))
    } catch (err) {
      addToast('error', `组织数据加载失败: ${(err as Error).message ?? err}`)
    } finally {
      setLoading(false)
    }
  }

  function patchRow(key: string, patch: Partial<OrgDraft>) {
    setRows((cur) => cur.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }

  async function saveRow(key: string) {
    const row = rows.find((r) => r._key === key)
    if (!row || !row.name || !row.name.trim()) {
      addToast('warning', '组织名称不能为空')
      return
    }
    const api = window.api as unknown as OrgsApi
    const payload = {
      book_id: bookId,
      name: row.name,
      description: row.description ?? '',
      parent_id: row.parent_id ?? null,
      org_type: row.org_type ?? 'group'
    }
    try {
      if (row._new) {
        await api.createCanonOrg(payload)
        addToast('success', '组织已创建')
      } else if (row.id) {
        await api.updateCanonOrg(row.id, payload)
        addToast('success', '组织已更新')
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
    const api = window.api as unknown as OrgsApi
    try {
      await api.deleteCanonOrg(row.id)
      addToast('success', '组织已删除')
      await load()
    } catch (err) {
      addToast('error', `删除失败: ${(err as Error).message ?? err}`)
    }
  }

  function addBlankRow() {
    setRows((cur) => [
      ...cur,
      { _key: makeKey(), _new: true, name: '', description: '', parent_id: null, org_type: 'group' }
    ])
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Building2 size={14} /> 组织架构（DI-07 v3）
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
            <Plus size={12} /> 新增组织
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">该作品暂无组织，点击「新增组织」开始维护。</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row._key} className="grid grid-cols-12 gap-2 rounded border border-[var(--border-primary)] p-2 text-xs">
              <input
                type="text"
                value={row.name ?? ''}
                onChange={(e) => patchRow(row._key, { name: e.target.value })}
                placeholder="组织名称"
                className="field col-span-4 !py-1 !text-xs"
              />
              <select
                value={row.org_type ?? 'group'}
                onChange={(e) => patchRow(row._key, { org_type: e.target.value as OrgType })}
                className="field col-span-2 !py-1 !text-xs"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={row.parent_id ?? ''}
                onChange={(e) =>
                  patchRow(row._key, { parent_id: e.target.value === '' ? null : Number(e.target.value) })
                }
                className="field col-span-3 !py-1 !text-xs"
              >
                <option value="">— 顶层 —</option>
                {rows
                  .filter((other) => other.id && !other._new && other.id !== row.id)
                  .map((other) => (
                    <option key={other.id} value={other.id ?? undefined}>
                      {other.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={row.description ?? ''}
                onChange={(e) => patchRow(row._key, { description: e.target.value })}
                placeholder="备注"
                className="field col-span-2 !py-1 !text-xs"
              />
              <div className="col-span-1 flex items-center justify-end gap-1">
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import Tree from 'react-d3-tree'
import { Building2, Loader2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { mapOrganizationsToTree, type CanonOrgRow } from './data-mappers/organizations-to-tree'

/**
 * CG-A3.2 — OrgChartView.
 *
 * react-d3-tree 自带 collapsible nodes (默认开启)。当只有一个根节点时
 * 直接渲染单棵树, 多根时通过 mapOrganizationsToTree({ forest: false })
 * 包一层「组织总览」虚拟根。
 */

interface OrgChartApi {
  getCanonOrgs(bookId: number): Promise<CanonOrgRow[]>
}

interface Props {
  bookId: number
}

export default function OrgChartView({ bookId }: Props) {
  const [orgs, setOrgs] = useState<CanonOrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const api = window.api as unknown as OrgChartApi
        const rows = await api.getCanonOrgs(bookId)
        if (cancelled) return
        setOrgs(rows || [])
      } catch (err) {
        if (!cancelled) addToast('error', `加载组织失败: ${(err as Error).message ?? err}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookId, addToast])

  const tree = useMemo(() => mapOrganizationsToTree(orgs, { forest: false }), [orgs])

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <Building2 size={12} /> 组织 {orgs.length}
      </div>
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="mr-2 animate-spin" /> 加载中…
          </div>
        ) : tree.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            该作品暂无组织，去 AI 设置 → 组织架构面板维护。
          </div>
        ) : (
          <Tree
            data={tree[0]!}
            orientation="vertical"
            translate={{ x: 200, y: 60 }}
            collapsible
            initialDepth={2}
            pathFunc="step"
            zoomable
          />
        )}
      </div>
    </div>
  )
}

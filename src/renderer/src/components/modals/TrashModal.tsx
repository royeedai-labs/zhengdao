import { useCallback, useEffect, useState } from 'react'
import { ArchiveRestore, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'

type TrashKind = 'chapter' | 'volume' | 'character' | 'foreshadowing'

type TrashBundle = {
  chapters: Array<{ kind: 'chapter'; id: number; title: string; deleted_at: string; volume_title: string }>
  volumes: Array<{ kind: 'volume'; id: number; title: string; deleted_at: string }>
  characters: Array<{ kind: 'character'; id: number; name: string; deleted_at: string }>
  foreshadowings: Array<{ kind: 'foreshadowing'; id: number; text: string; deleted_at: string }>
}

function daysSince(iso: string): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

export default function TrashModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const pushModal = useUIStore((s) => s.pushModal)
  const currentBookId = useBookStore((s) => s.currentBookId)
  const loadVolumes = useChapterStore((s) => s.loadVolumes)
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)
  const loadForeshadowings = useForeshadowStore((s) => s.loadForeshadowings)

  const [bundle, setBundle] = useState<TrashBundle | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!currentBookId) {
      setBundle(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = (await window.api.getTrashItems(currentBookId)) as TrashBundle
      setBundle(data)
    } finally {
      setLoading(false)
    }
  }, [currentBookId])

  useEffect(() => {
    let cancelled = false

    const loadTrash = async () => {
      if (!currentBookId) {
        if (!cancelled) {
          setBundle(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const data = (await window.api.getTrashItems(currentBookId)) as TrashBundle
        if (!cancelled) setBundle(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTrash()
    return () => {
      cancelled = true
    }
  }, [currentBookId])

  const onRestore = async (kind: TrashKind, id: number) => {
    await window.api.restoreItem(kind, id)
    if (currentBookId) {
      await loadVolumes(currentBookId)
      await loadCharacters(currentBookId)
      await loadForeshadowings(currentBookId)
    }
    await reload()
  }

  const onPermanent = async (kind: TrashKind, id: number) => {
    await window.api.permanentDeleteItem(kind, id)
    await reload()
  }

  const onEmptyTrash = () => {
    if (!currentBookId) return
    pushModal('confirm', {
      title: '清空回收站',
      message: '将永久删除回收站内的所有项目，此操作不可恢复。',
      onConfirm: async () => {
        await window.api.emptyTrash(currentBookId)
        if (currentBookId) {
          await loadVolumes(currentBookId)
          await loadCharacters(currentBookId)
          await loadForeshadowings(currentBookId)
        }
        await reload()
      }
    })
  }

  const renderItem = (
    label: string,
    sub: string,
    deletedAt: string,
    kind: TrashKind,
    id: number
  ) => {
    const old = daysSince(deletedAt) >= 30
    return (
      <div
        key={`${kind}-${id}`}
        className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border ${
          old ? 'border-amber-600/40 bg-amber-500/5' : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)]/40'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{label}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</div>
          {old && <div className="text-[10px] text-amber-400/90 mt-1">删除已超过 30 天</div>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void onRestore(kind, id)}
            title="还原"
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--success-border)] text-[var(--success-primary)] hover:bg-[var(--success-surface)]"
          >
            还原
          </button>
          <button
            type="button"
            onClick={() =>
              pushModal('confirm', {
                title: '永久删除',
                message: `确定永久删除「${label}」吗？删除后无法恢复。`,
                onConfirm: async () => {
                  await onPermanent(kind, id)
                }
              })}
            title="永久删除"
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--danger-border)] text-[var(--danger-primary)] hover:bg-[var(--danger-surface)]"
          >
            永久删除
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 pointer-events-auto">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="h-12 border-b border-[var(--border-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold">
            <ArchiveRestore size={18} />
            <span>回收站</span>
          </div>
          <div className="flex items-center gap-2">
            {currentBookId && bundle && totalCount(bundle) > 0 && (
              <button
                type="button"
                onClick={onEmptyTrash}
                className="text-xs px-3 py-1.5 rounded-md border border-[var(--warning-border)] text-[var(--warning-primary)] hover:bg-[var(--warning-surface)]"
              >
                清空回收站
              </button>
            )}
            <button
              onClick={closeModal}
              aria-label="关闭回收站"
              title="关闭回收站"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!currentBookId ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">请先打开一本书</p>
          ) : loading ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">加载中...</p>
          ) : !bundle || totalCount(bundle) === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">回收站是空的</p>
          ) : (
            <>
              {bundle.volumes.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">卷</h3>
                  <div className="space-y-2">
                    {bundle.volumes.map((v) =>
                      renderItem(v.title, `删除于 ${formatDate(v.deleted_at)}`, v.deleted_at, 'volume', v.id)
                    )}
                  </div>
                </section>
              )}
              {bundle.chapters.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">章节</h3>
                  <div className="space-y-2">
                    {bundle.chapters.map((c) =>
                      renderItem(
                        c.title,
                        `${c.volume_title} · 删除于 ${formatDate(c.deleted_at)}`,
                        c.deleted_at,
                        'chapter',
                        c.id
                      )
                    )}
                  </div>
                </section>
              )}
              {bundle.characters.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">人物</h3>
                  <div className="space-y-2">
                    {bundle.characters.map((ch) =>
                      renderItem(ch.name, `删除于 ${formatDate(ch.deleted_at)}`, ch.deleted_at, 'character', ch.id)
                    )}
                  </div>
                </section>
              )}
              {bundle.foreshadowings.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">伏笔</h3>
                  <div className="space-y-2">
                    {bundle.foreshadowings.map((f) =>
                      renderItem(
                        f.text.slice(0, 80) + (f.text.length > 80 ? '…' : ''),
                        `删除于 ${formatDate(f.deleted_at)}`,
                        f.deleted_at,
                        'foreshadowing',
                        f.id
                      )
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function totalCount(b: TrashBundle): number {
  return b.chapters.length + b.volumes.length + b.characters.length + b.foreshadowings.length
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderClosed,
  FileText,
  Plus,
  Users,
  BookOpen,
  GripVertical
} from 'lucide-react'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Chapter } from '@/types'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useConfigStore } from '@/stores/config-store'
import { useWikiStore } from '@/stores/wiki-store'
import { useUIStore } from '@/stores/ui-store'

type LeftTab = 'outline' | 'characters' | 'wiki'

function OutlineTabBar({
  activeTab,
  setActiveTab
}: {
  activeTab: LeftTab
  setActiveTab: (tab: LeftTab) => void
}) {
  return (
    <div className="flex border-b border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[10px] font-medium shrink-0" role="tablist">
      <button
        role="tab"
        aria-selected={activeTab === 'outline'}
        onClick={() => setActiveTab('outline')}
        className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1 ${
          activeTab === 'outline'
            ? 'text-[var(--accent-secondary)] border-b-2 border-[var(--accent-primary)] bg-[var(--accent-surface)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <FileText size={12} /> 大纲
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'characters'}
        onClick={() => setActiveTab('characters')}
        className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1 ${
          activeTab === 'characters'
            ? 'text-[var(--accent-secondary)] border-b-2 border-[var(--accent-primary)] bg-[var(--accent-surface)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Users size={12} /> 人物
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'wiki'}
        onClick={() => setActiveTab('wiki')}
        className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1 ${
          activeTab === 'wiki'
            ? 'text-[var(--accent-secondary)] border-b-2 border-[var(--accent-primary)] bg-[var(--accent-surface)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <BookOpen size={12} /> 设定
      </button>
    </div>
  )
}

function SortableChapterItem({
  ch,
  isCurrent,
  isEditing,
  editText,
  setEditText,
  onSelect,
  onDoubleClickRename,
  onContextMenu,
  finishRename,
  cancelEdit
}: {
  ch: Chapter
  isCurrent: boolean
  isEditing: boolean
  editText: string
  setEditText: (t: string) => void
  onSelect: () => void
  onDoubleClickRename: () => void
  onContextMenu: (e: React.MouseEvent) => void
  finishRename: () => void
  cancelEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      onDoubleClick={onDoubleClickRename}
      onContextMenu={onContextMenu}
      className={`group flex items-center py-1.5 rounded cursor-pointer px-2 transition ${
        isDragging ? 'opacity-50 z-10' : ''
      } ${
        isCurrent
          ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)] border border-[var(--accent-border)] shadow-sm'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
      }`}
    >
      <button
        type="button"
        className="shrink-0 mr-0.5 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="拖拽排序"
      >
        <GripVertical size={14} />
      </button>
      <FileText size={14} className="mr-2 shrink-0 opacity-60" />
      {isEditing ? (
        <input
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={finishRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finishRename()
            if (e.key === 'Escape') cancelEdit()
          }}
          className="flex-1 bg-transparent border-b border-[var(--accent-primary)] outline-none text-[var(--text-primary)] text-sm"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="truncate"
          title={ch.summary?.trim() ? ch.summary : undefined}
        >
          {ch.title}
        </span>
      )}
    </div>
  )
}

function CharacterList() {
  const { characters } = useCharacterStore()
  const config = useConfigStore((s) => s.config)
  const { openModal, pushModal } = useUIStore()
  const factionLabels = config?.faction_labels || []
  const factionLabel = (value: string) => factionLabels.find((f) => f.value === value)?.label || value

  type CharType = typeof characters[number]
  const grouped = new Map<string, CharType[]>()
  for (const c of characters) {
    const list = grouped.get(c.faction) || []
    list.push(c)
    grouped.set(c.faction, list)
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 text-sm space-y-3">
      {characters.length === 0 ? (
        <div className="text-center text-[var(--text-muted)] text-xs py-8">
          <p className="mb-2">还没有角色</p>
          <button onClick={() => openModal('character', { isNew: true })} className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)]">
            创建第一个角色
          </button>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([faction, list]) => (
          <div key={faction}>
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-1">
              {factionLabel(faction)}
            </div>
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pushModal('character', { ...c })}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-tertiary)] transition"
              >
                <div className="w-6 h-6 rounded-full bg-[var(--accent-surface)] border border-[var(--accent-border)] flex items-center justify-center text-[10px] text-[var(--accent-secondary)] font-bold shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--text-primary)] truncate">{c.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{c.description || '无备注'}</div>
                </div>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function WikiList() {
  const bookId = useBookStore((s) => s.currentBookId)!
  const { categories, entries, selectedCategory, selectCategory, loadEntries, loadCategories } = useWikiStore()
  const openModal = useUIStore((s) => s.openModal)

  useEffect(() => {
    loadCategories(bookId)
  }, [bookId, loadCategories])

  return (
    <div className="flex-1 overflow-y-auto text-sm">
      <div className="flex gap-1 p-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              selectCategory(cat)
              loadEntries(bookId, cat)
            }}
            className={`px-2 py-0.5 text-[10px] rounded border transition ${
              selectedCategory === cat
                ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="p-2 space-y-1">
        {entries.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] text-xs py-6">无条目</p>
        ) : (
          entries.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => openModal('settings')}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--bg-tertiary)] transition"
            >
              <div className="text-xs text-[var(--text-primary)] truncate">{e.title}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">{e.content?.slice(0, 40) || '无内容'}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default function OutlineTree() {
  const bookId = useBookStore((s) => s.currentBookId)!
  const {
    volumes,
    currentChapter,
    selectChapter,
    updateVolumeTitle,
    updateChapterTitle,
    deleteVolume,
    deleteChapter,
    reorderChapters
  } = useChapterStore()
  const openModal = useUIStore((s) => s.openModal)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [activeTab, setActiveTab] = useState<LeftTab>('outline')
  const [collapsedVols, setCollapsedVols] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<{ type: 'vol' | 'ch'; id: number } | null>(null)
  const [editText, setEditText] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'vol' | 'ch' | 'bg'
    id?: number
  } | null>(null)
  const expandedVols = useMemo(
    () => new Set(volumes.map((volume) => volume.id).filter((id) => !collapsedVols.has(id))),
    [collapsedVols, volumes]
  )

  const toggleVol = (id: number) => {
    setCollapsedVols((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startRename = (type: 'vol' | 'ch', id: number, currentTitle: string) => {
    setEditingId({ type, id })
    setEditText(currentTitle)
    setContextMenu(null)
  }

  const finishRename = async () => {
    if (!editingId || !editText.trim()) {
      setEditingId(null)
      return
    }
    if (editingId.type === 'vol') await updateVolumeTitle(editingId.id, editText.trim())
    else await updateChapterTitle(editingId.id, editText.trim())
    setEditingId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, type: 'vol' | 'ch' | 'bg', id?: number) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, type, id })
  }

  const handleDeleteVol = (id: number) => {
    setContextMenu(null)
    openModal('confirm', {
      title: '删除卷',
      message: '将同时删除该卷下所有章节及关联数据，确定删除？',
      onConfirm: () => deleteVolume(id)
    })
  }

  const handleDeleteCh = (id: number) => {
    setContextMenu(null)
    openModal('confirm', {
      title: '删除章节',
      message: '将同时删除该章节的所有关联数据（伏笔、快照、出场记录），确定删除？',
      onConfirm: () => deleteChapter(id)
    })
  }

  const handleChapterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const overId = Number(over.id)
    if (activeId === overId) return
    const vol = volumes.find((v) => v.chapters?.some((c) => c.id === activeId))
    const volOver = volumes.find((v) => v.chapters?.some((c) => c.id === overId))
    if (!vol?.chapters || vol.id !== volOver?.id) return
    const oldIndex = vol.chapters.findIndex((c) => c.id === activeId)
    const newIndex = vol.chapters.findIndex((c) => c.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    const chapterIds = arrayMove(vol.chapters, oldIndex, newIndex).map((c) => c.id)
    void reorderChapters(vol.id, chapterIds)
  }

  if (activeTab === 'characters') {
    return (
      <div className="flex flex-col h-full">
        <OutlineTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        <CharacterList />
      </div>
    )
  }

  if (activeTab === 'wiki') {
    return (
      <div className="flex flex-col h-full">
        <OutlineTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        <WikiList />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)} onContextMenu={(e) => handleContextMenu(e, 'bg')}>
      <OutlineTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 min-h-0 flex flex-col">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChapterDragEnd}>
          <div className="flex-1 overflow-y-auto p-2 text-sm space-y-0.5 min-h-0">
          {volumes.length === 0 && (
            <div className="text-center text-[var(--text-muted)] text-xs py-8">
              <p className="mb-2">还没有内容</p>
              <button onClick={() => openModal('newVolume', { book_id: bookId })} className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)]">
                点击 + 创建第一卷
              </button>
            </div>
          )}
          {volumes.map((vol) => (
            <div key={vol.id}>
              <div
                className="flex items-center text-[var(--text-primary)] py-1.5 px-2 group cursor-pointer hover:bg-[var(--bg-tertiary)] rounded"
                onClick={() => toggleVol(vol.id)}
                onDoubleClick={() => startRename('vol', vol.id, vol.title)}
                onContextMenu={(e) => handleContextMenu(e, 'vol', vol.id)}
              >
                {expandedVols.has(vol.id) ? (
                  <ChevronDown size={14} className="mr-1 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight size={14} className="mr-1 text-[var(--text-muted)]" />
                )}
                {expandedVols.has(vol.id) ? (
                  <FolderOpen size={14} className="mr-2 text-[var(--accent-primary)]" />
                ) : (
                  <FolderClosed size={14} className="mr-2 text-[var(--accent-primary)]" />
                )}
                {editingId?.type === 'vol' && editingId.id === vol.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 bg-transparent border-b border-[var(--accent-primary)] outline-none text-[var(--text-primary)] text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="font-medium truncate">{vol.title}</span>
                )}
              </div>
              {expandedVols.has(vol.id) && (
                <div className="pl-7 space-y-0.5">
                  <SortableContext
                    items={(vol.chapters || []).map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(vol.chapters || []).map((ch) => (
                      <SortableChapterItem
                        key={ch.id}
                        ch={ch}
                        isCurrent={currentChapter?.id === ch.id}
                        isEditing={editingId?.type === 'ch' && editingId.id === ch.id}
                        editText={editText}
                        setEditText={setEditText}
                        onSelect={() => selectChapter(ch.id)}
                        onDoubleClickRename={() => startRename('ch', ch.id, ch.title)}
                        onContextMenu={(e) => handleContextMenu(e, 'ch', ch.id)}
                        finishRename={finishRename}
                        cancelEdit={() => setEditingId(null)}
                      />
                    ))}
                  </SortableContext>
                </div>
              )}
            </div>
          ))}
          </div>
        </DndContext>
      </div>
      <div className="border-t border-[var(--border-primary)] p-2 flex gap-1 bg-[var(--surface-secondary)]">
        <button
          onClick={() => openModal('newVolume', { book_id: bookId })}
          className="flex-1 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:bg-[var(--bg-tertiary)] rounded transition flex items-center justify-center gap-1"
        >
          <Plus size={12} /> 新建卷
        </button>
        {volumes.length > 0 && (
          <button
            onClick={() => openModal('newChapter', { volume_id: volumes[volumes.length - 1].id })}
            className="flex-1 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:bg-[var(--bg-tertiary)] rounded transition flex items-center justify-center gap-1"
          >
            <Plus size={12} /> 新建章
          </button>
        )}
      </div>
      {contextMenu && (
        <div
          className="fixed bg-[var(--surface-elevated)] border border-[var(--border-primary)] rounded-lg shadow-xl py-1 z-50 min-w-[140px] text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'bg' && (
            <button
              onClick={() => {
                setContextMenu(null)
                openModal('newVolume', { book_id: bookId })
              }}
              className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
            >
              新建卷
            </button>
          )}
          {contextMenu.type === 'vol' && contextMenu.id && (
            <>
              <button
                onClick={() => {
                  setContextMenu(null)
                  openModal('newChapter', { volume_id: contextMenu.id })
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              >
                新建章节
              </button>
              <button
                onClick={() => {
                  const v = volumes.find((x) => x.id === contextMenu.id)
                  if (v) startRename('vol', v.id, v.title)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              >
                重命名
              </button>
              <div className="border-t border-[var(--border-primary)] my-1" />
              <button
                onClick={() => handleDeleteVol(contextMenu.id!)}
                className="w-full px-3 py-1.5 text-left text-[var(--danger-primary)] hover:bg-[var(--danger-surface)] transition"
              >
                删除卷
              </button>
            </>
          )}
          {contextMenu.type === 'ch' && contextMenu.id && (
            <>
              <button
                onClick={() => {
                  const allChs = volumes.flatMap((v) => v.chapters || [])
                  const ch = allChs.find((c) => c.id === contextMenu.id)
                  if (ch) startRename('ch', ch.id, ch.title)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              >
                重命名
              </button>
              <div className="border-t border-[var(--border-primary)] my-1" />
              <button
                onClick={() => handleDeleteCh(contextMenu.id!)}
                className="w-full px-3 py-1.5 text-left text-[var(--danger-primary)] hover:bg-[var(--danger-surface)] transition"
              >
                删除章节
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

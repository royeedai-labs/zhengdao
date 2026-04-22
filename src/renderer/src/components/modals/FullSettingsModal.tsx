import { useEffect, useState } from 'react'
import { BookOpen, X, Plus, Save, Trash2 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useWikiStore } from '@/stores/wiki-store'
import type { WikiEntry } from '@/types'

export default function FullSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const pushModal = useUIStore((s) => s.pushModal)
  const bookId = useBookStore((s) => s.currentBookId)!
  const {
    categories,
    entries,
    selectedCategory,
    loading,
    loadCategories,
    loadEntries,
    selectCategory,
    createEntry,
    updateEntry,
    deleteEntry
  } = useWikiStore()

  const [selectedEntry, setSelectedEntry] = useState<WikiEntry | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [newCatName, setNewCatName] = useState('')

  useEffect(() => {
    void loadCategories(bookId)
  }, [bookId, loadCategories])

  useEffect(() => {
    if (!selectedCategory) return
    void loadEntries(bookId, selectedCategory)
  }, [bookId, selectedCategory, loadEntries])

  const resetEditor = () => {
    setSelectedEntry(null)
    setTitle('')
    setContent('')
  }

  const pickEntry = (e: WikiEntry) => {
    setSelectedEntry(e)
    setTitle(e.title)
    setContent(e.content)
  }

  const handleSave = async () => {
    if (!selectedCategory || !title.trim()) return
    if (selectedEntry) {
      await updateEntry(selectedEntry.id, { title: title.trim(), content })
    } else {
      const entry = await createEntry({
        book_id: bookId,
        category: selectedCategory,
        title: title.trim(),
        content
      })
      setSelectedEntry(entry)
      setTitle(entry.title)
      setContent(entry.content)
    }
  }

  const handleNewEntry = () => {
    resetEditor()
  }

  const handleDeleteEntry = async () => {
    if (!selectedEntry) return
    await deleteEntry(selectedEntry.id)
    resetEditor()
  }

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    await createEntry({ book_id: bookId, category: name, title: '占位条目', content: '' })
    setNewCatName('')
    await loadCategories(bookId)
    selectCategory(name)
    resetEditor()
    await loadEntries(bookId, name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-full max-w-[1000px] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <BookOpen size={18} />
            <span>设定维基</span>
          </div>
          <button
            onClick={closeModal}
            aria-label="关闭设定维基"
            title="关闭设定维基"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <aside className="w-52 border-r border-[var(--border-primary)] bg-[var(--bg-primary)] flex flex-col shrink-0">
            <div className="p-2 border-b border-[var(--border-primary)] space-y-2">
              <div className="flex gap-1">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="新分类名"
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  title="新增分类"
                  aria-label="新增分类"
                  className="p-1.5 border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)] rounded hover:bg-[var(--bg-tertiary)]"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    resetEditor()
                    selectCategory(cat)
                    void loadEntries(bookId, cat)
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-xs transition ${
                    selectedCategory === cat
                      ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)] border border-[var(--accent-border)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border border-transparent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border-primary)]">
            <div className="p-3 border-b border-[var(--border-primary)] flex justify-between items-center">
              <span className="text-[11px] text-[var(--text-muted)] uppercase">条目列表</span>
              <button
                type="button"
                onClick={handleNewEntry}
                disabled={!selectedCategory}
                className="text-xs text-[var(--accent-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
              >
                + 新建条目
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <p className="text-xs text-[var(--text-muted)] p-2">加载中...</p>
              ) : (
                entries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pickEntry(e)}
                    className={`w-full text-left px-3 py-2 rounded text-sm border transition ${
                      selectedEntry?.id === e.id
                        ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {e.title}
                  </button>
                ))
              )}
            </div>
          </div>

          <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]">
            <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="条目标题"
                className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent-border)]"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="正文（支持纯文本/Markdown 风格）..."
                className="flex-1 min-h-[200px] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-secondary)] text-sm resize-none focus:outline-none focus:border-[var(--accent-border)]"
              />
            </div>
            <div className="h-14 border-t border-[var(--border-primary)] px-4 flex items-center justify-between shrink-0 bg-[var(--bg-secondary)]">
              <button
                type="button"
                onClick={() => {
                  if (!selectedEntry) return
                  pushModal('confirm', {
                    title: '删除设定条目',
                    message: `确定删除「${selectedEntry.title}」吗？此操作不可撤销。`,
                    onConfirm: async () => {
                      await handleDeleteEntry()
                    }
                  })
                }}
                disabled={!selectedEntry}
                className="flex items-center gap-1 text-xs text-[var(--danger-primary)] hover:brightness-105 disabled:opacity-30"
              >
                <Trash2 size={14} /> 删除条目
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  关闭
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!selectedCategory || !title.trim()}
                  className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded"
                >
                  <Save size={14} /> 保存
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

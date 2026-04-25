import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { PenTool, Plus, Search, LayoutGrid, List, Trash2 } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useUIStore } from '@/stores/ui-store'
import BookCard from './BookCard'
import AppBrand from '@/components/shared/AppBrand'
import AccountSettingsMenu from '@/components/shared/AccountSettingsMenu'
import { getCurrentTitlebarSafeArea } from '@/utils/window-shell'

type SortBy = 'updated' | 'created' | 'words' | 'title'

export default function BookshelfPage() {
  const { books, loadBooks } = useBookStore()
  const openBook = useBookStore((s) => s.openBook)
  const openModal = useUIStore((s) => s.openModal)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [searchQuery, setSearchQuery] = useState('')
  const titlebarSafeArea = getCurrentTitlebarSafeArea()

  const handleTitlebarDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest('button, input, select, textarea, a, [data-no-titlebar-toggle]')) return
    void window.api.toggleMaximize()
  }

  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  const sortedBooks = [...books].sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'words':
        return (b.total_words || 0) - (a.total_words || 0)
      case 'title':
        return a.title.localeCompare(b.title, 'zh-CN')
      default:
        return 0
    }
  })

  const filteredBooks = sortedBooks.filter(
    (b) => !searchQuery || b.title.includes(searchQuery) || (b.author || '').includes(searchQuery)
  )

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      <div
        className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center justify-between shrink-0 drag-region"
        onDoubleClick={handleTitlebarDoubleClick}
        style={{
          paddingLeft: `${titlebarSafeArea.leftInset}px`,
          paddingRight: `${titlebarSafeArea.rightInset}px`
        }}
      >
        <div className="no-drag">
          <AppBrand />
        </div>
        <div className="no-drag flex items-center gap-2">
          <button
            onClick={() => openModal('newBook')}
            className="flex items-center px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] rounded-lg text-sm font-bold transition shadow-lg shadow-[0_10px_24px_rgba(63,111,159,0.16)]"
            data-no-titlebar-toggle
          >
            <Plus size={16} className="mr-1.5" /> 新建作品
          </button>
          <AccountSettingsMenu />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <PenTool size={64} className="text-[var(--text-muted)] mb-6" />
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">开始你的创作之旅</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md">
              证道是为长篇网文作者打造的沉浸式写作工具，帮助你驾驭百万字级别的宏大叙事。
            </p>
            <button
              onClick={() => openModal('newBook')}
              className="px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] rounded-xl text-base font-bold transition shadow-lg shadow-[0_10px_24px_rgba(63,111,159,0.16)]"
            >
              <Plus size={18} className="inline mr-2 -mt-0.5" />
              新建你的第一部作品
            </button>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                我的作品 ({filteredBooks.length})
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded px-2 py-1.5">
                  <Search size={14} className="text-[var(--text-muted)] mr-1.5 shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索作品..."
                    className="bg-transparent border-none focus:outline-none text-xs text-[var(--text-primary)] w-32"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded px-2 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none"
                >
                  <option value="updated">最近编辑</option>
                  <option value="created">创建时间</option>
                  <option value="words">总字数</option>
                  <option value="title">书名</option>
                </select>
                <div className="flex border border-[var(--border-secondary)] rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    aria-label="网格视图"
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    aria-label="列表视图"
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>
            </div>
            {filteredBooks.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-12">没有匹配的作品</p>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {filteredBooks.map((book) => (
                  <div
                    key={book.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openBook(book.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openBook(book.id)}
                    className="flex items-center bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--accent-border)] rounded-lg px-4 py-3 cursor-pointer transition group"
                  >
                    <div className="w-10 h-10 rounded bg-[var(--accent-surface)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-secondary)] font-bold mr-4 shrink-0">
                      {book.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--text-primary)] text-sm truncate">《{book.title}》</h3>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">{book.author || '未署名'}</p>
                    </div>
                    <div className="text-xs text-[var(--accent-secondary)] font-mono mr-8 shrink-0 hidden sm:block">
                      {(book.total_words || 0).toLocaleString()} 字
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mr-4 shrink-0 hidden md:block">
                      {new Date(book.updated_at).toLocaleDateString('zh-CN')}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModal('confirm', {
                          title: '删除作品',
                          message: `确定要删除《${book.title}》吗？此操作不可恢复，所有章节、人物卡、剧情节点都将被删除。`,
                          onConfirm: () => useBookStore.getState().deleteBook(book.id)
                        })
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger-primary)] opacity-0 group-hover:opacity-100 transition shrink-0"
                      aria-label={`删除《${book.title}》`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBooks.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

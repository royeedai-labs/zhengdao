import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Users,
  BookOpen,
  Settings,
  ArrowUpRight,
  BarChart3,
  LayoutDashboard,
  MoreHorizontal
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import PomodoroTimer from '@/components/shared/PomodoroTimer'
import AppBrand from '@/components/shared/AppBrand'
import AccountSettingsMenu from '@/components/shared/AccountSettingsMenu'
import { getCurrentTitlebarSafeArea } from '@/utils/window-shell'

export default function TopBar() {
  const {
    leftPanelOpen,
    rightPanelOpen,
    bottomPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    openModal,
    topbarToolsCollapsed,
    toggleTopbarToolsCollapsed
  } = useUIStore()
  const { books, currentBookId, closeBook } = useBookStore()
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const toolMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!toolMenuOpen) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (toolMenuOpen && !toolMenuRef.current?.contains(t)) setToolMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [toolMenuOpen])
  const currentBook = books.find((b) => b.id === currentBookId)
  const titlebarSafeArea = getCurrentTitlebarSafeArea()

  const closeToolsAndOpenModal = (modal: Parameters<typeof openModal>[0]) => {
    setToolMenuOpen(false)
    openModal(modal)
  }

  const handleTitlebarDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
      target.closest('button, input, select, textarea, a, [role="menu"], [role="menuitem"], [data-no-titlebar-toggle]')
    ) {
      return
    }
    void window.api.toggleMaximize()
  }

  const toolButtonClass =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border border-[var(--border-secondary)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-surface)] hover:text-[var(--accent-secondary)] transition shrink-0 min-h-8'

  return (
    <div
      className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center justify-between shrink-0 shadow-sm z-30 drag-region gap-3"
      onDoubleClick={handleTitlebarDoubleClick}
      style={{
        paddingLeft: `${titlebarSafeArea.leftInset}px`,
        paddingRight: `${titlebarSafeArea.rightInset}px`
      }}
    >
      <div className="flex items-center space-x-3 no-drag min-w-0">
        <AppBrand compact />
        <div className="h-4 w-px bg-[var(--border-secondary)]" />
        <button
          onClick={closeBook}
          title="返回书架"
          className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-secondary)] transition flex items-center gap-1 min-w-0"
        >
          <span className="truncate">《{currentBook?.title || '未命名'}》</span>
          <ArrowUpRight size={12} className="text-[var(--text-muted)]" />
        </button>
        <button
          type="button"
          onClick={() => openModal('bookOverview')}
          title="书籍总览"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] transition no-drag"
        >
          <LayoutDashboard size={14} />
          总览
        </button>
        <div className="flex items-center space-x-1 ml-2 text-[var(--text-muted)]">
          <button
            onClick={toggleLeftPanel}
            aria-label={leftPanelOpen ? '收起目录' : '展开目录'}
            aria-expanded={leftPanelOpen}
            title={leftPanelOpen ? '收起目录' : '展开目录'}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded transition min-h-8 min-w-8"
          >
            {leftPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          <button
            onClick={toggleRightPanel}
            aria-label={rightPanelOpen ? '收起辅助面板' : '展开辅助面板'}
            aria-expanded={rightPanelOpen}
            title={rightPanelOpen ? '收起辅助面板' : '展开辅助面板'}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded transition min-h-8 min-w-8"
          >
            {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
          </button>
          <button
            onClick={toggleBottomPanel}
            aria-label={bottomPanelOpen ? '收起底栏' : '展开底栏'}
            aria-expanded={bottomPanelOpen}
            title={bottomPanelOpen ? '收起底栏' : '展开底栏'}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded transition min-h-8 min-w-8"
          >
            {bottomPanelOpen ? <PanelBottomClose size={16} /> : <PanelBottomOpen size={16} />}
          </button>
        </div>
      </div>

      <div
        className={`topbar-tools no-drag flex-1 min-w-0 items-center justify-center px-2 overflow-x-auto ${
          topbarToolsCollapsed ? 'hidden' : 'hidden xl:flex'
        }`}
      >
        <div className="flex min-w-max items-center gap-2 whitespace-nowrap py-1">
          <button onClick={() => openModal('fullCharacters')} title="角色总库" className={toolButtonClass}>
            <Users size={14} /> 角色总库
          </button>
          <button onClick={() => openModal('settings')} title="设定维基" className={toolButtonClass}>
            <BookOpen size={14} /> 设定维基
          </button>
          <button type="button" onClick={() => openModal('stats')} title="写作数据中心" className={toolButtonClass}>
            <BarChart3 size={14} />
            数据
          </button>
          <button
            type="button"
            onClick={() => openModal('projectSettings')}
            aria-label="作品设置"
            title="作品设置"
            className="hidden xl:inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-secondary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]"
          >
            <Settings size={14} />
            作品设置
          </button>
        </div>
      </div>

      <div
        className={`relative no-drag shrink-0 ${topbarToolsCollapsed ? 'flex' : 'flex xl:hidden'}`}
        ref={toolMenuRef}
      >
        <button
          type="button"
          aria-label="更多工作区工具"
          aria-haspopup="menu"
          aria-expanded={toolMenuOpen}
          title="更多工作区工具"
          onClick={() => setToolMenuOpen((open) => !open)}
          className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-primary)] rounded transition min-h-8 min-w-8"
        >
          <MoreHorizontal size={16} />
        </button>
        {toolMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 min-w-[196px] rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] py-1 shadow-xl"
          >
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              当前作品
            </div>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('bookOverview')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <LayoutDashboard size={14} /> 总览
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('fullCharacters')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <Users size={14} /> 角色总库
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('settings')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <BookOpen size={14} /> 设定维基
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('stats')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <BarChart3 size={14} /> 数据中心
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('projectSettings')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <Settings size={14} /> 作品设置
            </button>
            <div className="my-1 border-t border-[var(--border-primary)]" />
            <button
              role="menuitem"
              type="button"
              onClick={() => toggleTopbarToolsCollapsed()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              <MoreHorizontal size={14} />
              {topbarToolsCollapsed ? '固定显示工具区' : '收起工具区'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 xl:gap-3 text-[var(--text-secondary)] no-drag shrink-0">
        <PomodoroTimer />
        <AccountSettingsMenu showTrash />
      </div>
    </div>
  )
}

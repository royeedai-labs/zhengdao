import { useEffect, useRef, useState } from 'react'
import {
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Users,
  BookOpen,
  Settings,
  ArrowUpRight,
  HelpCircle,
  ChevronDown,
  Cloud,
  Palette,
  LogIn,
  ArchiveRestore,
  BarChart3,
  LayoutDashboard,
  Flame,
  MoreHorizontal,
  Info
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useConfigStore } from '@/stores/config-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useDailyStats } from '@/hooks/useDailyStats'
import { useWritingSession } from '@/hooks/useWritingSession'
import { useWritingStreak } from '@/hooks/useWritingStreak'
import PomodoroTimer from '@/components/shared/PomodoroTimer'
import AppBrand from '@/components/shared/AppBrand'
import { THEME_IDS, THEME_LABELS } from '@/utils/themes'
import { useAuthStore } from '@/stores/auth-store'
import { getCurrentTitlebarSafeArea } from '@/utils/window-shell'

export default function TopBar() {
  const {
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
    openModal,
    theme,
    setTheme,
    topbarToolsCollapsed,
    toggleTopbarToolsCollapsed
  } = useUIStore()
  const { books, currentBookId, closeBook } = useBookStore()
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const toolMenuRef = useRef<HTMLDivElement>(null)

  const user = useAuthStore((s) => s.user)
  const syncing = useAuthStore((s) => s.syncing)
  const lastBookSyncAt = useAuthStore((s) => s.lastBookSyncAt)
  const loadUser = useAuthStore((s) => s.loadUser)
  const loadBookSyncMeta = useAuthStore((s) => s.loadBookSyncMeta)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  useEffect(() => {
    void loadBookSyncMeta(currentBookId ?? null)
  }, [currentBookId, loadBookSyncMeta])

  useEffect(() => {
    if (!themeMenuOpen && !accountMenuOpen && !toolMenuOpen) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (themeMenuOpen && !themeMenuRef.current?.contains(t)) setThemeMenuOpen(false)
      if (accountMenuOpen && !accountMenuRef.current?.contains(t)) setAccountMenuOpen(false)
      if (toolMenuOpen && !toolMenuRef.current?.contains(t)) setToolMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [themeMenuOpen, accountMenuOpen, toolMenuOpen])
  const config = useConfigStore((s) => s.config)
  const warningCount = useForeshadowStore((s) => s.getWarningCount())
  const currentBook = books.find((b) => b.id === currentBookId)
  const dailyGoal = config?.daily_goal || 6000
  const { todayWords: dailyWords } = useDailyStats()
  const dailyPercent = Math.min(100, Math.round((dailyWords / dailyGoal) * 100))
  const { sessionTime } = useWritingSession(currentBookId ?? null)
  const { streak } = useWritingStreak()
  const titlebarSafeArea = getCurrentTitlebarSafeArea()

  const cloudIconClass = syncing
    ? 'text-[var(--success-primary)] animate-pulse'
    : user && lastBookSyncAt
      ? 'text-[var(--success-primary)]'
      : 'text-[var(--text-muted)]'
  const cloudTitle = !user
    ? '未登录，云备份不可用'
    : syncing
      ? '正在同步到 Google Drive'
      : lastBookSyncAt
        ? `已备份到云端（${lastBookSyncAt.slice(0, 19).replace('T', ' ')}）`
        : '已登录，尚未备份当前书到云端'

  const applyTheme = (id: string) => {
    setTheme(id)
    setThemeMenuOpen(false)
    setAccountMenuOpen(false)
  }

  const closeToolsAndOpenModal = (modal: Parameters<typeof openModal>[0]) => {
    setToolMenuOpen(false)
    openModal(modal)
  }

  const toolButtonClass =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border border-[var(--border-secondary)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-surface)] hover:text-[var(--accent-secondary)] transition shrink-0 min-h-8'

  return (
    <div
      className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center justify-between shrink-0 shadow-sm z-30 drag-region gap-3"
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
        </div>
      </div>

      <div
        className={`topbar-tools no-drag flex-1 min-w-0 items-center justify-center px-2 overflow-x-auto ${
          topbarToolsCollapsed ? 'hidden' : 'hidden xl:flex'
        }`}
      >
        <div className="flex min-w-max items-center gap-2 whitespace-nowrap py-1">
          <button
            onClick={() => openModal('fullCharacters')}
            title="角色总库"
            className={toolButtonClass}
          >
            <Users size={14} /> 角色总库
          </button>
          <button
            onClick={() => openModal('settings')}
            title="设定维基"
            className={toolButtonClass}
          >
            <BookOpen size={14} /> 设定维基
          </button>
          <button
            type="button"
            onClick={() => openModal('stats')}
            title="写作数据中心"
            className={toolButtonClass}
          >
            <BarChart3 size={14} />
            数据
          </button>
          <button
            type="button"
            onClick={() => openModal('appSettings')}
            aria-label="应用设置 / 关于"
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded transition shrink-0 min-h-8 min-w-8"
            title="应用设置 / 关于"
          >
            <Info size={16} />
          </button>
          <button
            onClick={() => openModal('help')}
            aria-label="使用帮助"
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-primary)] rounded transition shrink-0 min-h-8 min-w-8"
            title="使用帮助 (F1)"
          >
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            onClick={() => openModal('trash')}
            aria-label="回收站"
            title="回收站"
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--warning-primary)] rounded transition text-[var(--text-muted)] shrink-0 min-h-8 min-w-8"
          >
            <ArchiveRestore size={16} />
          </button>
          <button
            onClick={() => openModal('projectSettings')}
            aria-label="项目设置"
            title="项目设置"
            className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded transition shrink-0 min-h-8 min-w-8"
          >
            <Settings size={16} />
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
              onClick={() => closeToolsAndOpenModal('appSettings')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <Info size={14} /> 应用设置 / 关于
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('trash')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <ArchiveRestore size={14} /> 回收站
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => closeToolsAndOpenModal('projectSettings')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <Settings size={14} /> 项目设置
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
        <div className="hidden lg:flex items-center space-x-3 text-xs w-48 xl:w-56">
          <span className="text-[var(--text-secondary)] font-medium shrink-0">日更:</span>
          <div className="flex-1 bg-[var(--bg-tertiary)] h-2.5 rounded-full overflow-hidden relative border border-[var(--border-primary)]">
            <div
              className="absolute top-0 left-0 h-full transition-all duration-500"
              style={{
                width: `${dailyPercent}%`,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
              }}
            />
          </div>
            <span className="text-[var(--accent-secondary)] font-bold font-mono shrink-0">
            {dailyWords.toLocaleString()}{' '}
            <span className="text-[var(--text-muted)] text-[10px]">/ {(dailyGoal / 1000).toFixed(0)}k</span>
          </span>
        </div>
        <PomodoroTimer />
        <span className="hidden 2xl:inline text-[10px] text-[var(--text-muted)] whitespace-nowrap" title="本次写作会话">
          本次 {sessionTime}
        </span>
        <span className="flex items-center gap-0.5 text-[11px] text-[var(--warning-primary)] font-semibold whitespace-nowrap" title="连续打卡天数">
          <Flame size={13} className="text-[var(--warning-primary)] shrink-0" />
          {streak}
        </span>
        {warningCount > 0 && (
          <span className="bg-[var(--warning-surface)] text-[var(--warning-primary)] border border-[var(--warning-border)] text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
            {warningCount} 待填坑
          </span>
        )}
        <span
          className="inline-flex items-center justify-center p-0.5"
          title={cloudTitle}
          aria-hidden
        >
          <Cloud size={18} className={cloudIconClass} strokeWidth={2} />
        </span>
        {!user && (
          <div className="relative no-drag" ref={themeMenuRef}>
            <button
              type="button"
              aria-label="选择主题"
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setAccountMenuOpen(false)
                setThemeMenuOpen((o) => !o)
              }}
              className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-primary)] rounded transition min-h-8 min-w-8"
              title="主题外观"
            >
              <Palette size={16} />
            </button>
            {themeMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[168px] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] py-1 shadow-xl"
              >
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  主题
                </div>
                {THEME_IDS.map((id) => (
                  <button
                    key={id}
                    role="menuitem"
                    type="button"
                    onClick={() => applyTheme(id)}
                    className={`flex w-full items-center px-3 py-2 text-left text-xs transition ${
                      theme === id
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-medium'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {THEME_LABELS[id]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!user && (
          <button
            type="button"
            onClick={() => openModal('login')}
            title="登录并启用云备份"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--accent-border)] text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)] transition"
          >
            <LogIn size={14} />
            登录
          </button>
        )}
        {user && (
          <div className="relative no-drag flex items-center gap-1 max-w-[200px]" ref={accountMenuRef}>
            <button
              type="button"
              aria-label="账号与主题"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setThemeMenuOpen(false)
                setAccountMenuOpen((o) => !o)
              }}
              className="flex items-center gap-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] min-w-0"
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="w-7 h-7 rounded-full shrink-0 object-cover border border-[var(--border-primary)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)] flex items-center justify-center text-xs font-bold shadow-md shrink-0">
                  {(user.name || user.email || '?').charAt(0)}
                </div>
              )}
              <span className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[96px] hidden sm:inline">
                {user.name || user.email || 'Google'}
              </span>
              <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
            </button>
            {accountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] py-1 shadow-xl"
              >
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  主题
                </div>
                {THEME_IDS.map((id) => (
                  <button
                    key={id}
                    role="menuitem"
                    type="button"
                    onClick={() => applyTheme(id)}
                    className={`flex w-full items-center px-3 py-2 text-left text-xs transition ${
                      theme === id
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-medium'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {THEME_LABELS[id]}
                  </button>
                ))}
                <div className="my-1 border-t border-[var(--border-primary)]" />
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    void logout()
                    setAccountMenuOpen(false)
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-xs text-[var(--danger-primary)] hover:bg-[var(--danger-surface)] transition"
                >
                  退出 Google 登录
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

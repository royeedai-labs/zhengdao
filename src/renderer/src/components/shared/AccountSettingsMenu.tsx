import { useEffect, useRef, useState } from 'react'
import {
  ArchiveRestore,
  BadgeCheck,
  Info,
  Loader2,
  LogIn,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Settings,
  UserRound
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { getUserDisplayName, getUserTierLabel, hasUserDisplayName } from '@/utils/auth-display'

interface AccountSettingsMenuProps {
  className?: string
  buttonClassName?: string
  showTrash?: boolean
}

export default function AccountSettingsMenu({
  className = '',
  buttonClassName = '',
  showTrash = false
}: AccountSettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const loadUser = useAuthStore((s) => s.loadUser)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const applyAuthUpdate = useAuthStore((s) => s.applyAuthUpdate)
  const openModal = useUIStore((s) => s.openModal)
  const displayName = getUserDisplayName(user)
  const hasDisplayName = hasUserDisplayName(user)
  const tierLabel = getUserTierLabel(user)

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  useEffect(() => {
    return window.api.onAuthUpdated((incoming) => {
      applyAuthUpdate(incoming as Parameters<typeof applyAuthUpdate>[0])
      useToastStore.getState().addToast('success', '证道账号已登录')
    })
  }, [applyAuthUpdate])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const openSettingsTab = (tab?: 'overview' | 'updates') => {
    setOpen(false)
    openModal('appSettings', tab ? { tab } : undefined)
  }

  const handleLogin = async () => {
    const result = await login()
    if (!result.ok) {
      useToastStore.getState().addToast('error', result.error || '无法打开证道网页登录')
      return
    }
    useToastStore.getState().addToast('success', '已打开证道官网关联登录')
  }

  const handleLogout = async () => {
    await logout()
    setOpen(false)
    useToastStore.getState().addToast('success', '已退出证道账号')
  }

  const handleCommunityFeedback = async () => {
    setOpen(false)
    try {
      await window.api.authOpenCommunityFeedbackPage()
    } catch (error) {
      useToastStore.getState().addToast('error', error instanceof Error ? error.message : '无法打开官方社区')
    }
  }

  const menuItemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]'

  const accountSummaryContent = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-primary)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]">
          {loading && !user ? <Loader2 size={20} className="animate-spin" /> : <UserRound size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {user ? displayName : '未登录证道账号'}
          </div>
          {user && hasDisplayName ? (
            <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{user.email}</div>
          ) : null}
          {!user ? (
            <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">登录后显示账号与云备份能力</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1 rounded border border-[var(--border-secondary)] px-1.5 py-0.5">
          <BadgeCheck size={12} />
          {tierLabel}
        </span>
        {user ? <span>{user.pointsBalance.toLocaleString()} 点</span> : null}
      </div>
    </>
  )

  return (
    <div ref={menuRef} className={`relative ${className}`} data-no-titlebar-toggle>
      <button
        type="button"
        aria-label="账号与设置"
        aria-haspopup="menu"
        aria-expanded={open}
        title="账号与设置"
        onClick={() => setOpen((next) => !next)}
        className={
          buttonClassName ||
          'inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-1.5 text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-surface)] hover:text-[var(--accent-secondary)]'
        }
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : user ? (
          <UserRound size={16} />
        ) : (
          <Settings size={16} />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] shadow-xl"
        >
          {user ? (
            <div className="border-b border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
              {accountSummaryContent}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="block w-full cursor-pointer border-b border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-left transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {accountSummaryContent}
            </button>
          )}

          <div className="py-1">
            {user ? (
              <button
                role="menuitem"
                type="button"
                onClick={() => openSettingsTab('overview')}
                className={menuItemClass}
              >
                <UserRound size={14} /> 账号信息
              </button>
            ) : (
              <button
                role="menuitem"
                type="button"
                onClick={() => void handleLogin()}
                disabled={loading}
                className={`${menuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} 登录证道账号
              </button>
            )}
            <button role="menuitem" type="button" onClick={() => openSettingsTab()} className={menuItemClass}>
              <Settings size={14} /> 应用设置
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => void handleCommunityFeedback()}
              className={menuItemClass}
            >
              <MessageSquareText size={14} /> 社区反馈
            </button>
            <button role="menuitem" type="button" onClick={() => openSettingsTab('updates')} className={menuItemClass}>
              <Info size={14} /> 更新与关于
            </button>
            {showTrash ? (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  openModal('trash')
                }}
                className={menuItemClass}
              >
                <ArchiveRestore size={14} /> 回收站
              </button>
            ) : null}
            {user ? (
              <>
                <div className="my-1 border-t border-[var(--border-primary)]" />
                <button
                  role="menuitem"
                  type="button"
                  onClick={() =>
                    void loadUser().then(() => useToastStore.getState().addToast('success', '账号状态已刷新'))
                  }
                  className={menuItemClass}
                >
                  <RefreshCw size={14} /> 刷新账号状态
                </button>
                <button role="menuitem" type="button" onClick={() => void handleLogout()} className={menuItemClass}>
                  <LogOut size={14} /> 退出登录
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  Cloud,
  Coins,
  LogIn,
  X,
  Loader2,
  MessageSquareText,
  RefreshCw,
  UserRound
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { useBookStore } from '@/stores/book-store'
import { getUserDisplayName, getUserTierLabel, hasProEntitlement } from '@/utils/auth-display'

export function AccountSyncSettings() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const syncing = useAuthStore((s) => s.syncing)
  const syncEnabled = useAuthStore((s) => s.syncEnabled)
  const loadUser = useAuthStore((s) => s.loadUser)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const syncUploadBook = useAuthStore((s) => s.syncUploadBook)
  const setSyncEnabled = useAuthStore((s) => s.setSyncEnabled)
  const applyAuthUpdate = useAuthStore((s) => s.applyAuthUpdate)

  const currentBookId = useBookStore((s) => s.currentBookId)
  const books = useBookStore((s) => s.books)
  const currentBook = books.find((b) => b.id === currentBookId)

  const [cloudList, setCloudList] = useState<Array<{ id: string; name: string; modifiedTime: string }>>([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const displayName = getUserDisplayName(user)
  const tierLabel = getUserTierLabel(user)
  const hasPro = hasProEntitlement(user)
  const showFreeUpgradePrompt = user && !hasPro

  async function loadCloudFiles() {
    if (!hasProEntitlement(useAuthStore.getState().user)) {
      setCloudList([])
      return
    }
    setCloudLoading(true)
    try {
      const list = (await window.api.syncListCloudBooks()) as Array<{
        id: string
        name: string
        modifiedTime: string
      }>
      setCloudList(list)
    } catch {
      setCloudList([])
    } finally {
      setCloudLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      await loadUser()
      const tok = await window.api.authGetAccessToken()
      if (!tok || !hasProEntitlement(useAuthStore.getState().user)) return
      await loadCloudFiles()
    })()
  }, [loadUser])

  useEffect(() => {
    return window.api.onAuthUpdated((incoming) => {
      const nextUser = incoming as Parameters<typeof applyAuthUpdate>[0]
      applyAuthUpdate(nextUser)
      setSyncMsg(hasProEntitlement(nextUser) ? '证道账号已关联，云端能力已可用。' : '证道账号已关联，升级 Pro 后可使用云端能力。')
      if (hasProEntitlement(nextUser)) void loadCloudFiles()
    })
  }, [applyAuthUpdate])

  const handleLogin = async () => {
    setSyncMsg(null)
    const result = await login()
    if (!result.ok) {
      setSyncMsg(result.error || '无法打开证道网页登录，请检查网络后重试')
      return
    }
    setSyncMsg('已打开证道网页登录。完成登录后会自动回到桌面端。')
  }

  const handleSyncNow = async () => {
    if (!currentBookId) {
      setSyncMsg('请先打开一本书再同步')
      return
    }
    setSyncMsg(null)
    try {
      await syncUploadBook(currentBookId)
      setSyncMsg('已上传到官网云备份')
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '同步失败')
    }
  }

  const refreshCloudList = () => {
    if (!user) return
    void loadCloudFiles()
  }

  const refreshEntitlement = async () => {
    await loadUser()
    setSyncMsg('账号权益已刷新。')
  }

  const openUpgradePage = async () => {
    await window.api.authOpenUpgradePage()
  }

  const openAccountPage = async () => {
    await window.api.authOpenAccountPage()
  }

  const openCommunityFeedbackPage = async () => {
    await window.api.authOpenCommunityFeedbackPage()
  }

  return (
    <div className="space-y-4">
      {user && (
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-surface)] text-[var(--accent-secondary)]">
              <UserRound size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{displayName}</div>
              <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{user.email}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1 rounded border border-[var(--success-border)] px-1.5 py-0.5 text-[var(--success-primary)]">
                  <BadgeCheck size={12} />
                  {tierLabel}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Coins size={12} />
                  {user.pointsBalance.toLocaleString()} 点
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <AccountDetail label="账号 ID" value={user.id} mono />
            <AccountDetail label="账号角色" value={user.role === 'admin' ? '管理员' : '普通用户'} />
            <AccountDetail label="邮箱状态" value={user.emailVerified ? '已验证' : '未验证'} />
            <AccountDetail label="Pro 权益" value={user.pro ? '已开通' : '未开通'} />
          </div>
        </div>
      )}

      {!user && (
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-surface)] text-[var(--accent-secondary)]">
              {loading ? <Loader2 size={22} className="animate-spin" /> : <UserRound size={22} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">未登录证道账号</div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                登录后会显示邮箱、会员、点数、云备份和官网账户中心入口。
              </div>
            </div>
          </div>
        </div>
      )}

      {showFreeUpgradePrompt && (
        <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-xs text-[var(--warning-primary)]">
          <div className="font-semibold">当前是 Free 账号</div>
          <div className="mt-1 text-[var(--text-secondary)]">兑换 CDK 后可开通 Pro、官网云备份和 AI 点数。</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openUpgradePage()}
              className="inline-flex items-center gap-1.5 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-[var(--accent-contrast)]"
            >
              <ArrowUpRight size={13} />
              升级 Pro
            </button>
            <button
              type="button"
              onClick={() => void refreshEntitlement()}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-1.5 text-[var(--text-primary)]"
            >
              <RefreshCw size={13} />
              刷新权益
            </button>
          </div>
        </div>
      )}

      {syncMsg && (
        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-xs">{syncMsg}</div>
      )}

      {user && hasPro && (
        <>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => void setSyncEnabled(e.target.checked)}
              className="rounded border-[var(--border-secondary)] bg-[var(--bg-primary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
            />
            <span className="text-xs text-[var(--text-primary)]">启用后将显示云同步状态（仍需手动上传备份）</span>
          </label>

          <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] bg-[var(--bg-primary)]">
              当前作品 · 手动上传官网云备份
            </div>
            <div className="p-3 space-y-2">
              <p className="text-xs text-[var(--text-muted)]">
                {currentBook ? `《${currentBook.title}》` : '未打开作品'} — 备份为{' '}
                <code className="text-[var(--accent-secondary)]">
                  book_{currentBookId ?? '?'}.json
                </code>
              </p>
              <button
                type="button"
                onClick={() => void handleSyncNow()}
                disabled={syncing || !currentBookId}
                className="w-full py-2.5 text-xs font-bold rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] flex items-center justify-center gap-2 transition"
              >
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
                {syncing ? '正在上传…' : '立即备份到云端'}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">官网云备份</span>
              <button
                type="button"
                onClick={() => void refreshCloudList()}
                className="text-[11px] text-[var(--accent-secondary)] hover:underline"
                disabled={cloudLoading}
              >
                刷新列表
              </button>
            </div>
            {cloudLoading ? (
              <div className="text-xs text-[var(--text-muted)] py-2">加载中…</div>
            ) : cloudList.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] py-2">暂无云端备份</div>
            ) : (
              <ul className="max-h-36 overflow-y-auto text-xs border border-[var(--border-primary)] rounded-lg divide-y divide-[var(--border-primary)]">
                {cloudList.map((f) => (
                  <li key={f.id} className="px-3 py-2 flex justify-between gap-2 text-[var(--text-primary)]">
                    <span className="truncate font-mono">{f.name}</span>
                    <span className="text-[var(--text-muted)] shrink-0">{f.modifiedTime?.slice(0, 19) ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {user && !hasPro && (
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs leading-5 text-[var(--text-muted)]">
          云备份和官方 AI 使用同一套 Pro 权益。当前状态仍可使用本地写作、Gemini CLI、Ollama 或全局 API Key。
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {user ? (
          <>
            <button
              type="button"
              onClick={() => void openAccountPage()}
              className="flex items-center gap-1 rounded bg-[var(--accent-primary)] px-4 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)]"
            >
              <ArrowUpRight size={13} />
              账户中心
            </button>
            <button
              type="button"
              onClick={() => void openCommunityFeedbackPage()}
              className="flex items-center gap-1 rounded border border-[var(--border-secondary)] px-4 py-1.5 text-xs text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
            >
              <MessageSquareText size={13} />
              社区反馈
            </button>
            <button
              type="button"
              onClick={() => void refreshEntitlement()}
              className="px-4 py-1.5 text-xs border border-[var(--border-secondary)] text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)] transition"
            >
              刷新权益
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-4 py-1.5 text-xs border border-[var(--border-secondary)] text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)] transition"
            >
              退出登录
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded flex items-center gap-1 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            关联证道账号
          </button>
        )}
      </div>
    </div>
  )
}

function AccountDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="text-[10px] text-[var(--text-muted)]">{label}</div>
      <div className={`mt-1 truncate text-xs text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

export default function LoginModal() {
  const closeModal = useUIStore((s) => s.closeModal)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <Cloud size={18} />
            <span>证道账号</span>
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <AccountSyncSettings />
        </div>

        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3 shrink-0">
          <button type="button" onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

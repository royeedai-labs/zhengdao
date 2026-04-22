import { useEffect, useState } from 'react'
import { Cloud, ExternalLink, LogIn, X, Loader2 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { useBookStore } from '@/stores/book-store'

export default function LoginModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const syncing = useAuthStore((s) => s.syncing)
  const syncEnabled = useAuthStore((s) => s.syncEnabled)
  const loadUser = useAuthStore((s) => s.loadUser)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const syncUploadBook = useAuthStore((s) => s.syncUploadBook)
  const setSyncEnabled = useAuthStore((s) => s.setSyncEnabled)

  const currentBookId = useBookStore((s) => s.currentBookId)
  const books = useBookStore((s) => s.books)
  const currentBook = books.find((b) => b.id === currentBookId)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [cloudList, setCloudList] = useState<Array<{ id: string; name: string; modifiedTime: string }>>([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function loadCloudFiles() {
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
      void window.api.getAppState('google_client_id').then((v) => {
        if (v) setClientId(v)
      })
      const tok = await window.api.authGetAccessToken()
      if (!tok) return
      await loadCloudFiles()
    })()
  }, [loadUser])

  const handleLogin = async () => {
    setSyncMsg(null)
    const ok = await login(clientId.trim(), clientSecret.trim())
    if (!ok) setSyncMsg('登录失败，请检查凭据与网络')
    else await loadCloudFiles()
  }

  const handleSyncNow = async () => {
    if (!currentBookId) {
      setSyncMsg('请先打开一本书再同步')
      return
    }
    setSyncMsg(null)
    try {
      await syncUploadBook(currentBookId)
      setSyncMsg('已上传到 Google Drive（应用数据）')
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '同步失败')
    }
  }

  const refreshCloudList = () => {
    if (!user) return
    void loadCloudFiles()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <Cloud size={18} />
            <span>Google 账号与云同步</span>
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            在{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent-secondary)] hover:underline inline-flex items-center gap-0.5"
            >
              Google Cloud Console <ExternalLink size={12} />
            </a>{' '}
            创建 OAuth 客户端（桌面应用），将客户端 ID 与密钥填入下方。凭据仅存于本机数据库。
          </p>

          {!user && (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">Client ID</span>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  placeholder="xxxx.apps.googleusercontent.com"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">Client Secret</span>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  placeholder="GOCSPX-..."
                />
              </label>
            </>
          )}

          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)]">
              {user.picture ? (
                <img src={user.picture} alt="" className="w-11 h-11 rounded-full shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[var(--accent-surface)] flex items-center justify-center text-sm font-bold text-[var(--accent-secondary)] shrink-0">
                  {user.name?.charAt(0) || '?'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{user.email}</div>
              </div>
            </div>
          )}

          {syncMsg && (
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-xs">{syncMsg}</div>
          )}

          {user && (
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
                  当前作品 · 手动备份到 Drive
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">应用数据中的备份</span>
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
                  <div className="text-xs text-[var(--text-muted)] py-2">暂无 book_*.json 文件</div>
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
        </div>

        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3 shrink-0">
          <button type="button" onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            关闭
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="px-4 py-1.5 text-xs border border-[var(--border-secondary)] text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)] transition"
            >
              退出登录
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading || !clientId.trim() || !clientSecret.trim()}
              className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded flex items-center gap-1 transition"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              使用 Google 登录
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

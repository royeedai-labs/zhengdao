import { AlertTriangle, CheckCircle, Download, Info, RefreshCw, X } from 'lucide-react'
import AppBrand from '@/components/shared/AppBrand'
import { useUIStore } from '@/stores/ui-store'
import { useUpdateStore } from '@/stores/update-store'
import type { UpdateStatus } from '../../../../shared/update'

function formatReleaseDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusTone(status: UpdateStatus): string {
  switch (status) {
    case 'available':
      return 'bg-[var(--info-surface)] text-[var(--info-primary)]'
    case 'downloading':
      return 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
    case 'ready':
      return 'bg-[var(--success-surface)] text-[var(--success-primary)]'
    case 'installing':
      return 'bg-[var(--warning-surface)] text-[var(--warning-primary)]'
    case 'error':
      return 'bg-[var(--danger-surface)] text-[var(--danger-primary)]'
    case 'checking':
      return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
    default:
      return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
  }
}

function getStatusLabel(status: UpdateStatus): string {
  switch (status) {
    case 'checking':
      return '检查中'
    case 'available':
      return '发现新版本'
    case 'downloading':
      return '下载中'
    case 'ready':
      return '可安装'
    case 'installing':
      return '安装中'
    case 'error':
      return '更新失败'
    default:
      return '已安装'
  }
}

export default function AppSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const appVersion = useUpdateStore((s) => s.appVersion)
  const snapshot = useUpdateStore((s) => s.snapshot)
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates)
  const downloadAvailableUpdate = useUpdateStore((s) => s.downloadAvailableUpdate)
  const installReadyUpdate = useUpdateStore((s) => s.installReadyUpdate)

  const closeDisabled = snapshot.status === 'installing'
  const actionBusy = snapshot.status === 'checking' || snapshot.status === 'downloading' || snapshot.status === 'installing'
  const releaseVersion = snapshot.version ?? '未发现新版本'
  const primaryButtonClass =
    'inline-flex min-w-[132px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-inverse)] transition disabled:cursor-not-allowed disabled:opacity-60'
  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60'

  let primaryAction:
    | {
        label: string
        onClick: () => void
        disabled?: boolean
        className?: string
      }
    | null = null

  if (snapshot.status === 'available') {
    primaryAction = {
      label: '下载更新',
      onClick: () => {
        void downloadAvailableUpdate()
      },
      className: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]'
    }
  } else if (snapshot.status === 'ready') {
    primaryAction = {
      label: snapshot.errorRecoveryAction === 'install' ? '重试安装' : '立即安装',
      onClick: () => {
        void installReadyUpdate()
      },
      className: 'bg-[var(--success-primary)] hover:brightness-105'
    }
  } else if (snapshot.status === 'error') {
    primaryAction = {
      label:
        snapshot.errorRecoveryAction === 'download'
          ? '重试下载'
          : snapshot.errorRecoveryAction === 'install'
            ? '重试安装'
            : '重新检查',
      onClick: () => {
        if (snapshot.errorRecoveryAction === 'download') {
          void downloadAvailableUpdate()
          return
        }
        if (snapshot.errorRecoveryAction === 'install') {
          void installReadyUpdate()
          return
        }
        void checkForUpdates()
      },
      className: 'bg-[var(--danger-primary)] hover:brightness-105'
    }
  } else if (snapshot.status === 'idle') {
    primaryAction = {
      label: '检查更新',
      onClick: () => {
        void checkForUpdates()
      },
      className: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]'
    }
  } else if (snapshot.status === 'checking') {
    primaryAction = {
      label: '检查中…',
      onClick: () => void 0,
      disabled: true,
      className: 'bg-[var(--accent-primary)]'
    }
  } else if (snapshot.status === 'downloading') {
    primaryAction = {
      label: `下载中 ${snapshot.downloadPercent}%`,
      onClick: () => void 0,
      disabled: true,
      className: 'bg-[var(--accent-primary)]'
    }
  } else if (snapshot.status === 'installing') {
    primaryAction = {
      label: '正在启动安装器…',
      onClick: () => void 0,
      disabled: true,
      className: 'bg-[var(--warning-primary)]'
    }
  }

  const summaryText =
    snapshot.status === 'available'
      ? '已发现新版本，你可以先查看更新日志，再决定是否下载。'
      : snapshot.status === 'downloading'
        ? '下载会在后台继续进行，关闭弹框不会中断当前下载。'
        : snapshot.status === 'ready'
          ? snapshot.errorMessage
            ? '上次安装未能完成，处理完占用进程后可以再次尝试。'
            : '更新包已下载完成，可以立即退出应用并启动安装器。'
          : snapshot.status === 'installing'
            ? '应用正在准备退出并启动安装器，请稍候。'
            : snapshot.status === 'error'
              ? '更新流程遇到问题，请查看原因后重试。'
              : snapshot.status === 'checking'
                ? '正在连接更新源并检查当前版本。'
                : '当前入口会显示可用更新、下载进度和安装状态。'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 shrink-0">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Info size={18} />
            <span className="text-sm font-bold">应用设置 / 关于</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void checkForUpdates()
              }}
              disabled={actionBusy}
              className={`${secondaryButtonClass} h-9`}
              title="手动检查更新"
            >
              <RefreshCw size={15} className={snapshot.status === 'checking' ? 'animate-spin' : ''} />
              检查更新
            </button>
            <button
              type="button"
              onClick={() => !closeDisabled && closeModal()}
              disabled={closeDisabled}
              title="关闭应用设置 / 关于"
              aria-label="关闭应用设置 / 关于"
              className="rounded p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid flex-1 overflow-hidden md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--border-primary)] bg-[var(--bg-primary)] p-6 md:border-b-0 md:border-r">
            <AppBrand />
            <div className="mt-6 space-y-5 text-sm">
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">当前版本</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">v{appVersion || '—'}</div>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  正式版会在后台自动检查更新；下载和安装由你手动确认。
                </p>
              </section>

              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">更新状态</div>
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(snapshot.status)}`}>
                  {getStatusLabel(snapshot.status)}
                </div>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{summaryText}</p>
              </section>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-[var(--border-primary)] px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">版本与更新</div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">
                    {snapshot.version ? `v${releaseVersion}` : '当前已安装版本'}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    发布日期 {snapshot.version ? formatReleaseDate(snapshot.releaseDate) : formatReleaseDate(null)}
                  </div>
                </div>
                {snapshot.status === 'downloading' ? (
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>下载进度</span>
                      <span>{snapshot.downloadPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                        style={{ width: `${snapshot.downloadPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {snapshot.errorMessage ? (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--warning-primary)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
                  <div>
                    <div className="font-semibold text-[var(--warning-primary)]">
                      {snapshot.status === 'ready' ? '安装未完成' : '更新流程异常'}
                    </div>
                    <div className="mt-1 leading-relaxed">{snapshot.errorMessage}</div>
                  </div>
                </div>
              ) : snapshot.status === 'ready' ? (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <CheckCircle size={18} className="mt-0.5 shrink-0 text-[var(--success-primary)]" />
                  <div>
                    <div className="font-semibold text-[var(--success-primary)]">更新包已准备好</div>
                    <div className="mt-1 leading-relaxed">点击“立即安装”后，应用会先退出，再启动安装器完成升级。</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">更新日志</h2>
                {snapshot.version ? (
                  <span className="text-xs text-[var(--text-muted)]">针对 v{snapshot.version}</span>
                ) : null}
              </div>
              {snapshot.releaseNotesSummary ? (
                <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-primary)]">
                  {snapshot.releaseNotesSummary}
                </div>
              ) : (
                <div className="text-sm leading-7 text-[var(--text-secondary)]">
                  {snapshot.version
                    ? '当前版本未提供可展示的更新日志。'
                    : '暂未发现待下载的新版本。发现新版本后，这里会展示版本号、发布日期和更新日志。'}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] px-6 py-4">
              <div className="text-xs leading-relaxed text-[var(--text-muted)]">
                {snapshot.status === 'installing'
                  ? '正在等待应用退出。若长时间无响应，请稍后重试。'
                  : '关闭此窗口不会丢失当前更新状态。'}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={closeDisabled}
                  className={secondaryButtonClass}
                >
                  {snapshot.status === 'available' || snapshot.status === 'ready' ? '稍后' : '关闭'}
                </button>
                {primaryAction ? (
                  <button
                    type="button"
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled}
                    className={`${primaryButtonClass} ${primaryAction.className ?? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]'}`}
                  >
                    {snapshot.status === 'checking' || snapshot.status === 'downloading' || snapshot.status === 'installing' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : primaryAction.label.includes('下载') ? (
                      <Download size={16} />
                    ) : null}
                    <span>{primaryAction.label}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

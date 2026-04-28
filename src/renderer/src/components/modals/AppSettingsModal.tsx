import {
  AlertTriangle,
  CheckCircle,
  Database,
  Download,
  Info,
  Keyboard,
  KeyRound,
  Monitor,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Target,
  UserRound,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import AiGlobalConfigSettings from '@/components/ai/AiGlobalConfigSettings'
import BackupMigrationSettingsPanel from '@/components/settings/BackupMigrationSettingsPanel'
import GenreTemplatesSettingsPanel from '@/components/settings/GenreTemplatesSettingsPanel'
import ShortcutSettingsPanel from '@/components/settings/ShortcutSettingsPanel'
import SystemDailyGoalSettingsPanel from '@/components/settings/SystemDailyGoalSettingsPanel'
import AppBrand from '@/components/shared/AppBrand'
import { AccountSyncSettings } from '@/components/modals/LoginModal'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { useUpdateStore } from '@/stores/update-store'
import { buildManualUpdateMessage, shouldUseManualUpdate } from '@/utils/update-prompt'
import { THEME_IDS, THEME_LABELS, THEME_TOKENS, resolveThemeMode, type ThemeId } from '@/utils/themes'
import type { UpdateStatus } from '../../../../shared/update'

type AppSettingsTab =
  | 'overview'
  | 'appearance'
  | 'genreTemplates'
  | 'dailyDefaults'
  | 'aiModels'
  | 'shortcuts'
  | 'backup'
  | 'updates'

const SETTINGS_TABS: Array<{ id: AppSettingsTab; label: string; icon: typeof Palette }> = [
  { id: 'overview', label: '账号信息', icon: UserRound },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'genreTemplates', label: '题材模板', icon: SlidersHorizontal },
  { id: 'dailyDefaults', label: '日更默认', icon: Target },
  { id: 'aiModels', label: 'AI 与模型', icon: KeyRound },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'backup', label: '备份与迁移', icon: Database },
  { id: 'updates', label: '更新与关于', icon: Info }
]

function normalizeAppSettingsTab(value: unknown): AppSettingsTab | null {
  if (value === 'account') return 'overview'
  if (value === 'aiAccounts') return 'aiModels'
  return (
    value === 'overview' ||
    value === 'appearance' ||
    value === 'genreTemplates' ||
    value === 'dailyDefaults' ||
    value === 'aiModels' ||
    value === 'shortcuts' ||
    value === 'backup' ||
    value === 'updates'
      ? value
      : null
  )
}

function AppSettingsOverview() {
  return <AccountSyncSettings />
}

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

function getResolvedThemeLabel(theme: ThemeId): string {
  if (theme !== 'system') return THEME_LABELS[theme]
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return `跟随系统（当前${prefersDark ? '深色' : '浅色'}）`
}

function ThemeSwatch({ id }: { id: ThemeId }) {
  if (id === 'system') {
    return (
      <span className="grid h-5 w-8 overflow-hidden rounded border border-[var(--border-secondary)] grid-cols-2">
        <span className="bg-[#f4f7fb]" />
        <span className="bg-[#11161d]" />
      </span>
    )
  }
  const resolved = resolveThemeMode(id, false)
  const tokens = THEME_TOKENS[resolved]
  return (
    <span
      className="flex h-5 w-8 overflow-hidden rounded border border-[var(--border-secondary)]"
      style={{ background: tokens['--bg-primary'] }}
    >
      <span className="h-full w-1/2" style={{ background: tokens['--bg-secondary'] }} />
      <span className="h-full w-1/2" style={{ background: tokens['--accent-primary'] }} />
    </span>
  )
}

export default function AppSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData) as { tab?: unknown } | null
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const appVersion = useUpdateStore((s) => s.appVersion)
  const snapshot = useUpdateStore((s) => s.snapshot)
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates)
  const downloadAvailableUpdate = useUpdateStore((s) => s.downloadAvailableUpdate)
  const downloadManualInstallerUpdate = useUpdateStore((s) => s.downloadManualInstallerUpdate)
  const installReadyUpdate = useUpdateStore((s) => s.installReadyUpdate)
  const [tab, setTab] = useState<AppSettingsTab>(() => normalizeAppSettingsTab(modalData?.tab) ?? 'overview')
  const [manualInstallerBusy, setManualInstallerBusy] = useState(false)

  useEffect(() => {
    const nextTab = normalizeAppSettingsTab(modalData?.tab)
    if (nextTab) setTab(nextTab)
  }, [modalData?.tab])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const closeDisabled = snapshot.status === 'installing'
  const actionBusy =
    manualInstallerBusy ||
    snapshot.status === 'checking' ||
    snapshot.status === 'downloading' ||
    snapshot.status === 'installing'
  const releaseVersion = snapshot.version ?? '未发现新版本'
  const primaryButtonClass =
    'inline-flex min-w-[132px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-inverse)] transition disabled:cursor-not-allowed disabled:opacity-60'
  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60'

  let primaryAction: {
    label: string
    onClick: () => void
    disabled?: boolean
    className?: string
    icon?: 'download'
    busy?: boolean
  } | null = null

  const manualUpdate = shouldUseManualUpdate(snapshot)

  if (manualUpdate) {
    primaryAction = {
      label: manualInstallerBusy ? '下载中…' : '下载安装包',
      onClick: async () => {
        if (manualInstallerBusy) return
        setManualInstallerBusy(true)
        try {
          await downloadManualInstallerUpdate()
        } finally {
          setManualInstallerBusy(false)
        }
      },
      disabled: manualInstallerBusy,
      className: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]',
      icon: 'download',
      busy: manualInstallerBusy
    }
  } else if (snapshot.status === 'available') {
    primaryAction = {
      label: '下载更新',
      onClick: () => {
        void downloadAvailableUpdate()
      },
      className: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]',
      icon: 'download'
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

  const summaryText = manualUpdate
    ? '已发现新版本。当前平台暂不使用应用内自动安装，可以在应用内下载安装包，下载完成后会打开 DMG。'
    : snapshot.status === 'available'
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
            <SlidersHorizontal size={18} />
            <span className="text-sm font-bold">应用设置</span>
          </div>
          <button
            type="button"
            onClick={() => !closeDisabled && closeModal()}
            disabled={closeDisabled}
            title="关闭应用设置"
            aria-label="关闭应用设置"
            className="rounded p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid flex-1 overflow-hidden md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 md:border-b-0 md:border-r">
            <AppBrand />
            <nav className="mt-6 space-y-1">
              {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                    tab === id
                      ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>

            <div className="mt-6 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-secondary)]">
              <div className="font-semibold text-[var(--text-primary)]">当前版本</div>
              <div className="mt-1 text-lg font-semibold text-[var(--accent-secondary)]">v{appVersion || '—'}</div>
              <div
                className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(snapshot.status)}`}
              >
                {getStatusLabel(snapshot.status)}
              </div>
            </div>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {tab === 'overview' && (
              <AppSettingsOverview />
            )}

            {tab === 'appearance' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-primary)] pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <Monitor size={16} />
                      主题外观
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{getResolvedThemeLabel(theme)}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {THEME_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTheme(id)}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                        theme === id
                          ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                          : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{THEME_LABELS[id]}</span>
                        <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                          {id === 'system' ? '跟随系统浅深色' : id}
                        </span>
                      </span>
                      <ThemeSwatch id={id} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'genreTemplates' && <GenreTemplatesSettingsPanel />}

            {tab === 'dailyDefaults' && <SystemDailyGoalSettingsPanel />}

            {tab === 'aiModels' && <AiGlobalConfigSettings />}

            {tab === 'shortcuts' && <ShortcutSettingsPanel />}

            {tab === 'backup' && <BackupMigrationSettingsPanel />}

            {tab === 'updates' && (
              <div className="flex min-h-full flex-col">
                <div className="border-b border-[var(--border-primary)] pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                        版本与更新
                      </div>
                      <div className="text-2xl font-semibold text-[var(--text-primary)]">
                        {snapshot.version ? `v${releaseVersion}` : '当前已安装版本'}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        发布日期 {snapshot.version ? formatReleaseDate(snapshot.releaseDate) : formatReleaseDate(null)}
                      </div>
                    </div>
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

                  <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{summaryText}</p>

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
                  ) : manualUpdate ? (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--warning-primary)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--text-primary)]">
                      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
                      <div>
                        <div className="font-semibold text-[var(--warning-primary)]">需要手动下载</div>
                        <div className="mt-1 leading-relaxed">{buildManualUpdateMessage(snapshot)}</div>
                      </div>
                    </div>
                  ) : snapshot.status === 'ready' ? (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] px-4 py-3 text-sm text-[var(--text-primary)]">
                      <CheckCircle size={18} className="mt-0.5 shrink-0 text-[var(--success-primary)]" />
                      <div>
                        <div className="font-semibold text-[var(--success-primary)]">更新包已准备好</div>
                        <div className="mt-1 leading-relaxed">
                          点击“立即安装”后，应用会先退出，再启动安装器完成升级。
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 py-5">
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
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] px-6 py-4">
          <div className="text-xs leading-relaxed text-[var(--text-muted)]">
            {tab === 'updates'
              ? snapshot.status === 'installing'
                ? '正在等待应用退出。若长时间无响应，请稍后重试。'
                : '关闭此窗口不会丢失当前更新状态。'
              : '系统级设置会保存在本机。'}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={closeModal} disabled={closeDisabled} className={secondaryButtonClass}>
              {tab === 'updates' && (snapshot.status === 'available' || snapshot.status === 'ready') ? '稍后' : '关闭'}
            </button>
            {tab === 'updates' && primaryAction ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className={`${primaryButtonClass} ${primaryAction.className ?? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]'}`}
              >
                {primaryAction.busy ||
                snapshot.status === 'checking' ||
                snapshot.status === 'downloading' ||
                snapshot.status === 'installing' ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : primaryAction.icon === 'download' ? (
                  <Download size={16} />
                ) : null}
                <span>{primaryAction.label}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

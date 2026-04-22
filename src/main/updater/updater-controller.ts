import type { UpdateMetadata, UpdateRecoveryAction, UpdateSnapshot } from '../../shared/update'
import { createIdleUpdateSnapshot, reduceUpdateSnapshot } from '../../shared/update'

type UpdaterEventName =
  | 'checking-for-update'
  | 'update-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'update-not-available'
  | 'error'

interface UpdaterLike {
  autoDownload?: boolean
  autoInstallOnAppQuit?: boolean
  on: (event: UpdaterEventName, listener: (...args: any[]) => void) => unknown
  checkForUpdates: () => Promise<unknown> | unknown
  downloadUpdate: () => Promise<unknown> | unknown
  quitAndInstall: () => void
}

interface TimeoutScheduler {
  setTimeout: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void
}

const INSTALL_WATCHDOG_MS = 15_000
const INSTALL_WATCHDOG_MESSAGE = '未能自动退出，请手动关闭应用后重试'

function toMetadata(payload: any): UpdateMetadata {
  return {
    version: payload?.version ?? null,
    releaseDate: payload?.releaseDate ?? null,
    releaseNotes: payload?.releaseNotes ?? null
  }
}

export class UpdaterController {
  private snapshot: UpdateSnapshot = createIdleUpdateSnapshot()
  private bound = false
  private activeOperation: UpdateRecoveryAction | null = null
  private installWatchdog: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly updater: UpdaterLike,
    private readonly broadcast: (snapshot: UpdateSnapshot) => void = () => void 0,
    private readonly scheduler: TimeoutScheduler = {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout
    }
  ) {}

  bind(): void {
    if (this.bound) return
    this.bound = true
    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = false

    this.updater.on('checking-for-update', () => {
      this.apply({ type: 'checking' })
    })

    this.updater.on('update-available', (info: unknown) => {
      this.activeOperation = null
      this.apply({ type: 'update-available', payload: toMetadata(info) })
    })

    this.updater.on('download-progress', (progress: { percent?: number }) => {
      this.apply({
        type: 'download-progress',
        downloadPercent: progress?.percent ?? 0
      })
    })

    this.updater.on('update-downloaded', (info: unknown) => {
      this.activeOperation = null
      this.apply({ type: 'update-downloaded', payload: toMetadata(info) })
    })

    this.updater.on('update-not-available', () => {
      this.activeOperation = null
      this.apply({ type: 'update-not-available' })
    })

    this.updater.on('error', (error: Error) => {
      const recoveryAction = this.activeOperation ?? 'check'
      this.activeOperation = null
      this.apply({
        type: 'error',
        errorMessage: error?.message || '检查更新失败',
        recoveryAction
      })
    })
  }

  getSnapshot(): UpdateSnapshot {
    return this.snapshot
  }

  async checkForUpdates(): Promise<void> {
    this.bind()
    this.activeOperation = 'check'
    await this.updater.checkForUpdates()
  }

  async downloadAvailableUpdate(): Promise<void> {
    this.bind()
    if (!this.snapshot.version || !['available', 'error'].includes(this.snapshot.status)) {
      throw new Error('当前没有可下载的新版本')
    }

    this.activeOperation = 'download'
    this.apply({ type: 'download-started' })
    await this.updater.downloadUpdate()
  }

  markError(error: unknown, recoveryAction: UpdateRecoveryAction = this.activeOperation ?? 'check'): void {
    this.activeOperation = null
    const message = error instanceof Error ? error.message : '检查更新失败'
    this.apply({ type: 'error', errorMessage: message, recoveryAction })
  }

  installDownloadedUpdate(): void {
    if (this.snapshot.status !== 'ready') {
      throw new Error('Update not ready to install')
    }
    this.clearInstallWatchdog()
    this.activeOperation = 'install'
    this.apply({ type: 'installing' })

    try {
      this.updater.quitAndInstall()
      this.installWatchdog = this.scheduler.setTimeout(() => {
        this.installWatchdog = null
        this.activeOperation = null
        this.apply({
          type: 'install-failed',
          errorMessage: INSTALL_WATCHDOG_MESSAGE
        })
      }, INSTALL_WATCHDOG_MS)
    } catch (error) {
      this.activeOperation = null
      this.apply({
        type: 'install-failed',
        errorMessage: error instanceof Error ? error.message : INSTALL_WATCHDOG_MESSAGE
      })
      throw error
    }
  }

  private apply(event: Parameters<typeof reduceUpdateSnapshot>[1]): void {
    this.snapshot = reduceUpdateSnapshot(this.snapshot, event)
    this.broadcast(this.snapshot)
  }

  private clearInstallWatchdog(): void {
    if (!this.installWatchdog) return
    this.scheduler.clearTimeout(this.installWatchdog)
    this.installWatchdog = null
  }
}

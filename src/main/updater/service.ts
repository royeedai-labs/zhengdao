import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateSnapshot } from '../../shared/update'
import { withManualUpdateFallback } from '../../shared/update'
import { canStartLifecycleUpdateCheck, UpdaterController } from './updater-controller'

const { autoUpdater } = electronUpdater

const INITIAL_CHECK_DELAY_MS = 10_000
const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const LIFECYCLE_CHECK_THROTTLE_MS = 5 * 60 * 1000
const MANUAL_DOWNLOAD_URL = 'https://github.com/royeedai/zhengdao/releases/latest'
const MAC_AUTOMATIC_UPDATE_UNSUPPORTED_REASON =
  '当前 macOS 公测包未完成签名与公证，应用内自动安装会被系统拦截。请打开下载页手动下载安装包。'

function getAutomaticUpdateUnsupportedReason(): string | null {
  if (process.platform !== 'darwin') return null
  if (process.env.ZHENGDAO_ENABLE_MAC_AUTO_UPDATE === 'true') return null
  return MAC_AUTOMATIC_UPDATE_UNSUPPORTED_REASON
}

class AppUpdaterService {
  private readonly controller = new UpdaterController(autoUpdater, (snapshot) => this.broadcast(snapshot))
  private window: BrowserWindow | null = null
  private lifecycleTimer: NodeJS.Timeout | null = null
  private intervalTimer: NodeJS.Timeout | null = null
  private periodicChecksStarted = false
  private lastLifecycleCheckAt = 0

  constructor() {
    this.controller.bind()
  }

  attachWindow(window: BrowserWindow): void {
    this.window = window
    this.broadcast(this.controller.getSnapshot())

    if (!app.isPackaged) return

    this.ensurePeriodicChecks()
    this.scheduleLifecycleCheck(INITIAL_CHECK_DELAY_MS)
  }

  notifyAppActivated(): void {
    if (!app.isPackaged) return
    this.scheduleLifecycleCheck(0)
  }

  private ensurePeriodicChecks(): void {
    if (this.periodicChecksStarted) return
    this.periodicChecksStarted = true
    this.intervalTimer = setInterval(() => {
      void this.checkForUpdates()
    }, PERIODIC_CHECK_INTERVAL_MS)
  }

  private scheduleLifecycleCheck(delayMs: number): void {
    if (!canStartLifecycleUpdateCheck(this.controller.getSnapshot())) return
    if (this.lifecycleTimer) return

    const now = Date.now()
    if (now - this.lastLifecycleCheckAt < LIFECYCLE_CHECK_THROTTLE_MS) return

    this.lifecycleTimer = setTimeout(() => {
      this.lifecycleTimer = null
      if (!canStartLifecycleUpdateCheck(this.controller.getSnapshot())) return
      this.lastLifecycleCheckAt = Date.now()
      void this.checkForUpdates()
    }, delayMs)
  }

  getSnapshot(): UpdateSnapshot {
    return this.toPublicSnapshot(this.controller.getSnapshot())
  }

  async checkForUpdates(): Promise<UpdateSnapshot> {
    if (!app.isPackaged) {
      return this.getSnapshot()
    }

    try {
      await this.controller.checkForUpdates()
    } catch (error) {
      console.error('[Updater] checkForUpdates failed:', error)
      this.controller.markError(error, 'check')
    }

    return this.getSnapshot()
  }

  async downloadAvailableUpdate(): Promise<UpdateSnapshot> {
    if (!app.isPackaged) {
      throw new Error('当前不是打包版，无法下载更新')
    }
    const unsupportedReason = getAutomaticUpdateUnsupportedReason()
    if (unsupportedReason) {
      throw new Error(unsupportedReason)
    }

    try {
      await this.controller.downloadAvailableUpdate()
    } catch (error) {
      console.error('[Updater] downloadAvailableUpdate failed:', error)
      this.controller.markError(error, 'download')
    }

    return this.getSnapshot()
  }

  async installDownloadedUpdate(): Promise<void> {
    if (!app.isPackaged) {
      throw new Error('当前不是打包版，无法安装更新')
    }
    const unsupportedReason = getAutomaticUpdateUnsupportedReason()
    if (unsupportedReason) {
      throw new Error(unsupportedReason)
    }
    this.controller.installDownloadedUpdate()
  }

  private broadcast(snapshot: UpdateSnapshot): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send('app:updateState', this.toPublicSnapshot(snapshot))
  }

  private toPublicSnapshot(snapshot: UpdateSnapshot): UpdateSnapshot {
    const unsupportedReason = getAutomaticUpdateUnsupportedReason()
    return withManualUpdateFallback(snapshot, unsupportedReason, unsupportedReason ? MANUAL_DOWNLOAD_URL : null)
  }
}

const appUpdaterService = new AppUpdaterService()

export function attachUpdaterWindow(window: BrowserWindow): void {
  appUpdaterService.attachWindow(window)
}

export function notifyUpdaterAppActivated(): void {
  appUpdaterService.notifyAppActivated()
}

export function getUpdateState(): UpdateSnapshot {
  return appUpdaterService.getSnapshot()
}

export function getAppVersion(): string {
  return app.getVersion()
}

export async function installDownloadedUpdate(): Promise<void> {
  await appUpdaterService.installDownloadedUpdate()
}

export async function checkForUpdates(): Promise<UpdateSnapshot> {
  return appUpdaterService.checkForUpdates()
}

export async function downloadAvailableUpdate(): Promise<UpdateSnapshot> {
  return appUpdaterService.downloadAvailableUpdate()
}

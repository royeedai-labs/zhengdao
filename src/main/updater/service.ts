import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateSnapshot } from '../../shared/update'
import { UpdaterController } from './updater-controller'

const { autoUpdater } = electronUpdater

const INITIAL_CHECK_DELAY_MS = 10_000
const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

class AppUpdaterService {
  private readonly controller = new UpdaterController(autoUpdater, (snapshot) => this.broadcast(snapshot))
  private window: BrowserWindow | null = null
  private initialTimer: NodeJS.Timeout | null = null
  private intervalTimer: NodeJS.Timeout | null = null
  private started = false

  constructor() {
    this.controller.bind()
  }

  attachWindow(window: BrowserWindow): void {
    this.window = window
    this.broadcast(this.controller.getSnapshot())

    if (!app.isPackaged || this.started) return

    this.started = true
    this.initialTimer = setTimeout(() => {
      void this.checkForUpdates()
      this.intervalTimer = setInterval(() => {
        void this.checkForUpdates()
      }, PERIODIC_CHECK_INTERVAL_MS)
    }, INITIAL_CHECK_DELAY_MS)
  }

  getSnapshot(): UpdateSnapshot {
    return this.controller.getSnapshot()
  }

  async checkForUpdates(): Promise<UpdateSnapshot> {
    if (!app.isPackaged) {
      return this.controller.getSnapshot()
    }

    try {
      await this.controller.checkForUpdates()
    } catch (error) {
      console.error('[Updater] checkForUpdates failed:', error)
      this.controller.markError(error, 'check')
    }

    return this.controller.getSnapshot()
  }

  async downloadAvailableUpdate(): Promise<UpdateSnapshot> {
    if (!app.isPackaged) {
      throw new Error('当前不是打包版，无法下载更新')
    }

    try {
      await this.controller.downloadAvailableUpdate()
    } catch (error) {
      console.error('[Updater] downloadAvailableUpdate failed:', error)
      this.controller.markError(error, 'download')
    }

    return this.controller.getSnapshot()
  }

  async installDownloadedUpdate(): Promise<void> {
    if (!app.isPackaged) {
      throw new Error('当前不是打包版，无法安装更新')
    }
    this.controller.installDownloadedUpdate()
  }

  private broadcast(snapshot: UpdateSnapshot): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send('app:updateState', snapshot)
  }
}

const appUpdaterService = new AppUpdaterService()

export function attachUpdaterWindow(window: BrowserWindow): void {
  appUpdaterService.attachWindow(window)
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

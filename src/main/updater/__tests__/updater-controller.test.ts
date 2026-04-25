import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createIdleUpdateSnapshot } from '../../../shared/update'
import { canStartLifecycleUpdateCheck, UpdaterController } from '../updater-controller'

class FakeUpdater extends EventEmitter {
  autoDownload = false
  autoInstallOnAppQuit = true
  checkCalls = 0
  downloadCalls = 0
  quitCalls = 0

  async checkForUpdates() {
    this.checkCalls += 1
  }

  async downloadUpdate() {
    this.downloadCalls += 1
  }

  quitAndInstall() {
    this.quitCalls += 1
  }
}

describe('UpdaterController', () => {
  it('only starts lifecycle checks from idle or retryable error states', () => {
    const idle = createIdleUpdateSnapshot()

    expect(canStartLifecycleUpdateCheck(idle)).toBe(true)
    expect(canStartLifecycleUpdateCheck({ ...idle, status: 'error' })).toBe(true)
    expect(canStartLifecycleUpdateCheck({ ...idle, status: 'checking' })).toBe(false)
    expect(canStartLifecycleUpdateCheck({ ...idle, status: 'available' })).toBe(false)
    expect(canStartLifecycleUpdateCheck({ ...idle, status: 'downloading' })).toBe(false)
    expect(canStartLifecycleUpdateCheck({ ...idle, status: 'ready' })).toBe(false)
    expect(canStartLifecycleUpdateCheck({ ...idle, status: 'installing' })).toBe(false)
  })

  it('marks an update as available and only starts downloading after explicit user action', async () => {
    const updater = new FakeUpdater()
    const seen: Array<{ status: string; version: string | null }> = []
    const controller = new UpdaterController(updater, (snapshot) => {
      seen.push({ status: snapshot.status, version: snapshot.version })
    })

    controller.bind()
    updater.emit('update-available', {
      version: '1.2.3',
      releaseDate: '2026-04-20T12:00:00.000Z',
      releaseNotes: '修复在线更新'
    })

    expect(controller.getSnapshot()).toMatchObject({
      status: 'available',
      version: '1.2.3'
    })

    await controller.downloadAvailableUpdate()

    expect(updater.downloadCalls).toBe(1)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'downloading',
      version: '1.2.3'
    })
    expect(seen[seen.length - 1]).toEqual({
      status: 'downloading',
      version: '1.2.3'
    })
  })

  it('broadcasts a ready snapshot after the update has been downloaded', () => {
    const updater = new FakeUpdater()
    const seen: Array<{ status: string; version: string | null }> = []
    const controller = new UpdaterController(updater, (snapshot) => {
      seen.push({ status: snapshot.status, version: snapshot.version })
    })

    controller.bind()
    updater.emit('update-downloaded', {
      version: '1.2.3',
      releaseDate: '2026-04-20T12:00:00.000Z',
      releaseNotes: '修复在线更新'
    })

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      version: '1.2.3'
    })
    expect(seen[seen.length - 1]).toEqual({
      status: 'ready',
      version: '1.2.3'
    })
  })

  it('falls back to a retryable ready state when quitAndInstall does not exit the app', () => {
    const updater = new FakeUpdater()
    let watchdog: (() => void) | null = null
    const controller = new UpdaterController(updater, () => void 0, {
      setTimeout: (callback) => {
        watchdog = callback
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: () => void 0
    })

    controller.bind()
    updater.emit('update-downloaded', {
      version: '1.2.3',
      releaseDate: '2026-04-20T12:00:00.000Z',
      releaseNotes: '修复在线更新'
    })

    controller.installDownloadedUpdate()

    expect(controller.getSnapshot()).toMatchObject({
      status: 'installing',
      version: '1.2.3'
    })
    expect(updater.quitCalls).toBe(1)

    if (watchdog) {
      ;(watchdog as () => void)()
    }

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      version: '1.2.3',
      errorMessage: '未能自动退出，请手动关闭应用后重试',
      errorRecoveryAction: 'install'
    })
  })

  it('rejects install requests until an update is ready', () => {
    const updater = new FakeUpdater()
    const controller = new UpdaterController(updater)

    controller.bind()

    expect(() => controller.installDownloadedUpdate()).toThrow(/not ready/i)
    expect(updater.quitCalls).toBe(0)
  })
})

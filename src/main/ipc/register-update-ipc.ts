import { BrowserWindow, ipcMain, Notification } from 'electron'
import {
  checkForUpdates,
  downloadAvailableUpdate,
  downloadManualInstallerUpdate,
  getAppVersion,
  getUpdateState,
  installDownloadedUpdate
} from '../updater/service'
import { applyWindowsTitlebarOverlay } from '../window-shell'
import type { DesktopTitlebarOverlayColors } from '../../shared/window-shell'

/**
 * SPLIT-007 — app:* + window:* IPC handlers.
 *
 * "Update" is the spine here (auto-updater state machine) but window
 * controls + native notifications come along because they share the
 * same lifecycle (chrome around the main BrowserWindow).
 */
export function registerUpdateIpc(): void {
  // Native notifications
  ipcMain.handle('window:notify', (_, title: string, body: string) => {
    if (!Notification.isSupported()) return false
    const n = new Notification({ title, body })
    n.show()
    return true
  })

  // Window chrome
  ipcMain.handle('window:setFullScreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setFullScreen(flag)
  })
  ipcMain.handle('window:isFullScreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isFullScreen() : false
  })
  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
  })
  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  ipcMain.handle('window:setTitleBarOverlay', (event, colors: Partial<DesktopTitlebarOverlayColors>) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? applyWindowsTitlebarOverlay(win, process.platform, colors) : false
  })

  // Auto-updater state machine
  ipcMain.handle('app:getUpdateState', () => getUpdateState())
  ipcMain.handle('app:getAppVersion', () => getAppVersion())
  ipcMain.handle('app:checkForUpdates', async () => {
    return await checkForUpdates()
  })
  ipcMain.handle('app:downloadUpdate', async () => {
    return await downloadAvailableUpdate()
  })
  ipcMain.handle('app:downloadManualInstallerUpdate', async () => {
    return await downloadManualInstallerUpdate()
  })
  ipcMain.handle('app:installDownloadedUpdate', async () => {
    await installDownloadedUpdate()
  })
  ipcMain.handle('app:reloadWindow', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.reload()
  })
}

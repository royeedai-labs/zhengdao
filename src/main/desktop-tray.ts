import { app, Menu, nativeImage, Tray, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import {
  DESKTOP_TRAY_TOOLTIP,
  getDesktopTrayMenuItems,
  shouldCreateDesktopTray,
  shouldHideWindowToTray
} from '../shared/desktop-tray'
import { normalizeDesktopShellPlatform } from '../shared/window-shell'
import { resolveRuntimeIconPath } from './window-shell'

let desktopTray: Tray | null = null
let explicitQuitRequested = false

export function markDesktopTrayQuitRequested(): void {
  explicitQuitRequested = true
}

export function shouldHideMainWindowToTray(platform: NodeJS.Platform): boolean {
  return desktopTray !== null && shouldHideWindowToTray(normalizeDesktopShellPlatform(platform), explicitQuitRequested)
}

export function shouldKeepAliveForDesktopTray(platform: NodeJS.Platform): boolean {
  return (
    desktopTray !== null && shouldCreateDesktopTray(normalizeDesktopShellPlatform(platform)) && !explicitQuitRequested
  )
}

function showMainWindow(mainWindow: BrowserWindow): void {
  if (mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function buildTrayContextMenu(mainWindow: BrowserWindow): Menu {
  const items: MenuItemConstructorOptions[] = getDesktopTrayMenuItems(mainWindow.isVisible()).map((item) => ({
    label: item.label,
    enabled: item.enabled,
    click: () => {
      if (item.action === 'show') {
        showMainWindow(mainWindow)
        return
      }

      if (item.action === 'hide') {
        mainWindow.hide()
        return
      }

      markDesktopTrayQuitRequested()
      desktopTray?.destroy()
      desktopTray = null
      app.quit()
    }
  }))

  items.splice(2, 0, { type: 'separator' })
  return Menu.buildFromTemplate(items)
}

function refreshTrayContextMenu(mainWindow: BrowserWindow): void {
  if (!desktopTray || mainWindow.isDestroyed()) return
  desktopTray.setContextMenu(buildTrayContextMenu(mainWindow))
}

export function createDesktopTray(
  mainWindow: BrowserWindow,
  platform: NodeJS.Platform = process.platform
): Tray | null {
  const normalizedPlatform = normalizeDesktopShellPlatform(platform)
  if (!shouldCreateDesktopTray(normalizedPlatform)) return null

  if (desktopTray) {
    refreshTrayContextMenu(mainWindow)
    return desktopTray
  }

  const iconPath = resolveRuntimeIconPath(['icon.ico', 'icon.png'])
  if (!iconPath) {
    console.warn('[Main] Tray icon not found; Windows tray will be disabled.')
    return null
  }

  const trayIcon = nativeImage.createFromPath(iconPath)
  desktopTray = new Tray(trayIcon)
  desktopTray.setToolTip(DESKTOP_TRAY_TOOLTIP)

  desktopTray.on('click', () => {
    showMainWindow(mainWindow)
    refreshTrayContextMenu(mainWindow)
  })
  desktopTray.on('double-click', () => {
    showMainWindow(mainWindow)
    refreshTrayContextMenu(mainWindow)
  })
  desktopTray.on('right-click', () => refreshTrayContextMenu(mainWindow))

  mainWindow.on('show', () => refreshTrayContextMenu(mainWindow))
  mainWindow.on('hide', () => refreshTrayContextMenu(mainWindow))
  mainWindow.on('minimize', () => refreshTrayContextMenu(mainWindow))
  mainWindow.on('restore', () => refreshTrayContextMenu(mainWindow))
  mainWindow.on('closed', () => {
    desktopTray?.destroy()
    desktopTray = null
  })

  refreshTrayContextMenu(mainWindow)
  return desktopTray
}

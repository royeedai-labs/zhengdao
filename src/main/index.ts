import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database/connection'
import { handleZhengdaoAuthCallbackUrl, registerIpcHandlers } from './ipc-handlers'
import { attachUpdaterWindow, notifyUpdaterAppActivated } from './updater/service'
import { registerBookCoverProtocol, registerBookCoverProtocolScheme } from './book-cover-protocol'
import {
  createDesktopTray,
  markDesktopTrayQuitRequested,
  shouldHideMainWindowToTray,
  shouldKeepAliveForDesktopTray
} from './desktop-tray'
import { applyDesktopWindowShell, getMainWindowShellOptions } from './window-shell'

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
  dialog.showErrorBox('应用程序错误', `发生了未预期的错误：\n${error.message}\n\n应用将尝试继续运行。`)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason)
})

let mainWindow: BrowserWindow | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()
registerBookCoverProtocolScheme()

function handleDeepLink(rawUrl: string): void {
  if (!rawUrl.startsWith('zhengdao://auth/callback')) return
  handleZhengdaoAuthCallbackUrl(rawUrl).catch((error) => {
    console.error('[Main] Zhengdao auth callback failed:', error)
    dialog.showErrorBox('证道账号登录失败', error instanceof Error ? error.message : String(error))
  })
}

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((item) => item.startsWith('zhengdao://'))
    if (url) handleDeepLink(url)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    ...getMainWindowShellOptions(process.platform),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, // required for better-sqlite3 native module access via preload
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    attachUpdaterWindow(mainWindow!)
  })

  mainWindow.on('close', (event) => {
    if (!mainWindow || !shouldHideMainWindowToTray(process.platform)) return
    event.preventDefault()
    mainWindow.hide()
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer process gone:', details.reason)
    if (details.reason !== 'clean-exit') {
      dialog.showErrorBox('渲染进程异常', `渲染进程异常退出 (${details.reason})。\n应用将重新加载。`)
      mainWindow?.reload()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.on('before-quit', markDesktopTrayQuitRequested)

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.zhengdao.app')
  if (!app.isDefaultProtocolClient('zhengdao')) {
    app.setAsDefaultProtocolClient('zhengdao')
  }
  const initialDeepLink = process.argv.find((item) => item.startsWith('zhengdao://'))
  if (initialDeepLink) handleDeepLink(initialDeepLink)
  if (process.platform === 'darwin') {
    app.setName('证道')
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    applyDesktopWindowShell(window, process.platform)
  })

  initDatabase()
  registerBookCoverProtocol()
  registerIpcHandlers()
  createDesktopTray(createWindow(), process.platform)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    notifyUpdaterAppActivated()
  })
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

app.on('window-all-closed', () => {
  if (shouldKeepAliveForDesktopTray(process.platform)) return
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }

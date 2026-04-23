import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database/connection'
import { registerIpcHandlers } from './ipc-handlers'
import { attachUpdaterWindow, notifyUpdaterAppActivated } from './updater/service'
import { applyDesktopWindowShell, getMainWindowShellOptions } from './window-shell'

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
  dialog.showErrorBox('应用程序错误', `发生了未预期的错误：\n${error.message}\n\n应用将尝试继续运行。`)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason)
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.zhengdao.app')
  if (process.platform === 'darwin') {
    app.setName('证道')
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    applyDesktopWindowShell(window, process.platform)
  })

  initDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    notifyUpdaterAppActivated()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }

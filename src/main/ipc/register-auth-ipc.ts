import { BrowserWindow, ipcMain } from 'electron'
import { cloudSync, zhengdaoAuth } from './state'

/**
 * SPLIT-007 — auth:* IPC handlers + the deep-link callback bridge.
 *
 * `handleZhengdaoAuthCallbackUrl` is exported to keep the deep-link entry
 * in main/index.ts working without import-path changes.
 */
export function registerAuthIpc(): void {
  ipcMain.handle('auth:login', async () => zhengdaoAuth.login())
  ipcMain.handle('auth:getUser', async () => zhengdaoAuth.getUser())
  ipcMain.handle('auth:logout', async () => {
    await zhengdaoAuth.logout()
  })
  ipcMain.handle('auth:getAccessToken', async () => zhengdaoAuth.getAccessToken())
  ipcMain.handle('auth:openUpgradePage', async () => zhengdaoAuth.openUpgradePage())
  ipcMain.handle('auth:openAccountPage', async () => zhengdaoAuth.openAccountPage())
  ipcMain.handle('auth:openCommunityFeedbackPage', async () => zhengdaoAuth.openCommunityFeedbackPage())
}

export async function handleZhengdaoAuthCallbackUrl(url: string): Promise<void> {
  const user = await zhengdaoAuth.handleCallback(url)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('auth:updated', user)
  }
  void cloudSync.syncAllBooks().catch((error) => console.warn('[CloudSync] login sync skipped', error))
}

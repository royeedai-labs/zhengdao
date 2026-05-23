import { BrowserWindow, ipcMain } from 'electron'
import { cloudSync, zhengdaoAuth } from './state'
import type { ZhengdaoAuthCredentials, ZhengdaoAuthResult, ZhengdaoRegisterInput, ZhengdaoUser } from '../auth/zhengdao-auth'

/**
 * SPLIT-007 — auth:* IPC handlers + the deep-link callback bridge.
 *
 * `handleZhengdaoAuthCallbackUrl` is exported to keep the deep-link entry
 * in main/index.ts working without import-path changes.
 */
export function registerAuthIpc(): void {
  ipcMain.handle('auth:login', async (_event, input: ZhengdaoAuthCredentials) => completeAuthResult(await zhengdaoAuth.login(input)))
  ipcMain.handle('auth:sendRegistrationCode', async (_event, email: string) => zhengdaoAuth.sendRegistrationCode(email))
  ipcMain.handle('auth:register', async (_event, input: ZhengdaoRegisterInput) => completeAuthResult(await zhengdaoAuth.register(input)))
  ipcMain.handle('auth:getUser', async () => zhengdaoAuth.getUser())
  ipcMain.handle('auth:logout', async () => {
    await zhengdaoAuth.logout()
  })
  ipcMain.handle('auth:getAccessToken', async () => zhengdaoAuth.getValidAccessToken())
  ipcMain.handle('auth:openUpgradePage', async () => zhengdaoAuth.openUpgradePage())
  ipcMain.handle('auth:openAccountPage', async () => zhengdaoAuth.openAccountPage())
  ipcMain.handle('auth:openCommunityFeedbackPage', async () => zhengdaoAuth.openCommunityFeedbackPage())
}

function broadcastAuthUpdated(user: ZhengdaoUser): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('auth:updated', user)
  }
}

async function completeAuthResult(result: ZhengdaoAuthResult): Promise<ZhengdaoAuthResult> {
  if (result.ok) {
    broadcastAuthUpdated(result.user)
    void cloudSync.syncAllBooks().catch((error) => console.warn('[CloudSync] login sync skipped', error))
  }
  return result
}

export async function handleZhengdaoAuthCallbackUrl(url: string): Promise<void> {
  const user = await zhengdaoAuth.handleCallback(url)
  broadcastAuthUpdated(user)
  void cloudSync.syncAllBooks().catch((error) => console.warn('[CloudSync] login sync skipped', error))
}

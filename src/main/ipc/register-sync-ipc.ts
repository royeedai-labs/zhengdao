import { app, dialog, ipcMain } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, normalize, resolve } from 'path'
import * as appStateRepo from '../database/app-state-repo'
import { autoBackup } from '../backup/auto-backup'
import { backupDatabaseFile, replaceDatabaseFromFile } from '../database/connection'
import { assertAllowedWritePath } from './path-security'
import { cloudSync, searchRepo } from './state'

/**
 * SPLIT-007 — sync:* + backup:* + data:* IPC handlers.
 *
 * Three cohorts that all move SQLite bytes around:
 *   - sync:* uploads/downloads books to cloud storage
 *   - backup:* manages local rotating backups (auto + manual)
 *   - data:* full database export / import for migration
 *
 * Co-located so the search-index rebuild (which every restore needs) is
 * called from one place.
 */

function restoreBackupFromPath(src: string): { ok: boolean; error?: string } {
  const magic = readFileSync(src).subarray(0, 15).toString('utf8')
  if (magic !== 'SQLite format 3') return { ok: false, error: '不是有效的 SQLite 数据库文件' }
  replaceDatabaseFromFile(src)
  searchRepo.rebuildIndex()
  return { ok: true }
}

export function registerSyncIpc(): void {
  // Cloud sync
  ipcMain.handle('sync:uploadBook', async (_, bookId: number) => {
    return cloudSync.syncBook(bookId)
  })
  ipcMain.handle('sync:syncAllBooks', async () => cloudSync.syncAllBooks({ force: true }))
  ipcMain.handle('sync:listCloudBooks', async () => cloudSync.listCloudBooks())
  ipcMain.handle('sync:downloadBook', async (_, fileId: string) => cloudSync.downloadBook(fileId))
  cloudSync.startBackgroundSync()

  // Local rotating backup
  ipcMain.handle(
    'backup:configure',
    (_, backupDir: string, intervalHours: number, maxFiles: number) => {
      const dir = backupDir.trim() || join(app.getPath('userData'), 'backups')
      appStateRepo.setAppState('backup_directory', dir)
      appStateRepo.setAppState('backup_interval_hours', String(intervalHours))
      appStateRepo.setAppState('backup_max_files', String(maxFiles))
      const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000
      autoBackup.start(dir, intervalMs, Math.max(1, maxFiles))
    }
  )

  ipcMain.handle('backup:now', async () => {
    const dir = appStateRepo.getAppState('backup_directory') || autoBackup.getDefaultBackupDir()
    const max = Number(appStateRepo.getAppState('backup_max_files') || '10')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await autoBackup.performBackup(dir, max)
  })

  ipcMain.handle('backup:list', () => {
    const dir = appStateRepo.getAppState('backup_directory') || autoBackup.getDefaultBackupDir()
    if (!existsSync(dir)) return []
    const files = readdirSync(dir).filter((f) => f.startsWith('zhengdao-backup-') && f.endsWith('.db'))
    const rows = files
      .map((name) => {
        const full = join(dir, name)
        try {
          const st = statSync(full)
          return {
            name,
            path: full,
            mtime: st.mtimeMs,
            size: st.size
          }
        } catch {
          return null
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    rows.sort((a, b) => b.mtime - a.mtime)
    return rows
  })

  ipcMain.handle('backup:restore', async () => {
    const pick = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite 备份', extensions: ['db'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { canceled: true as const }
    const r = restoreBackupFromPath(pick.filePaths[0])
    if (!r.ok) return { canceled: false as const, ok: false as const, error: r.error }
    return { canceled: false as const, ok: true as const }
  })

  ipcMain.handle('backup:restoreFrom', (_, filePath: string) =>
    restoreBackupFromPath(resolve(normalize(filePath)))
  )

  // Full export/import (migration / cross-device)
  ipcMain.handle('data:exportFull', async () => {
    const save = await dialog.showSaveDialog({
      defaultPath: 'zhengdao-export.db',
      filters: [{ name: 'SQLite 数据库', extensions: ['db'] }]
    })
    if (save.canceled || !save.filePath) return { canceled: true as const }
    const resolved = assertAllowedWritePath(save.filePath)
    await backupDatabaseFile(resolved)
    return { canceled: false as const, path: resolved }
  })

  ipcMain.handle('data:importFull', async () => {
    const pick = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '证道数据库', extensions: ['db'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { canceled: true as const }
    const src = pick.filePaths[0]
    const buf = readFileSync(src).subarray(0, 15)
    const magic = buf.toString('utf8')
    if (magic !== 'SQLite format 3') {
      return { canceled: false as const, ok: false as const, error: '不是有效的 SQLite 数据库文件' }
    }
    replaceDatabaseFromFile(src)
    searchRepo.rebuildIndex()
    return { canceled: false as const, ok: true as const }
  })
}

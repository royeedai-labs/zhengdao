import { ipcMain } from 'electron'
import * as writingIntelApi from '../writing-intel/writing-intel-api'
import type { WritingIntelQuery } from '../../shared/writing-intel'

/**
 * writingIntel:* is public, read-only market metadata. The backend owns the
 * source import and contract; desktop only browses published snapshots.
 */
export function registerWritingIntelIpc(): void {
  ipcMain.handle('writingIntel:sources', async (_, query?: Pick<WritingIntelQuery, 'platform' | 'limit'>) =>
    writingIntelApi.listSources(query)
  )
  ipcMain.handle('writingIntel:overview', async (_, query?: Pick<WritingIntelQuery, 'platform' | 'limit'>) =>
    writingIntelApi.getOverview(query)
  )
  ipcMain.handle('writingIntel:genreStats', async (_, query?: WritingIntelQuery) =>
    writingIntelApi.listGenreStats(query)
  )
  ipcMain.handle('writingIntel:rankings', async (_, query?: WritingIntelQuery) =>
    writingIntelApi.listRankings(query)
  )
  ipcMain.handle('writingIntel:trends', async (_, query?: WritingIntelQuery) =>
    writingIntelApi.listTrends(query)
  )
  ipcMain.handle('writingIntel:insights', async (_, query?: WritingIntelQuery) =>
    writingIntelApi.listInsights(query)
  )
}

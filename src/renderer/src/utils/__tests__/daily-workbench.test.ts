import { describe, expect, it } from 'vitest'
import {
  buildDailyWorkbenchModel,
  getLocalDateKey,
  selectLatestBackup,
  type BackupFileSummary
} from '../daily-workbench'

const baseInput = {
  dailyGoal: 3000,
  todayWords: 1200,
  streak: 4,
  currentChapterId: 1,
  currentChapterWords: 1800,
  saveStatus: {
    kind: 'saved' as const,
    chapterId: 1,
    savedAt: '2026-04-23T08:30:00.000Z',
    error: null
  },
  snapshotCount: 2,
  latestSnapshotAt: '2026-04-23T08:20:00.000Z',
  backups: [{ name: 'a.db', path: '/tmp/a.db', mtime: 100, size: 1 }],
  backupError: null
}

describe('daily workbench model', () => {
  it('uses local calendar dates for daily writing stats', () => {
    const date = new Date(2026, 3, 23, 1, 5)
    expect(getLocalDateKey(date)).toBe('2026-04-23')
  })

  it('calculates goal progress and separates save, snapshot, and local backup states', () => {
    const model = buildDailyWorkbenchModel({
      ...baseInput,
      cloudSync: {
        hasAccount: true,
        hasEntitlement: true,
        syncEnabled: true,
        syncing: false,
        lastBookSyncAt: '2026-04-23T08:25:00.000Z'
      }
    })
    expect(model.remainingWords).toBe(1800)
    expect(model.progressPercent).toBe(40)
    expect(model.save).toMatchObject({ tone: 'ok', label: '正文已保存' })
    expect(model.snapshot).toMatchObject({ tone: 'ok', label: '2 个快照' })
    expect(model.localBackup).toMatchObject({ tone: 'ok', label: '本地备份可用' })
    expect(model.cloudSync).toMatchObject({ tone: 'ok', label: '云端已同步' })
  })

  it('surfaces backup and save failures without confusing them with code runtime', () => {
    const model = buildDailyWorkbenchModel({
      ...baseInput,
      saveStatus: {
        kind: 'error',
        chapterId: 1,
        savedAt: null,
        error: 'disk full'
      },
      backups: [],
      backupError: 'permission denied'
    })
    expect(model.save).toMatchObject({ tone: 'danger', label: '保存失败', detail: 'disk full' })
    expect(model.localBackup).toMatchObject({ tone: 'danger', label: '本地备份失败' })
  })

  it('does not reuse another chapter save status after chapter switching', () => {
    const model = buildDailyWorkbenchModel({
      ...baseInput,
      currentChapterId: 2,
      saveStatus: {
        kind: 'saved',
        chapterId: 1,
        savedAt: '2026-04-23T08:30:00.000Z',
        error: null
      }
    })

    expect(model.save).toMatchObject({ tone: 'muted', label: '等待写作' })
  })

  it('keeps cloud backup state separate from local backup and account entitlement', () => {
    expect(buildDailyWorkbenchModel({
      ...baseInput,
      cloudSync: {
        hasAccount: false,
        hasEntitlement: false,
        syncEnabled: false,
        syncing: false,
        lastBookSyncAt: null
      }
    }).cloudSync).toMatchObject({ tone: 'muted', label: '仅本地写作' })

    expect(buildDailyWorkbenchModel({
      ...baseInput,
      cloudSync: {
        hasAccount: true,
        hasEntitlement: true,
        syncEnabled: false,
        syncing: false,
        lastBookSyncAt: null
      }
    }).cloudSync).toMatchObject({ tone: 'warn', label: '云备份关闭' })
  })

  it('selects the newest backup by mtime', () => {
    const backups: BackupFileSummary[] = [
      { name: 'old.db', path: '/tmp/old.db', mtime: 1, size: 1 },
      { name: 'new.db', path: '/tmp/new.db', mtime: 3, size: 1 },
      { name: 'mid.db', path: '/tmp/mid.db', mtime: 2, size: 1 }
    ]
    expect(selectLatestBackup(backups)?.name).toBe('new.db')
  })
})

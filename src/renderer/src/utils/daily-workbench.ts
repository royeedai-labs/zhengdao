export type SaveStatusKind = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type WorkbenchTone = 'ok' | 'warn' | 'danger' | 'muted'

export interface ChapterSaveStatus {
  kind: SaveStatusKind
  chapterId: number | null
  savedAt: string | null
  error: string | null
}

export interface BackupFileSummary {
  name: string
  path: string
  mtime: number
  size: number
}

export interface DailyWorkbenchInput {
  dailyGoal: number
  todayWords: number
  streak: number
  currentChapterId: number | null
  currentChapterWords: number
  saveStatus: ChapterSaveStatus
  snapshotCount: number
  latestSnapshotAt: string | null
  backups: BackupFileSummary[]
  backupError?: string | null
}

export interface DailyWorkbenchModel {
  dailyGoal: number
  todayWords: number
  remainingWords: number
  progressPercent: number
  streak: number
  currentChapterWords: number
  save: {
    tone: WorkbenchTone
    label: string
    detail: string
  }
  snapshot: {
    tone: WorkbenchTone
    label: string
    detail: string
  }
  localBackup: {
    tone: WorkbenchTone
    label: string
    detail: string
  }
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCompactDateTime(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function selectLatestBackup(backups: BackupFileSummary[]): BackupFileSummary | null {
  if (backups.length === 0) return null
  return [...backups].sort((a, b) => b.mtime - a.mtime)[0]
}

export function createInitialSaveStatus(chapterId: number | null = null): ChapterSaveStatus {
  return {
    kind: 'idle',
    chapterId,
    savedAt: null,
    error: null
  }
}

export function buildDailyWorkbenchModel(input: DailyWorkbenchInput): DailyWorkbenchModel {
  const dailyGoal = Math.max(0, Math.round(input.dailyGoal || 0))
  const todayWords = Math.max(0, Math.round(input.todayWords || 0))
  const remainingWords = dailyGoal > 0 ? Math.max(0, dailyGoal - todayWords) : 0
  const progressPercent = dailyGoal > 0 ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0
  const latestBackup = selectLatestBackup(input.backups)

  let save: DailyWorkbenchModel['save']
  if (!input.currentChapterId) {
    save = { tone: 'muted', label: '未选章节', detail: '选择章节后开始保存追踪' }
  } else if (input.saveStatus.kind === 'error') {
    save = { tone: 'danger', label: '保存失败', detail: input.saveStatus.error || '请手动重试保存' }
  } else if (input.saveStatus.kind === 'dirty') {
    save = { tone: 'warn', label: '有未保存内容', detail: '自动保存排队中' }
  } else if (input.saveStatus.kind === 'saving') {
    save = { tone: 'warn', label: '保存中', detail: '正在写入本地数据库' }
  } else if (input.saveStatus.kind === 'saved') {
    save = { tone: 'ok', label: '正文已保存', detail: formatCompactDateTime(input.saveStatus.savedAt) }
  } else {
    save = { tone: 'muted', label: '等待写作', detail: '当前章节尚无新的保存记录' }
  }

  const snapshot =
    input.snapshotCount > 0
      ? {
          tone: 'ok' as const,
          label: `${input.snapshotCount} 个快照`,
          detail: `最近 ${formatCompactDateTime(input.latestSnapshotAt)}`
        }
      : {
          tone: input.currentChapterId ? ('warn' as const) : ('muted' as const),
          label: '暂无快照',
          detail: input.currentChapterId ? '写作一段时间后会自动生成' : '选择章节后可查看'
        }

  const localBackup = input.backupError
    ? {
        tone: 'danger' as const,
        label: '本地备份失败',
        detail: input.backupError
      }
    : latestBackup
      ? {
          tone: 'ok' as const,
          label: '本地备份可用',
          detail: formatCompactDateTime(latestBackup.mtime)
        }
      : {
          tone: 'warn' as const,
          label: '未发现本地备份',
          detail: '建议立即备份一次'
        }

  return {
    dailyGoal,
    todayWords,
    remainingWords,
    progressPercent,
    streak: Math.max(0, Math.round(input.streak || 0)),
    currentChapterWords: Math.max(0, Math.round(input.currentChapterWords || 0)),
    save,
    snapshot,
    localBackup
  }
}

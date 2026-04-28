import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Bot, FileCheck2, HardDrive, Loader2, RefreshCw, ShieldCheck, Target } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useConfigStore } from '@/stores/config-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import {
  buildDailyWorkbenchModel,
  getLocalDateKey,
  type BackupFileSummary,
  type WorkbenchTone
} from '@/utils/daily-workbench'
import { resolveProjectDailyGoal } from '@/utils/daily-goal'

function toneClass(tone: WorkbenchTone): string {
  switch (tone) {
    case 'ok':
      return 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-primary)]'
    case 'warn':
      return 'border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-primary)]'
    case 'danger':
      return 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-primary)]'
    default:
      return 'border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-muted)]'
  }
}

function StatusChip({
  icon,
  label,
  detail,
  tone = 'muted',
  onClick,
  title
}: {
  icon: ReactNode
  label: string
  detail?: string
  tone?: WorkbenchTone
  onClick?: () => void
  title?: string
}) {
  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate font-semibold">{label}</span>
      {detail && <span className="hidden max-w-[96px] truncate text-[10px] opacity-80 lg:inline">{detail}</span>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || detail || label}
        className={`inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-2 text-[11px] transition hover:brightness-105 no-drag ${toneClass(tone)}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      title={title || detail || label}
      className={`inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-2 text-[11px] ${toneClass(tone)}`}
    >
      {content}
    </div>
  )
}

export default function DailyWorkbench() {
  const bookId = useBookStore((s) => s.currentBookId)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const config = useConfigStore((s) => s.config)
  const systemDailyGoal = useSettingsStore((s) => s.systemDailyGoal)
  const warningCount = useForeshadowStore((s) => s.getWarningCount())
  const openModal = useUIStore((s) => s.openModal)
  const [todayWords, setTodayWords] = useState(0)
  const [streak, setStreak] = useState(0)
  const [backups, setBackups] = useState<BackupFileSummary[]>([])
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    void (async () => {
      const today = getLocalDateKey()
      const [daily, achievement] = await Promise.all([
        window.api.getDailyStats(bookId, today) as Promise<{ word_count?: number }>,
        window.api.getAchievementStats(bookId) as Promise<{ streak?: number }>
      ])
      if (cancelled) return
      setTodayWords(daily.word_count ?? 0)
      setStreak(achievement.streak ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, currentChapter?.word_count])

  const refreshBackups = async () => {
    try {
      const rows = (await window.api.backupList()) as BackupFileSummary[]
      setBackups(rows)
      setBackupError(null)
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '读取备份失败')
    }
  }

  useEffect(() => {
    void refreshBackups()
  }, [])

  const model = buildDailyWorkbenchModel({
    dailyGoal: resolveProjectDailyGoal(config, systemDailyGoal),
    todayWords,
    streak,
    currentChapterId: currentChapter?.id ?? null,
    currentChapterWords: currentChapter?.word_count ?? 0,
    backups,
    backupError
  })

  const runLocalBackup = async () => {
    setBackupBusy(true)
    setBackupError(null)
    try {
      await window.api.backupNow()
      await refreshBackups()
      useToastStore.getState().addToast('success', '本地备份已完成')
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地备份失败'
      setBackupError(message)
      useToastStore.getState().addToast('error', message)
    } finally {
      setBackupBusy(false)
    }
  }

  return (
    <div className="daily-workbench flex h-11 shrink-0 items-center gap-3 overflow-x-auto border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 text-[var(--text-secondary)]">
      <div className="flex min-w-[176px] items-center gap-2">
        <Target size={15} className="shrink-0 text-[var(--accent-secondary)]" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <span>{model.todayWords.toLocaleString()} / {model.dailyGoal.toLocaleString()} 字</span>
            {model.remainingWords > 0 ? (
              <span className="text-[10px] text-[var(--text-muted)]">差 {model.remainingWords.toLocaleString()}</span>
            ) : (
              <span className="text-[10px] text-[var(--success-primary)]">达标</span>
            )}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div className="h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${model.progressPercent}%` }} />
          </div>
        </div>
      </div>

      <StatusChip
        icon={<ShieldCheck size={13} />}
        label="运行正常"
        detail={`连续 ${model.streak} 天`}
        tone="ok"
        title="代码运行状态正常；此状态不等同于外部备份完成"
      />
      <StatusChip
        icon={backupBusy ? <Loader2 size={13} className="animate-spin" /> : <HardDrive size={13} />}
        label={backupBusy ? '备份中' : model.localBackup.label}
        detail={model.localBackup.detail}
        tone={backupBusy ? 'warn' : model.localBackup.tone}
        onClick={() => void runLocalBackup()}
        title="立即创建本地数据库备份"
      />
      <StatusChip
        icon={<AlertTriangle size={13} />}
        label={warningCount > 0 ? `${warningCount} 个风险` : '暂无伏笔风险'}
        detail={warningCount > 0 ? '打开伏笔看板' : '继续写作'}
        tone={warningCount > 0 ? 'warn' : 'muted'}
        onClick={() => openModal('foreshadowBoard')}
      />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => openModal('chapterReview')}
          disabled={!currentChapter}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-surface)] px-2 text-[11px] font-semibold text-[var(--accent-secondary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          title="步骤 1：打开本章审稿台"
        >
          <span className="font-mono text-[10px] opacity-70">1</span>
          <Bot size={13} /> 审稿
        </button>
        <button
          type="button"
          onClick={() => openModal('publishCheck')}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 text-[11px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
          title="步骤 2：打开发布前检查包"
        >
          <span className="font-mono text-[10px] opacity-70">2</span>
          <FileCheck2 size={13} /> 发布
        </button>
        <button
          type="button"
          onClick={() => {
            void refreshBackups()
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-primary)] text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          title="刷新工作台状态"
          aria-label="刷新工作台状态"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  )
}

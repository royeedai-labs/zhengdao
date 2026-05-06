import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clipboard, Download, FileText, Loader2, ShieldAlert, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useConfigStore } from '@/stores/config-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { generateDocx } from '@/utils/export-docx'
import { exportToMarkdown } from '@/utils/export-md'
import { getSensitiveWords } from '@/utils/sensitive-words'
import {
  buildPublishPackage,
  countCnWords,
  htmlToPublishText,
  PLATFORM_NEUTRAL_RULES,
  type PublishCheckChapter,
  type PublishIssue,
  type PublishCheckScope
} from '@/utils/publish-check'
import type { Chapter, ChapterMeta } from '@/types'

type ExportFormat = 'txt' | 'docx' | 'md'
type IssueTone = 'default' | 'success' | 'warning' | 'danger'

interface PreviewChapter {
  id: number
  title: string
  volumeTitle: string
  wordCount: number
  body: string
  issues: PublishIssue[]
  dangerCount: number
  warningCount: number
}

function getChapterTitle(chapter: PublishCheckChapter): string {
  return chapter.title.trim() || '未命名章节'
}

function buildPreviewBody(content: string | null | undefined): string {
  return htmlToPublishText(content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `\u3000\u3000${line}`)
    .join('\n')
}

function buildIssuesByChapter(issues: PublishIssue[]): Map<number, PublishIssue[]> {
  const byChapter = new Map<number, PublishIssue[]>()
  for (const issue of issues) {
    const list = byChapter.get(issue.chapterId) || []
    list.push(issue)
    byChapter.set(issue.chapterId, list)
  }
  return byChapter
}

function toPublishCheckChapter(chapter: Chapter | ChapterMeta, volumeTitle = ''): PublishCheckChapter {
  return {
    id: chapter.id,
    title: chapter.title,
    content: 'content' in chapter ? chapter.content ?? null : null,
    word_count: chapter.word_count,
    volume_title: volumeTitle
  }
}

function StatPill({ label, value, tone = 'default' }: { label: string; value: string; tone?: IssueTone }) {
  const valueClass =
    tone === 'danger'
      ? 'text-[var(--danger-primary)]'
      : tone === 'warning'
        ? 'text-[var(--warning-primary)]'
        : tone === 'success'
          ? 'text-[var(--success-primary)]'
          : 'text-[var(--text-primary)]'

  return (
    <div className="min-w-[72px] rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-1.5 text-center">
      <div className={`text-sm font-bold leading-5 ${valueClass}`}>{value}</div>
      <div className="text-[10px] leading-4 text-[var(--text-muted)]">{label}</div>
    </div>
  )
}

function issueCardClass(severity: PublishIssue['severity']): string {
  return severity === 'danger'
    ? 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-primary)]'
    : 'border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-primary)]'
}

export default function PublishCheckModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData) as { scope?: PublishCheckScope } | null
  const bookId = useBookStore((s) => s.currentBookId)
  const books = useBookStore((s) => s.books)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const volumes = useChapterStore((s) => s.volumes)
  const config = useConfigStore((s) => s.config)
  const [scope, setScope] = useState<PublishCheckScope>(() => (modalData?.scope === 'book' ? 'book' : 'chapter'))
  const [chapters, setChapters] = useState<PublishCheckChapter[]>([])
  const [loading, setLoading] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt')
  const [busy, setBusy] = useState(false)

  const book = books.find((item) => item.id === bookId)

  useEffect(() => {
    if (!currentChapter && scope === 'chapter') setScope('book')
  }, [currentChapter, scope])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = (await window.api.getAllChaptersForBook(bookId)) as PublishCheckChapter[]
        if (!cancelled) setChapters(rows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookId])

  const fallbackChapters = useMemo(() => {
    const byId = new Map<number, PublishCheckChapter>()
    for (const volume of volumes) {
      for (const chapter of volume.chapters || []) {
        byId.set(chapter.id, toPublishCheckChapter(chapter, volume.title))
      }
    }
    if (currentChapter && !byId.has(currentChapter.id)) {
      byId.set(currentChapter.id, toPublishCheckChapter(currentChapter))
    }
    return Array.from(byId.values())
  }, [currentChapter, volumes])

  const availableChapters = chapters.length > 0 ? chapters : fallbackChapters

  const selectedChapters = useMemo(() => {
    if (scope === 'book') return availableChapters
    if (!currentChapter) return []
    return availableChapters.filter((chapter) => chapter.id === currentChapter.id)
  }, [availableChapters, currentChapter, scope])
  const exportChapters = useMemo(
    () => selectedChapters.map((chapter) => ({ ...chapter, volume_title: chapter.volume_title || '' })),
    [selectedChapters]
  )

  const publishPackage = useMemo(() => {
    return buildPublishPackage(
      scope,
      selectedChapters,
      getSensitiveWords(config?.sensitive_list || 'default')
    )
  }, [config?.sensitive_list, scope, selectedChapters])

  const dangerCount = publishPackage.issues.filter((issue) => issue.severity === 'danger').length
  const warningCount = publishPackage.issues.filter((issue) => issue.severity === 'warning').length
  const issueTone: IssueTone = dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'success'
  const statusLabel = dangerCount > 0 ? `${dangerCount} 个阻断` : warningCount > 0 ? `${warningCount} 个提醒` : '可发布'
  const statusClass =
    dangerCount > 0
      ? 'text-[var(--danger-primary)]'
      : warningCount > 0
        ? 'text-[var(--warning-primary)]'
        : 'text-[var(--success-primary)]'
  const issuesByChapter = useMemo(() => buildIssuesByChapter(publishPackage.issues), [publishPackage.issues])
  const previewChapters = useMemo<PreviewChapter[]>(() => {
    return selectedChapters.map((chapter) => {
      const plainText = htmlToPublishText(chapter.content)
      const issues = issuesByChapter.get(chapter.id) || []
      return {
        id: chapter.id,
        title: getChapterTitle(chapter),
        volumeTitle: chapter.volume_title || '',
        wordCount: chapter.word_count ?? countCnWords(plainText),
        body: buildPreviewBody(chapter.content),
        issues,
        dangerCount: issues.filter((issue) => issue.severity === 'danger').length,
        warningCount: issues.filter((issue) => issue.severity === 'warning').length
      }
    })
  }, [issuesByChapter, selectedChapters])
  const issueGroups = useMemo(() => previewChapters.filter((chapter) => chapter.issues.length > 0), [previewChapters])

  const scrollToChapter = (chapterId: number) => {
    document.getElementById(`publish-preview-chapter-${chapterId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  const copyPublishText = async () => {
    try {
      await navigator.clipboard.writeText(publishPackage.text)
      useToastStore.getState().addToast('success', '发布稿已复制')
    } catch {
      useToastStore.getState().addToast('error', '复制失败，请检查剪贴板权限')
    }
  }

  const exportPackage = async () => {
    if (!book || selectedChapters.length === 0) return
    setBusy(true)
    try {
      let data: Uint8Array | string
      let ext: string
      let filterName: string
      const title = scope === 'chapter' && currentChapter ? currentChapter.title : book.title
      if (exportFormat === 'docx') {
        data = await generateDocx(book.title, book.author || '', exportChapters)
        ext = 'docx'
        filterName = 'Word 文档'
      } else if (exportFormat === 'md') {
        data = exportToMarkdown(book.title, book.author || '', exportChapters)
        ext = 'md'
        filterName = 'Markdown'
      } else {
        data = publishPackage.text
        ext = 'txt'
        filterName = '纯文本'
      }

      const saveResult = await window.api.showSaveDialog({
        title: '导出发布稿',
        defaultPath: `${title}.${ext}`,
        filters: [{ name: filterName, extensions: [ext] }]
      })
      if (saveResult.canceled || !saveResult.filePath) return

      if (typeof data === 'string') {
        const buf = new Uint8Array(await new Blob([data], { type: 'text/plain' }).arrayBuffer())
        await window.api.writeFile(saveResult.filePath, buf)
      } else {
        await window.api.writeFile(saveResult.filePath, data)
      }
      useToastStore.getState().addToast('success', '发布稿已导出')
    } catch (error) {
      useToastStore.getState().addToast('error', error instanceof Error ? error.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-check-title"
        className="flex h-[calc(100vh-24px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <FileText size={18} className="shrink-0 text-[var(--accent-secondary)]" />
            <span id="publish-check-title" className="shrink-0">发布前检查包</span>
            <span className="truncate text-xs font-normal text-[var(--text-muted)]">
              {book?.title || '当前作品'} · {scope === 'book' ? '全书' : currentChapter?.title || '当前章节'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-1">
            <button
              type="button"
              disabled={!currentChapter}
              onClick={() => setScope('chapter')}
              className={`h-8 rounded px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                scope === 'chapter'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              当前章节
            </button>
            <button
              type="button"
              onClick={() => setScope('book')}
              className={`h-8 rounded px-3 text-xs font-semibold transition ${
                scope === 'book'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              全书
            </button>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <StatPill label="章节" value={selectedChapters.length.toLocaleString()} />
            <StatPill label="字数" value={publishPackage.totalWords.toLocaleString()} />
            <StatPill label="问题" value={(dangerCount + warningCount).toLocaleString()} tone={issueTone} />
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="关闭发布前检查包"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col bg-[var(--bg-primary)]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-primary)] bg-[var(--surface-primary)] px-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)]">发布稿预览</div>
                <div className="truncate text-xs text-[var(--text-muted)]">
                  {scope === 'book' ? book?.title || '全书发布稿' : currentChapter?.title || '未选择章节'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 lg:hidden">
                <StatPill label="章节" value={selectedChapters.length.toLocaleString()} />
                <StatPill label="问题" value={(dangerCount + warningCount).toLocaleString()} tone={issueTone} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {loading ? (
                <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[var(--text-muted)]">
                  <Loader2 size={18} className="mr-2 animate-spin" /> 加载章节中…
                </div>
              ) : previewChapters.length === 0 ? (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--surface-primary)] text-sm text-[var(--text-muted)]">
                  暂无可预览的发布稿。
                </div>
              ) : (
                <div className="mx-auto max-w-4xl space-y-4 select-text">
                  {previewChapters.map((chapter) => (
                    <article
                      key={chapter.id}
                      id={`publish-preview-chapter-${chapter.id}`}
                      className={`scroll-mt-4 overflow-hidden rounded-lg border bg-[var(--surface-primary)] shadow-sm ${
                        chapter.dangerCount > 0
                          ? 'border-[var(--danger-border)]'
                          : chapter.warningCount > 0
                            ? 'border-[var(--warning-border)]'
                            : 'border-[var(--border-primary)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-[var(--text-primary)]">{chapter.title}</h2>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                            {chapter.volumeTitle && <span>{chapter.volumeTitle}</span>}
                            <span>{chapter.wordCount.toLocaleString()} 字</span>
                          </div>
                        </div>
                        {chapter.issues.length > 0 && (
                          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            {chapter.dangerCount > 0 && (
                              <span className="rounded border border-[var(--danger-border)] bg-[var(--danger-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--danger-primary)]">
                                {chapter.dangerCount} 阻断
                              </span>
                            )}
                            {chapter.warningCount > 0 && (
                              <span className="rounded border border-[var(--warning-border)] bg-[var(--warning-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--warning-primary)]">
                                {chapter.warningCount} 提醒
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {chapter.body ? (
                        <pre className="whitespace-pre-wrap break-words px-6 py-5 font-serif text-[15px] leading-8 text-[var(--text-primary)]">
                          {chapter.body}
                        </pre>
                      ) : (
                        <div className="px-6 py-8 text-sm text-[var(--text-muted)]">（空正文）</div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] xl:border-l xl:border-t-0">
            <div className="shrink-0 border-b border-[var(--border-primary)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  {dangerCount === 0 ? (
                    <CheckCircle2 size={16} className="text-[var(--success-primary)]" />
                  ) : (
                    <ShieldAlert size={16} className="text-[var(--danger-primary)]" />
                  )}
                  检查结果
                </div>
                <span className={`text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatPill label="阻断" value={dangerCount.toLocaleString()} tone={dangerCount > 0 ? 'danger' : 'success'} />
                <StatPill label="提醒" value={warningCount.toLocaleString()} tone={warningCount > 0 ? 'warning' : 'success'} />
                <StatPill label="字数" value={publishPackage.totalWords.toLocaleString()} />
              </div>
              <div className="mt-3 rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 text-xs text-[var(--text-secondary)]">
                {PLATFORM_NEUTRAL_RULES.join('、')}；不接平台投稿 API，不自动改正文。
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex h-28 items-center justify-center text-sm text-[var(--text-muted)]">
                  <Loader2 size={18} className="mr-2 animate-spin" /> 加载章节中…
                </div>
              ) : publishPackage.issues.length === 0 ? (
                <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-surface)] p-4 text-sm text-[var(--success-primary)]">
                  未发现发布前阻断问题。
                </div>
              ) : (
                <div className="space-y-3">
                  {issueGroups.map((group) => (
                    <div key={group.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
                      <button
                        type="button"
                        onClick={() => scrollToChapter(group.id)}
                        className="flex w-full items-center justify-between gap-3 text-left text-xs font-bold text-[var(--text-primary)] transition hover:text-[var(--accent-secondary)]"
                      >
                        <span className="truncate">{group.title}</span>
                        <span className="shrink-0 text-[var(--text-muted)]">{group.issues.length}</span>
                      </button>
                      <div className="mt-2 space-y-1.5">
                        {group.issues.map((issue, index) => (
                          <button
                            type="button"
                            key={`${issue.kind}-${issue.chapterId}-${issue.word || ''}-${index}`}
                            onClick={() => scrollToChapter(issue.chapterId)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-xs transition hover:brightness-105 ${issueCardClass(issue.severity)}`}
                          >
                            <div className="font-semibold">{issue.severity === 'danger' ? '阻断' : '提醒'}</div>
                            <div className="mt-1 leading-5">{issue.message}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t border-[var(--border-primary)] p-4">
              <button
                type="button"
                disabled={selectedChapters.length === 0}
                onClick={() => void copyPublishText()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clipboard size={15} /> 复制发布稿
              </button>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                  className="min-w-0 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                >
                  <option value="txt">TXT</option>
                  <option value="docx">DOCX</option>
                  <option value="md">Markdown</option>
                </select>
                <button
                  type="button"
                  disabled={busy || selectedChapters.length === 0}
                  onClick={() => void exportPackage()}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  导出
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

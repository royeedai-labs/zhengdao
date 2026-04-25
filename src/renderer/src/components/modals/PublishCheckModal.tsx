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
  type PublishCheckChapter,
  type PublishCheckScope
} from '@/utils/publish-check'

type ExportFormat = 'txt' | 'docx' | 'md'

export default function PublishCheckModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const bookId = useBookStore((s) => s.currentBookId)
  const books = useBookStore((s) => s.books)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const config = useConfigStore((s) => s.config)
  const [scope, setScope] = useState<PublishCheckScope>('chapter')
  const [chapters, setChapters] = useState<PublishCheckChapter[]>([])
  const [loading, setLoading] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt')
  const [busy, setBusy] = useState(false)

  const book = books.find((item) => item.id === bookId)

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

  const selectedChapters = useMemo(() => {
    if (scope === 'book') return chapters
    if (!currentChapter) return []
    return chapters.filter((chapter) => chapter.id === currentChapter.id)
  }, [chapters, currentChapter, scope])
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <FileText size={18} className="text-[var(--accent-secondary)]" />
            <span>发布前检查包</span>
            <span className="text-xs font-normal text-[var(--text-muted)]">平台中立 · 离线可用</span>
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!currentChapter}
                onClick={() => setScope('chapter')}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                  scope === 'chapter'
                    ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                当前章节
              </button>
              <button
                type="button"
                onClick={() => setScope('book')}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  scope === 'book'
                    ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                全书
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
                <div className="text-lg font-bold text-[var(--text-primary)]">{selectedChapters.length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">章节</div>
              </div>
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
                <div className="text-lg font-bold text-[var(--text-primary)]">{publishPackage.totalWords.toLocaleString()}</div>
                <div className="text-[10px] text-[var(--text-muted)]">字数</div>
              </div>
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
                <div className={`text-lg font-bold ${dangerCount > 0 ? 'text-[var(--danger-primary)]' : 'text-[var(--success-primary)]'}`}>
                  {dangerCount + warningCount}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">问题</div>
              </div>
            </div>

            <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <ShieldAlert size={14} /> 检查项
              </div>
              <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                <div>敏感词命中</div>
                <div>空标题 / 空正文</div>
                <div>章节字数异常</div>
                <div>HTML 转纯文本预览</div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={selectedChapters.length === 0}
                onClick={() => void copyPublishText()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:opacity-50"
              >
                <Clipboard size={15} /> 复制发布稿
              </button>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                  className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                >
                  <option value="txt">TXT</option>
                  <option value="docx">DOCX</option>
                  <option value="md">Markdown</option>
                </select>
                <button
                  type="button"
                  disabled={busy || selectedChapters.length === 0}
                  onClick={() => void exportPackage()}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  导出
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 grid-rows-[minmax(160px,0.9fr)_minmax(180px,1.1fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-[var(--border-primary)] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                {dangerCount === 0 ? <CheckCircle2 size={16} className="text-[var(--success-primary)]" /> : <ShieldAlert size={16} className="text-[var(--danger-primary)]" />}
                检查结果
              </div>
              {loading ? (
                <div className="flex h-28 items-center justify-center text-sm text-[var(--text-muted)]">
                  <Loader2 size={18} className="mr-2 animate-spin" /> 加载章节中…
                </div>
              ) : publishPackage.issues.length === 0 ? (
                <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-surface)] p-4 text-sm text-[var(--success-primary)]">
                  未发现发布前阻断问题。
                </div>
              ) : (
                <div className="space-y-2">
                  {publishPackage.issues.map((issue, index) => (
                    <div
                      key={`${issue.kind}-${issue.chapterId}-${issue.word || ''}-${index}`}
                      className={`rounded-md border p-3 text-xs ${
                        issue.severity === 'danger'
                          ? 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-primary)]'
                          : 'border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-primary)]'
                      }`}
                    >
                      <div className="font-semibold">{issue.chapterTitle}</div>
                      <div className="mt-1">{issue.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 overflow-hidden p-4">
              <div className="mb-3 text-sm font-bold text-[var(--text-primary)]">纯文本预览</div>
              <textarea
                readOnly
                value={publishPackage.text}
                className="h-[calc(100%-32px)] w-full resize-none rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 font-serif text-sm leading-7 text-[var(--text-primary)] outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

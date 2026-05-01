import { useEffect, useState } from 'react'
import { AlertCircle, BookOpen, Loader2, Wand2, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useToastStore } from '@/stores/toast-store'
import { useBookStore } from '@/stores/book-store'
import { stripHtmlToText } from '@/utils/html-to-text'
import { getActiveEditor } from '@/components/editor/active-editor'
import { SkillFeedbackForm } from '@/components/ai/SkillFeedbackForm'

/**
 * DI-02 v3 — 文末参考文献章节生成 modal
 *
 * 调用后端 layer2.references-section-build, 输入: citations 元数据全集 +
 * 拼接好的全本正文 (用于本地 [@key] 锚点抓取) + style 选项。
 *
 * 输出: referencesText (markdown 列表) + used / unused / missing citekey
 * 三类清单。modal 渲染分类计数 + referencesText 预览, 用户确认后通过
 * active editor insertContent 到当前章节末尾, 或复制到剪贴板手动粘贴。
 */

type CitationStyle = 'gb-t-7714' | 'apa' | 'mla'

const STYLE_OPTIONS: Array<{ id: CitationStyle; label: string; hint: string }> = [
  { id: 'gb-t-7714', label: 'GB/T 7714-2015', hint: '中国国家标准 (默认, 中文学术)' },
  { id: 'apa', label: 'APA 7', hint: '美国心理学会, 社科 / 心理 / 教育常用' },
  { id: 'mla', label: 'MLA 9', hint: '现代语言协会, 文学 / 语言学常用' }
]

interface CitationRow {
  id: number
  citekey: string
  citation_type: 'book' | 'journal' | 'conference' | 'website' | 'thesis' | 'report' | 'other'
  authors: string
  title: string
  year: number | null
  publisher: string
  journal: string
  volume: string
  issue: string
  pages: string
  doi: string
  url: string
  notes: string
}

interface ReferencesBuildOutput {
  projectId: string
  citationStyle: CitationStyle
  referencesText: string
  usedCitekeys: string[]
  unusedCitekeys: string[]
  missingCitekeys: string[]
}

interface ChapterContentRow {
  title: string
  content: string | null
}

async function loadManuscriptText(bookId: number): Promise<string> {
  const rows = (await window.api.getAllChaptersForBook(bookId)) as ChapterContentRow[]
  return rows
    .map((chapter) => stripHtmlToText(chapter.content || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

export default function ReferencesBuildModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const bookId = useBookStore((s) => s.currentBookId)
  const addToast = useToastStore((s) => s.addToast)

  const [style, setStyle] = useState<CitationStyle>('gb-t-7714')
  const [citations, setCitations] = useState<CitationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReferencesBuildOutput | null>(null)
  const [feedbackRunId, setFeedbackRunId] = useState<string | null>(null)
  const [manuscriptCharCount, setManuscriptCharCount] = useState(0)

  useEffect(() => {
    if (!bookId) return
    setLoading(true)
    void window.api
      .listCitations(bookId)
      .then((rows: unknown) => setCitations(rows as CitationRow[]))
      .finally(() => setLoading(false))
  }, [bookId])

  useEffect(() => {
    if (!bookId) {
      setManuscriptCharCount(0)
      return
    }
    let cancelled = false
    void loadManuscriptText(bookId)
      .then((text) => {
        if (!cancelled) setManuscriptCharCount(text.length)
      })
      .catch(() => {
        if (!cancelled) setManuscriptCharCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [bookId])

  const handleBuild = async () => {
    if (!bookId) return
    if (citations.length === 0) {
      addToast('warning', '当前作品没有引文条目, 请先在引文管理里添加')
      return
    }
    setRunning(true)
    setResult(null)
    setFeedbackRunId(null)
    try {
      const manuscriptText = await loadManuscriptText(bookId)
      const r = await window.api.aiExecuteSkill(
        'layer2.references-section-build',
        {
          projectId: String(bookId),
          citations: citations.map((c) => ({
            citekey: c.citekey,
            citation_type: c.citation_type,
            authors: c.authors,
            title: c.title,
            year: c.year,
            publisher: c.publisher,
            journal: c.journal,
            volume: c.volume,
            issue: c.issue,
            pages: c.pages,
            doi: c.doi,
            url: c.url,
            notes: c.notes
          })),
          manuscriptText,
          citationStyle: style
        },
        { modelHint: 'balanced' }
      )
      if (r.error) {
        const msg =
          r.code === 'PRO_REQUIRED'
            ? '参考文献生成是 Pro 功能, 请先升级证道 Pro'
            : r.code === 'GENRE_PACK_REQUIRED'
              ? '学术题材包未订阅, 该 Skill 仅 academic 题材包用户可用'
              : r.code === 'SKILL_TIMEOUT'
                ? '生成超时, 请减少引文条目或稍后再试'
                : r.error.includes('GENRE_MISMATCH')
                  ? '当前作品题材不是 academic, 该 Skill 仅在学术题材下可用'
                  : r.error
        addToast('error', msg)
        return
      }
      setResult(r.output as ReferencesBuildOutput)
      setFeedbackRunId(r.runId || null)
    } finally {
      setRunning(false)
    }
  }

  const handleInsertToChapter = () => {
    if (!result) return
    const editor = getActiveEditor()
    if (!editor) {
      addToast('error', '未找到活跃编辑器, 无法插入参考文献')
      return
    }
    const heading = '\n\n## 参考文献\n\n'
    editor
      .chain()
      .focus('end')
      .insertContent(heading + result.referencesText)
      .run()
    addToast('success', '参考文献已插入到当前章节末尾')
    closeModal()
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.referencesText)
      addToast('success', '已复制到剪贴板')
    } catch {
      addToast('error', '复制失败, 请手动选择文本')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <BookOpen size={18} className="text-[var(--accent-secondary)]" />
            生成参考文献章节 (DI-02)
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="mb-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              引用规范
            </label>
            <div className="grid gap-2 md:grid-cols-3">
              {STYLE_OPTIONS.map((opt) => {
                const active = style === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStyle(opt.id)}
                    className={`rounded border p-2 text-left transition ${
                      active
                        ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                        : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <div className="text-sm font-bold">{opt.label}</div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">{opt.hint}</div>
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">
                引文条目 {citations.length} 条 · 全本正文 {manuscriptCharCount.toLocaleString()} 字 · 模型档位 balanced
              </span>
              <button
                type="button"
                onClick={() => void handleBuild()}
                disabled={running || loading || citations.length === 0}
                className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:opacity-40"
              >
                {running ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {running ? '生成中...' : '生成参考文献'}
              </button>
            </div>
          </section>

          {result && (
            <section className="space-y-3">
              <div className="grid gap-2 md:grid-cols-3">
                <Stat
                  label="已引用"
                  count={result.usedCitekeys.length}
                  tone="ok"
                  hint="正文出现且元数据存在"
                />
                <Stat
                  label="正文未引用"
                  count={result.unusedCitekeys.length}
                  tone="warn"
                  hint="元数据有但正文未出现, 可考虑删除或补引用"
                  details={result.unusedCitekeys}
                />
                <Stat
                  label="元数据缺失"
                  count={result.missingCitekeys.length}
                  tone="danger"
                  hint="正文出现但 citations 元数据未填, 请到引文管理补"
                  details={result.missingCitekeys}
                />
              </div>

              {result.referencesText ? (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      参考文献预览 ({STYLE_OPTIONS.find((o) => o.id === result.citationStyle)?.label})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        复制全部
                      </button>
                      <button
                        type="button"
                        onClick={handleInsertToChapter}
                        className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)]"
                      >
                        插入到当前章节末尾
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 font-mono text-[12px] leading-relaxed text-[var(--text-primary)]">
                    {result.referencesText}
                  </pre>
                </div>
              ) : (
                <div className="rounded border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-xs text-[var(--warning-primary)]">
                  正文中没有任何 [@citekey] 锚点, 模型未生成参考文献。请先在
                  正文里用 "插入引文" 把 citekey 嵌入文中, 然后再次生成。
                </div>
              )}
              {feedbackRunId && (
                <SkillFeedbackForm
                  runId={feedbackRunId}
                  skillId="layer2.references-section-build"
                  surface="desktop-skill-dialog"
                />
              )}
            </section>
          )}

          {!result && !loading && citations.length === 0 && (
            <div className="rounded border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-xs text-[var(--warning-primary)]">
              当前作品没有引文条目。请先打开 “学术工具 → 引文管理” 添加 citation 元数据。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  count,
  tone,
  hint,
  details
}: {
  label: string
  count: number
  tone: 'ok' | 'warn' | 'danger'
  hint: string
  details?: string[]
}) {
  const cls =
    tone === 'ok'
      ? 'border-[var(--success-border)] bg-[var(--success-surface)]/40 text-[var(--success-primary)]'
      : tone === 'warn'
        ? 'border-[var(--warning-border)] bg-[var(--warning-surface)]/40 text-[var(--warning-primary)]'
        : 'border-[var(--danger-border)] bg-[var(--danger-surface)]/40 text-[var(--danger-primary)]'
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold">{label}</span>
        <span className="text-2xl font-mono">{count}</span>
      </div>
      <div className="mt-1 text-[10px] text-[var(--text-muted)]">{hint}</div>
      {details && details.length > 0 && (
        <details className="mt-2 text-[11px]">
          <summary className="cursor-pointer">
            <AlertCircle size={11} className="mr-1 inline align-text-bottom" />
            查看 citekey
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono text-[10px]">
            {details.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

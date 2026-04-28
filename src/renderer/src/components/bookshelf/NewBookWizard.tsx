import { useEffect, useMemo, useState } from 'react'
import { X, Save, ChevronRight, BookOpen, Plus, SlidersHorizontal, Star } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useConfigStore } from '@/stores/config-store'
import { useSettingsStore } from '@/stores/settings-store'
import { GENRES, GENRE_LABELS, GENRE_DESCRIPTIONS, DEFAULT_GENRE, type Genre } from '../../../../shared/genre'

export default function NewBookWizard() {
  const closeModal = useUIStore((s) => s.closeModal)
  const pushModal = useUIStore((s) => s.pushModal)
  const createBook = useBookStore((s) => s.createBook)
  const initConfigFromTemplate = useConfigStore((s) => s.initConfigFromTemplate)
  const openBook = useBookStore((s) => s.openBook)
  const templates = useSettingsStore((s) => s.templates)
  const defaultGenreTemplateId = useSettingsStore((s) => s.defaultGenreTemplateId)
  const systemDailyGoal = useSettingsStore((s) => s.systemDailyGoal)
  const loadingTemplates = useSettingsStore((s) => s.loadingTemplates)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  // GP-01 v2: 5 题材覆盖。webnovel 是默认值；非 webnovel 题材后续会在 ai_work_profiles
  // 上锁定 product genre，影响后端 SYSTEM_PROMPT / Skill prompt / 草稿 kind 路由。
  const [genre, setGenre] = useState<Genre>(DEFAULT_GENRE)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId(null)
      return
    }
    if (defaultGenreTemplateId && templates.some((template) => template.id === defaultGenreTemplateId)) {
      setSelectedTemplateId((current) => current ?? defaultGenreTemplateId)
      return
    }
  }, [defaultGenreTemplateId, templates])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  )

  const handleSubmit = async () => {
    if (!title.trim() || !selectedTemplate) return
    setSubmitting(true)
    try {
      const book = await createBook(title.trim(), author.trim())
      await initConfigFromTemplate(book.id, selectedTemplate, systemDailyGoal)
      // GP-01 v2: 把 product genre 写入 ai_work_profiles。saveWorkProfile 会
      // 在缺 row 时先 insert 默认 row，再 update genre 列。
      try {
        await window.api.aiSaveWorkProfile(book.id, { genre })
      } catch (err) {
        // 写入失败不阻断作品创建（用户仍能进入工作台），但记录错误供后续诊断。
        console.error('[NewBookWizard] 写入 product genre 失败', err)
      }
      openBook(book.id)
      closeModal()
    } finally {
      setSubmitting(false)
    }
  }

  const openGenreTemplateSettings = () => {
    pushModal('appSettings', { tab: 'genreTemplates' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-[520px] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <BookOpen size={18} />
            <span>新建作品 ({step}/2)</span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5 flex-1">
          {step === 1 && (
            <>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">作品名称</label>
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2.5 text-[var(--text-primary)] text-lg focus:outline-none focus:border-[var(--accent-primary)] transition"
                  placeholder="例如：重生之金融巨子"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">笔名 (选填)</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition"
                  placeholder="你的笔名"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-2">题材</label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {GENRES.map((g) => {
                    const active = genre === g
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGenre(g)}
                        className={`rounded-md border px-3 py-2 text-left transition ${
                          active
                            ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                            : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                        }`}
                      >
                        <div className="text-sm font-bold">{GENRE_LABELS[g]}</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                          {GENRE_DESCRIPTIONS[g]}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  题材决定 AI 行为：网文含在 Pro 内；剧本/小说/学术/公文需另行订阅对应题材包。可在作品上下文设置中修改。
                </p>
              </div>
            </>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider">选择系统题材模板</label>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    新作品会套用所选模板的字段快照。后续系统模板再编辑，不会反向改这部作品。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openGenreTemplateSettings}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--accent-border)] px-3 py-1.5 text-xs text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)]"
                >
                  <SlidersHorizontal size={14} />
                  管理模板
                </button>
              </div>

              {loadingTemplates ? (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 text-sm text-[var(--text-muted)]">
                  正在读取系统题材模板…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6 text-center">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">还没有系统题材模板</div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    先新增一个题材模板，再回来完成作品创建。
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={openGenreTemplateSettings}
                      className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-[var(--accent-contrast)] hover:bg-[var(--accent-secondary)]"
                    >
                      <Plus size={14} />
                      新建题材模板
                    </button>
                    <button
                      type="button"
                      onClick={openGenreTemplateSettings}
                      className="rounded border border-[var(--border-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                    >
                      打开系统设置
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!defaultGenreTemplateId ? (
                    <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-xs text-[var(--text-primary)]">
                      当前还没有默认题材模板。请先显式选择一个模板，或去系统设置里把常用模板设为默认。
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {templates.map((template) => {
                      const active = selectedTemplateId === template.id
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-all ${
                            active
                              ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                              : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-sm">{template.name}</div>
                              <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                                字段: {template.character_fields.map((field) => field.label).join('、') || '无'}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {template.id === defaultGenreTemplateId ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warning-border)] bg-[var(--warning-surface)] px-2 py-0.5 text-[10px] text-[var(--warning-primary)]">
                                  <Star size={10} />
                                  默认
                                </span>
                              ) : null}
                              {template.is_seed ? (
                                <span className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                                  预设
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {selectedTemplate ? (
                    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 text-xs text-[var(--text-secondary)]">
                      将以「{selectedTemplate.name}」创建作品，日更目标默认跟随系统 {systemDailyGoal.toLocaleString()} 字。
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3">
          <button onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          {step === 1 && (
            <button
              onClick={() => title.trim() && setStep(2)}
              disabled={!title.trim()}
              className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-contrast)] rounded flex items-center transition shadow-lg shadow-[0_10px_24px_rgba(63,111,159,0.16)]"
            >
              下一步 <ChevronRight size={14} className="ml-1" />
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedTemplate}
              className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded flex items-center transition shadow-lg shadow-[0_10px_24px_rgba(63,111,159,0.16)]"
            >
              <Save size={14} className="mr-1" /> {submitting ? '创建中...' : '确认创建'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

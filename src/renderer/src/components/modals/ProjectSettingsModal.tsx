import { useEffect, useMemo, useState } from 'react'
import { BookTemplate, Bot, Save, Settings, Target, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useConfigStore } from '@/stores/config-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { resolveProjectDailyGoal } from '@/utils/daily-goal'
import { GenreTemplatePreview } from '@/components/settings/GenreTemplateEditor'

type Tab = 'genre' | 'daily' | 'ai'

export default function ProjectSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)
  const bookId = useBookStore((s) => s.currentBookId)!
  const { config, loadConfig, saveConfig } = useConfigStore()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const templates = useSettingsStore((s) => s.templates)
  const defaultGenreTemplateId = useSettingsStore((s) => s.defaultGenreTemplateId)
  const systemDailyGoal = useSettingsStore((s) => s.systemDailyGoal)
  const loadingTemplates = useSettingsStore((s) => s.loadingTemplates)

  const [tab, setTab] = useState<Tab>('genre')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [dailyGoalMode, setDailyGoalMode] = useState<'follow_system' | 'custom'>('follow_system')
  const [customDailyGoal, setCustomDailyGoal] = useState(6000)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadConfig(bookId)
    void loadSettings()
  }, [bookId, loadConfig, loadSettings])

  useEffect(() => {
    if (!config) return
    setDailyGoalMode(config.daily_goal_mode || 'follow_system')
    setCustomDailyGoal(config.daily_goal || 6000)
  }, [config])

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId(null)
      return
    }
    if (config?.genre) {
      const matched = templates.find((template) => template.slug === config.genre)
      if (matched) {
        setSelectedTemplateId(matched.id)
        return
      }
    }
    if (defaultGenreTemplateId && templates.some((template) => template.id === defaultGenreTemplateId)) {
      setSelectedTemplateId(defaultGenreTemplateId)
      return
    }
    setSelectedTemplateId((current) => (current && templates.some((template) => template.id === current) ? current : templates[0].id))
  }, [config?.genre, defaultGenreTemplateId, templates])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  )
  const currentTemplate = useMemo(
    () => templates.find((template) => template.slug === config?.genre) || null,
    [config?.genre, templates]
  )
  const effectiveDailyGoal = resolveProjectDailyGoal(config, systemDailyGoal)

  const saveGenreConfig = async () => {
    if (!selectedTemplate) return
    await saveConfig(bookId, {
      genre: selectedTemplate.slug,
      character_fields: selectedTemplate.character_fields,
      faction_labels: selectedTemplate.faction_labels,
      status_labels: selectedTemplate.status_labels,
      emotion_labels: selectedTemplate.emotion_labels
    })
  }

  const saveDailyGoalConfig = async () => {
    await saveConfig(bookId, {
      daily_goal_mode: dailyGoalMode,
      daily_goal: dailyGoalMode === 'custom' ? customDailyGoal : systemDailyGoal
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 shrink-0">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <Settings size={18} />
            <span>作品设置</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            title="关闭作品设置"
            aria-label="关闭作品设置"
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 shrink-0">
          {([
            ['genre', '题材应用'],
            ['daily', '日更目标'],
            ['ai', 'AI 作品能力']
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition ${
                tab === key
                  ? 'border-[var(--accent-primary)] text-[var(--accent-secondary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'genre' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-surface)] p-4 text-sm text-[var(--text-primary)]">
                <div className="flex items-center gap-2 font-semibold text-[var(--info-primary)]">
                  <BookTemplate size={16} />
                  当前作品只套用系统题材模板
                </div>
                <p className="mt-2 text-[var(--text-secondary)]">
                  在这里为当前作品选择并套用系统模板。编辑模板内容请去“应用设置 / 题材模板”；已有作品不会因为系统模板变更而被动改写。
                </p>
              </div>

              {config && !currentTemplate ? (
                <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-4 text-sm text-[var(--text-primary)]">
                  <div className="font-semibold text-[var(--warning-primary)]">当前作品使用历史快照</div>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    当前 `genre` 值 `{config.genre}` 未匹配到系统模板库。作品字段快照仍会保留；如果你想切到系统模板，请在下面重新选择并保存。
                  </p>
                </div>
              ) : null}

              {templates.length === 0 ? (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6 text-center">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">当前没有系统题材模板</div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    先到应用设置里新建题材模板，然后再回来套用到当前作品。
                  </p>
                  <button
                    type="button"
                    onClick={() => openModal('appSettings', { tab: 'genreTemplates' })}
                    className="mt-4 rounded border border-[var(--accent-border)] px-3 py-1.5 text-xs text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)]"
                  >
                    打开应用设置 / 题材模板
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                    {loadingTemplates ? (
                      <div className="p-3 text-sm text-[var(--text-muted)]">读取模板中…</div>
                    ) : templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          template.id === selectedTemplateId
                            ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                            : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{template.name}</span>
                          <div className="flex items-center gap-1">
                            {template.is_seed ? (
                              <span className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                                预设
                              </span>
                            ) : null}
                            {template.id === defaultGenreTemplateId ? (
                              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-surface)] px-2 py-0.5 text-[10px] text-[var(--warning-primary)]">
                                默认
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--text-muted)]">{template.slug}</div>
                      </button>
                    ))}
                  </div>

                  {selectedTemplate ? (
                    <GenreTemplatePreview
                      template={selectedTemplate}
                      hint="保存后会把这份模板快照写入当前作品；后续系统模板再编辑，不会反向改本作。"
                    />
                  ) : null}
                </div>
              )}
            </div>
          )}

          {tab === 'daily' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Target size={16} />
                  当前作品日更目标
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  当前生效目标：{effectiveDailyGoal.toLocaleString()} 字。你可以跟随系统默认，也可以为当前作品单独设置一个目标。
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setDailyGoalMode('follow_system')}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    dailyGoalMode === 'follow_system'
                      ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                  }`}
                >
                  <div className="font-semibold">跟随系统默认</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">当前系统默认：{systemDailyGoal.toLocaleString()} 字</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDailyGoalMode('custom')}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    dailyGoalMode === 'custom'
                      ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                  }`}
                >
                  <div className="font-semibold">自定义本作目标</div>
                  <div className="mt-3">
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={customDailyGoal}
                      onChange={(event) => setCustomDailyGoal(Number(event.target.value))}
                      className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-lg font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </button>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-surface)] p-4 text-sm text-[var(--text-primary)]">
                <div className="flex items-center gap-2 font-semibold text-[var(--info-primary)]">
                  <Bot size={16} />
                  AI 作品能力
                </div>
                <p className="mt-2 text-[var(--text-secondary)]">
                  这里仅进入当前作品的 AI 档案、上下文策略和能力卡。AI 账号、API Key、Gemini CLI 和 Ollama 统一在应用设置中管理。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openModal('aiSettings')}
                  className="rounded border border-[var(--info-border)] px-3 py-1.5 text-xs font-semibold text-[var(--info-primary)] hover:bg-[var(--info-surface)]"
                >
                  打开 AI 作品能力
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-1.5 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            关闭
          </button>
          {(tab === 'genre' || tab === 'daily') && (
            <button
              type="button"
              disabled={saving || (tab === 'genre' && !selectedTemplate)}
              onClick={async () => {
                setSaving(true)
                try {
                  if (tab === 'genre') await saveGenreConfig()
                  if (tab === 'daily') await saveDailyGoalConfig()
                  closeModal()
                } finally {
                  setSaving(false)
                }
              }}
              className="flex items-center gap-1 rounded bg-[var(--accent-primary)] px-4 py-1.5 text-xs text-[var(--accent-contrast)] disabled:opacity-40 hover:bg-[var(--accent-secondary)]"
            >
              <Save size={14} />
              {saving ? '保存中…' : '保存'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

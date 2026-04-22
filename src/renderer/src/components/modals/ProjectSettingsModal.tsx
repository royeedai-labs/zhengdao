import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from 'react'
import {
  Database,
  FolderOpen,
  HardDrive,
  Keyboard,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  X
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useConfigStore } from '@/stores/config-store'
import { useShortcutStore } from '@/stores/shortcut-store'
import { GENRE_PRESETS } from '@/utils/genre-presets'
import { SHORTCUT_ACTIONS, chordFromKeyEvent } from '@/utils/shortcuts'
import type { ShortcutAction } from '@/utils/shortcuts'
import {
  buildGenreConfigPayload,
  deriveGenreEditorState,
  type GenreEditorState
} from '@/utils/custom-genre-config'
import type {
  CharacterField,
  EmotionLabel,
  FactionLabel,
  GenrePreset,
  StatusLabel
} from '@/types'

type Tab = 'genre' | 'ai' | 'daily' | 'backup' | 'shortcuts'

type BackupRow = { name: string; path: string; mtime: number; size: number }

export default function ProjectSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)
  const bookId = useBookStore((s) => s.currentBookId)!
  const { config, loadConfig, saveConfig } = useConfigStore()
  const getChord = useShortcutStore((s) => s.getChord)
  const setShortcut = useShortcutStore((s) => s.setChord)

  const [tab, setTab] = useState<Tab>('genre')
  const [captureId, setCaptureId] = useState<string | null>(null)
  const [genreState, setGenreState] = useState<GenreEditorState>(() =>
    deriveGenreEditorState(
      {
        genre: GENRE_PRESETS[0].id,
        character_fields: GENRE_PRESETS[0].character_fields,
        faction_labels: GENRE_PRESETS[0].faction_labels,
        status_labels: GENRE_PRESETS[0].status_labels,
        emotion_labels: GENRE_PRESETS[0].emotion_labels
      },
      GENRE_PRESETS
    )
  )
  const [dailyGoal, setDailyGoal] = useState(6000)
  const [sensitiveList, setSensitiveList] = useState('default')

  const [backupDir, setBackupDir] = useState('')
  const [backupHours, setBackupHours] = useState(24)
  const [backupMax, setBackupMax] = useState(10)
  const [backupList, setBackupList] = useState<BackupRow[]>([])
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupNote, setBackupNote] = useState<string | null>(null)

  const actionsByCategory = useMemo(() => {
    const m: Record<string, ShortcutAction[]> = {}
    for (const a of SHORTCUT_ACTIONS) {
      if (!m[a.category]) m[a.category] = []
      m[a.category].push(a)
    }
    return m
  }, [])

  useEffect(() => {
    if (!captureId) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCaptureId(null)
        return
      }
      if (
        ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)
      )
        return
      const chord = chordFromKeyEvent(e)
      if (chord.length > 0) {
        void setShortcut(captureId, chord)
        setCaptureId(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [captureId, setShortcut])

  useEffect(() => {
    void loadConfig(bookId)
  }, [bookId, loadConfig])

  useEffect(() => {
    if (!config) return
    setGenreState(
      deriveGenreEditorState(
        {
          genre: config.genre || 'urban',
          character_fields: config.character_fields || [],
          faction_labels: config.faction_labels || [],
          status_labels: config.status_labels || [],
          emotion_labels: config.emotion_labels || []
        },
        GENRE_PRESETS
      )
    )
    setDailyGoal(config.daily_goal || 6000)
    setSensitiveList(config.sensitive_list || 'default')
  }, [config])

  useEffect(() => {
    void Promise.all([
      window.api.getAppState('backup_directory'),
      window.api.getAppState('backup_interval_hours'),
      window.api.getAppState('backup_max_files')
    ]).then(([d, h, m]) => {
      setBackupDir(d || '')
      setBackupHours(Number(h || '24'))
      setBackupMax(Number(m || '10'))
    })
  }, [])

  useEffect(() => {
    if (tab !== 'backup') return
    void window.api.backupList().then((rows) => setBackupList(rows as BackupRow[]))
  }, [tab])

  const refreshBackupList = async () => {
    const rows = await window.api.backupList()
    setBackupList(rows as BackupRow[])
  }

  const saveGenreConfig = async () => {
    const payload = buildGenreConfigPayload(genreState)
    await saveConfig(bookId, {
      ...payload,
      daily_goal: dailyGoal,
      sensitive_list: sensitiveList
    })
  }

  const saveAiTabSettings = async () => {
    await saveConfig(bookId, {
      daily_goal: dailyGoal,
      sensitive_list: sensitiveList
    })
  }

  const switchPreset = (preset: GenrePreset) => {
    setGenreState(
      deriveGenreEditorState(
        {
          genre: preset.id,
          character_fields: preset.character_fields,
          faction_labels: preset.faction_labels,
          status_labels: preset.status_labels,
          emotion_labels: preset.emotion_labels
        },
        GENRE_PRESETS
      )
    )
  }

  const enableCustomGenre = () => {
    setGenreState((current) => ({
      ...current,
      mode: 'custom',
      genreId:
        current.mode === 'custom'
          ? current.genreId
          : current.customPreset.name.trim() || '自定义题材',
      genreName:
        current.mode === 'custom'
          ? current.genreName
          : current.customPreset.name.trim() || '自定义题材',
      customPreset: {
        ...current.customPreset,
        id:
          current.mode === 'custom'
            ? current.customPreset.id
            : current.customPreset.name.trim() || '自定义题材',
        name: current.customPreset.name.trim() || '自定义题材'
      }
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold">
            <Settings size={18} />
            <span>项目设置</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            title="关闭项目设置"
            aria-label="关闭项目设置"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 shrink-0">
          {(
            [
              ['genre', '题材模板'],
              ['ai', 'AI 入口'],
              ['daily', '日更目标'],
              ['shortcuts', '快捷键'],
              ['backup', '备份与迁移']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition ${
                tab === key
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {key === 'shortcuts' ? (
                <span className="inline-flex items-center gap-1">
                  <Keyboard size={12} />
                  {label}
                </span>
              ) : (
                label
              )}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {tab === 'genre' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                题材模板只作用于当前作品。切换题材会覆盖角色字段、阵营、状态与情绪标签模板；不会改动已有章节正文。
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchPreset(GENRE_PRESETS.find((preset) => preset.id === genreState.builtInGenreId) || GENRE_PRESETS[0])}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    genreState.mode === 'preset'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-emerald-500/30'
                  }`}
                >
                  使用内置题材
                </button>
                <button
                  type="button"
                  onClick={enableCustomGenre}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    genreState.mode === 'custom'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-emerald-500/30'
                  }`}
                >
                  当前作品自定义题材
                </button>
              </div>

              {genreState.mode === 'preset' ? (
                <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
                  <div className="space-y-2">
                    <label className="block text-[11px] text-[var(--text-muted)] uppercase">题材预设</label>
                    {GENRE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => switchPreset(preset)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          genreState.builtInGenreId === preset.id
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                            : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                        }`}
                      >
                        <div className="font-bold">{preset.name}</div>
                        <div className="mt-1 text-[11px] text-[var(--text-muted)]">{preset.id}</div>
                      </button>
                    ))}
                  </div>
                  <GenrePresetPreview preset={genreState.customPreset} />
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase text-[var(--text-muted)]">题材名称</label>
                    <input
                      value={genreState.genreName}
                      onChange={(event) =>
                        setGenreState((current) => ({
                          ...current,
                          genreName: event.target.value,
                          genreId: event.target.value.trim() || current.genreId,
                          customPreset: {
                            ...current.customPreset,
                            id: event.target.value.trim() || current.customPreset.id,
                            name: event.target.value
                          }
                        }))}
                      className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                      placeholder="例如：悬疑群像"
                    />
                  </div>

                  <EditableCharacterFields
                    items={genreState.customPreset.character_fields}
                    onChange={(items) =>
                      setGenreState((current) => ({
                        ...current,
                        customPreset: { ...current.customPreset, character_fields: items }
                      }))}
                  />
                  <EditableFactionLabels
                    items={genreState.customPreset.faction_labels}
                    onChange={(items) =>
                      setGenreState((current) => ({
                        ...current,
                        customPreset: { ...current.customPreset, faction_labels: items }
                      }))}
                  />
                  <EditableStatusLabels
                    items={genreState.customPreset.status_labels}
                    onChange={(items) =>
                      setGenreState((current) => ({
                        ...current,
                        customPreset: { ...current.customPreset, status_labels: items }
                      }))}
                  />
                  <EditableEmotionLabels
                    items={genreState.customPreset.emotion_labels}
                    onChange={(items) =>
                      setGenreState((current) => ({
                        ...current,
                        customPreset: { ...current.customPreset, emotion_labels: items }
                      }))}
                  />
                </div>
              )}
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <div className="font-bold text-emerald-300">AI 配置已拆分</div>
                <p className="mt-1 text-emerald-100/80">
                  账号、API Key、Gemini CLI 与 Ollama 属于全局账号；提示词、上下文、写作禁区和能力卡在“AI 能力与作品配置”中管理。
                </p>
                <button
                  type="button"
                  onClick={() => openModal('aiSettings')}
                  className="mt-2 rounded border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10"
                >
                  打开 AI 能力与作品配置
                </button>
              </div>
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
                <div className="font-bold text-[var(--text-primary)]">旧项目级 AI Provider 表单已退场</div>
                <p className="mt-1">
                  当前作品不再单独保存 provider、API Key、Gemini CLI 登录或 Ollama 连接。上述能力统一在“AI 能力与作品配置 / 全局账号”中维护，这里只保留作品内的非账号设置。
                </p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">敏感词过滤</label>
                <select
                  value={sensitiveList}
                  onChange={(e) => setSensitiveList(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="default">默认词库</option>
                  <option value="strict">严格词库</option>
                  <option value="loose">宽松词库</option>
                  <option value="none">关闭过滤</option>
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">开启后，编辑器中的敏感词会以红色波浪线标注</p>
              </div>
            </div>
          )}

          {tab === 'daily' && (
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-2">每日目标字数</label>
              <input
                type="number"
                min={500}
                step={100}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-emerald-400 font-mono text-lg focus:outline-none focus:border-emerald-500"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2">用于顶部日更进度条统计（统计接入后可显示实际进度）。</p>
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="space-y-6">
              <p className="text-xs text-[var(--text-muted)]">
                点击快捷键列后按下新组合即可录制；Esc 取消录制。「恢复默认」清除自定义绑定。
              </p>
              {Object.entries(actionsByCategory).map(([category, actions]) => (
                <div key={category}>
                  <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase mb-2">{category}</h3>
                  <div className="rounded-lg border border-[var(--border-primary)] divide-y divide-[var(--border-primary)] overflow-hidden">
                    {actions.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[var(--bg-primary)] text-xs"
                      >
                        <span className="text-[var(--text-primary)] font-medium">{a.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setCaptureId(a.id)}
                            className={`font-mono px-2 py-1 rounded border text-[11px] min-w-[120px] text-center transition ${
                              captureId === a.id
                                ? 'border-emerald-500 text-emerald-400 animate-pulse'
                                : 'border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-emerald-500/50'
                            }`}
                          >
                            {captureId === a.id ? '请按键…' : getChord(a.id)}
                          </button>
                          <button
                            type="button"
                            onClick={() => void setShortcut(a.id, '')}
                            className="text-[11px] text-[var(--text-muted)] hover:text-emerald-400 px-2"
                          >
                            恢复默认
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'backup' && (
            <>
              <p className="text-xs text-[var(--text-muted)]">
                自动备份使用 SQLite 在线备份，写入时不会影响正在使用的库。更换整库后会自动刷新搜索索引；部分操作需重载界面后生效。
              </p>

              <div className="space-y-3 border border-[var(--border-primary)] rounded-lg p-4 bg-[var(--bg-primary)]">
                <div className="flex items-center gap-2 text-[var(--text-primary)] text-sm font-bold">
                  <HardDrive size={16} className="text-emerald-500" />
                  定时备份
                </div>
                <div className="flex gap-2 items-start">
                  <input
                    readOnly
                    value={backupDir}
                    placeholder="默认使用应用数据目录下的 backups"
                    className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-[11px] text-[var(--text-secondary)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await window.api.openDirectory()
                      if (p) setBackupDir(p)
                    }}
                    className="shrink-0 px-2 py-1.5 text-xs border border-[var(--border-secondary)] rounded text-[var(--text-primary)] hover:border-emerald-500 flex items-center gap-1"
                  >
                    <FolderOpen size={14} /> 选择目录
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">间隔</label>
                    <select
                      value={backupHours}
                      onChange={(e) => setBackupHours(Number(e.target.value))}
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)]"
                    >
                      <option value={1}>每 1 小时</option>
                      <option value={6}>每 6 小时</option>
                      <option value={12}>每 12 小时</option>
                      <option value={24}>每 24 小时</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">保留份数</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={backupMax}
                      onChange={(e) => setBackupMax(Number(e.target.value))}
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={async () => {
                    setBackupBusy(true)
                    setBackupNote(null)
                    try {
                      await window.api.backupConfigure(backupDir, backupHours, backupMax)
                      setBackupNote('备份计划已更新')
                      await refreshBackupList()
                    } catch (e) {
                      setBackupNote(e instanceof Error ? e.message : '保存失败')
                    } finally {
                      setBackupBusy(false)
                    }
                  }}
                  className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-white"
                >
                  应用备份设置
                </button>
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={async () => {
                    setBackupBusy(true)
                    setBackupNote(null)
                    try {
                      await window.api.backupNow()
                      setBackupNote('已创建备份')
                      await refreshBackupList()
                    } catch (e) {
                      setBackupNote(e instanceof Error ? e.message : '备份失败')
                    } finally {
                      setBackupBusy(false)
                    }
                  }}
                  className="ml-2 text-xs px-3 py-1.5 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 rounded"
                >
                  立即备份
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)] uppercase">备份记录</span>
                <button
                  type="button"
                  onClick={() => void refreshBackupList()}
                  className="text-[11px] text-emerald-500 flex items-center gap-1 hover:text-emerald-400"
                >
                  <RefreshCw size={12} /> 刷新
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--border-primary)] divide-y divide-[var(--border-primary)] text-xs">
                {backupList.length === 0 ? (
                  <div className="p-3 text-[var(--text-muted)]">暂无备份文件</div>
                ) : (
                  backupList.map((row) => (
                    <div key={row.path} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-[var(--text-secondary)] truncate font-mono">{row.name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('从该备份恢复将替换当前数据库，确定继续？')) return
                          setBackupBusy(true)
                          try {
                            const r = await window.api.backupRestoreFrom(row.path)
                            if (r && typeof r === 'object' && 'ok' in r && !r.ok && 'error' in r && r.error) {
                              setBackupNote(String(r.error))
                              return
                            }
                            await window.api.reloadWindow()
                          } finally {
                            setBackupBusy(false)
                          }
                        }}
                        className="shrink-0 text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                      >
                        <RotateCcw size={12} /> 恢复
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 border border-[var(--border-primary)] rounded-lg p-4 bg-[var(--bg-primary)]">
                <div className="flex items-center gap-2 text-[var(--text-primary)] text-sm font-bold">
                  <Database size={16} className="text-emerald-500" />
                  完整数据迁移
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  导出当前 SQLite 数据库副本；导入将用所选文件整体替换本地库。
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={backupBusy}
                    onClick={async () => {
                      setBackupBusy(true)
                      try {
                        const r = await window.api.dataExportFull()
                        if (r && typeof r === 'object' && 'canceled' in r && r.canceled) return
                        setBackupNote('已导出数据库文件')
                      } finally {
                        setBackupBusy(false)
                      }
                    }}
                    className="text-xs px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-[var(--text-primary)] hover:border-emerald-500/50"
                  >
                    导出数据库
                  </button>
                  <button
                    type="button"
                    disabled={backupBusy}
                    onClick={async () => {
                      if (!confirm('导入将覆盖当前本地全部数据，是否继续？')) return
                      setBackupBusy(true)
                      try {
                        const r = await window.api.dataImportFull()
                        if (r && typeof r === 'object' && 'canceled' in r && r.canceled) return
                        if (r && typeof r === 'object' && 'ok' in r && !r.ok && 'error' in r && r.error) {
                          setBackupNote(String(r.error))
                          return
                        }
                        await window.api.reloadWindow()
                      } finally {
                        setBackupBusy(false)
                      }
                    }}
                    className="text-xs px-3 py-1.5 border border-red-500/40 text-red-400 rounded hover:bg-red-500/10"
                  >
                    导入数据库
                  </button>
                  <button
                    type="button"
                    disabled={backupBusy}
                    onClick={async () => {
                      if (!confirm('从外部 .db 文件恢复？当前未保存的更改将丢失。')) return
                      setBackupBusy(true)
                      try {
                        const r = await window.api.backupRestore()
                        if (r && typeof r === 'object' && 'canceled' in r && r.canceled) return
                        if (r && typeof r === 'object' && 'ok' in r && !r.ok && 'error' in r && r.error) {
                          setBackupNote(String(r.error))
                          return
                        }
                        await window.api.reloadWindow()
                      } finally {
                        setBackupBusy(false)
                      }
                    }}
                    className="text-xs px-3 py-1.5 border border-amber-500/40 text-amber-400 rounded hover:bg-amber-500/10"
                  >
                    从文件恢复…
                  </button>
                </div>
              </div>

              {backupNote && <p className="text-xs text-emerald-400">{backupNote}</p>}
            </>
          )}
        </div>

        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3 shrink-0">
          <button type="button" onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            关闭
          </button>
          {tab !== 'backup' && tab !== 'shortcuts' && (
            <button
              type="button"
              onClick={async () => {
                if (tab === 'genre') await saveGenreConfig()
                else await saveAiTabSettings()
                closeModal()
              }}
              className="flex items-center gap-1 px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
            >
              <Save size={14} /> 保存
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold text-[var(--text-primary)]">{children}</h3>
}

function SmallHint({ children }: { children: string }) {
  return <p className="text-[11px] text-[var(--text-muted)]">{children}</p>
}

function RowActions({
  onAdd,
  label
}: {
  onAdd: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="rounded-md border border-dashed border-[var(--border-secondary)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-emerald-500/40 hover:text-emerald-400"
    >
      + {label}
    </button>
  )
}

function FieldCard({
  children
}: {
  children: ReactNode
}) {
  return <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 space-y-3">{children}</div>
}

function PlainInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 ${
        props.className || ''
      }`}
    />
  )
}

function PlainSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 ${
        props.className || ''
      }`}
    />
  )
}

function RemoveButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-md border border-red-500/25 px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10"
    >
      删除
    </button>
  )
}

function GenrePresetPreview({
  preset
}: {
  preset: {
    name: string
    character_fields: CharacterField[]
    faction_labels: FactionLabel[]
    status_labels: StatusLabel[]
    emotion_labels: EmotionLabel[]
  }
}) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 space-y-4">
      <div>
        <SectionTitle>{preset.name}</SectionTitle>
        <SmallHint>保存后会把以下模板写入当前作品配置。</SmallHint>
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">角色字段</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {preset.character_fields.map((field) => (
              <span
                key={field.key}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {field.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">阵营标签</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {preset.faction_labels.map((label) => (
              <span
                key={label.value}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {label.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">状态标签</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {preset.status_labels.map((label) => (
              <span
                key={label.value}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {label.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableCharacterFields({
  items,
  onChange
}: {
  items: CharacterField[]
  onChange: (items: CharacterField[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>角色字段</SectionTitle>
          <SmallHint>角色档案中的核心字段。</SmallHint>
        </div>
        <RowActions
          label="新增字段"
          onAdd={() => onChange([...items, { key: `field_${items.length + 1}`, label: '新字段', type: 'text' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((field, index) => (
          <div key={`${field.key}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_64px]">
            <PlainInput
              value={field.label}
              placeholder="显示名"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <PlainInput
              value={field.key}
              placeholder="字段 key"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item)))
              }
            />
            <PlainSelect
              value={field.type}
              onChange={(event) =>
                onChange(
                  items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, type: event.target.value as CharacterField['type'] } : item
                  )
                )}
            >
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="select">选项</option>
            </PlainSelect>
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除字段" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

function EditableFactionLabels({
  items,
  onChange
}: {
  items: FactionLabel[]
  onChange: (items: FactionLabel[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>阵营标签</SectionTitle>
          <SmallHint>用于角色阵营分类。</SmallHint>
        </div>
        <RowActions
          label="新增阵营"
          onAdd={() =>
            onChange([...items, { value: `faction_${items.length + 1}`, label: '新阵营', color: 'slate' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((label, index) => (
          <div key={`${label.value}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_64px]">
            <PlainInput
              value={label.label}
              placeholder="标签名"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <PlainInput
              value={label.value}
              placeholder="标签值"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
              }
            />
            <PlainInput
              value={label.color}
              placeholder="颜色"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, color: event.target.value } : item)))
              }
            />
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除阵营标签" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

function EditableStatusLabels({
  items,
  onChange
}: {
  items: StatusLabel[]
  onChange: (items: StatusLabel[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>状态标签</SectionTitle>
          <SmallHint>用于角色当前状态。</SmallHint>
        </div>
        <RowActions
          label="新增状态"
          onAdd={() => onChange([...items, { value: `status_${items.length + 1}`, label: '新状态' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((label, index) => (
          <div key={`${label.value}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_64px]">
            <PlainInput
              value={label.label}
              placeholder="状态名"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <PlainInput
              value={label.value}
              placeholder="状态值"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
              }
            />
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除状态标签" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

function EditableEmotionLabels({
  items,
  onChange
}: {
  items: EmotionLabel[]
  onChange: (items: EmotionLabel[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>情绪标签</SectionTitle>
          <SmallHint>用于沙盘和爽点评分显示。</SmallHint>
        </div>
        <RowActions
          label="新增情绪档位"
          onAdd={() => onChange([...items, { score: 0, label: '新情绪' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((label, index) => (
          <div key={`${label.score}-${index}`} className="grid gap-2 md:grid-cols-[96px_1fr_64px]">
            <PlainInput
              type="number"
              value={label.score}
              onChange={(event) =>
                onChange(
                  items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, score: Number(event.target.value) || 0 } : item
                  )
                )}
            />
            <PlainInput
              value={label.label}
              placeholder="情绪说明"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除情绪标签" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

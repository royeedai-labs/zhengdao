import { useState, useEffect } from 'react'
import { Users, X, Save, TrendingUp } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useCharacterStore } from '@/stores/character-store'
import { useConfigStore } from '@/stores/config-store'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useToastStore } from '@/stores/toast-store'
import type { Character, CharacterMilestone } from '@/types'

function MilestoneGrowthSvg({ milestones }: { milestones: CharacterMilestone[] }) {
  const sorted = [...milestones].sort((a, b) => a.chapter_number - b.chapter_number || a.id - b.id)
  if (sorted.length === 0) return null
  const w = 480
  const h = 200
  const pad = { l: 44, r: 12, t: 14, b: 40 }
  const cw = w - pad.l - pad.r
  const ch = h - pad.t - pad.b
  const chNums = sorted.map((m) => m.chapter_number)
  const cMin = Math.min(...chNums)
  const cMax = Math.max(...chNums)
  const useNumeric =
    sorted.length > 0 &&
    sorted.every((m) => {
      const v = parseFloat(String(m.value).trim())
      return String(m.value).trim() !== '' && !Number.isNaN(v)
    })
  let vmin = 0
  let vmax = 1
  const vals = sorted.map((m) => parseFloat(String(m.value).trim()))
  if (useNumeric) {
    vmin = Math.min(...vals)
    vmax = Math.max(...vals)
    if (vmin === vmax) {
      vmin -= 1
      vmax += 1
    }
  } else {
    vmin = 0
    vmax = Math.max(sorted.length - 1, 1)
  }
  const sx = (c: number) => pad.l + ((c - cMin) / Math.max(cMax - cMin, 1)) * cw
  const sy = (m: CharacterMilestone, idx: number) => {
    if (useNumeric) {
      const v = parseFloat(String(m.value).trim())
      return pad.t + (1 - (v - vmin) / (vmax - vmin)) * ch
    }
    return pad.t + (1 - idx / Math.max(sorted.length - 1, 1)) * ch
  }
  const pts = sorted.map((m, idx) => ({
    cx: sx(m.chapter_number),
    cy: sy(m, idx),
    label: m.label
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx},${p.cy}`).join(' ')
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block mx-auto">
        <text x={pad.l} y={h - 12} fill="#64748b" fontSize="10">
          章节
        </text>
        <text x={8} y={pad.t + ch / 2} fill="#64748b" fontSize="10" transform={`rotate(-90 8 ${pad.t + ch / 2})`}>
          {useNumeric ? '数值' : '里程碑序'}
        </text>
        {sorted.map((m) => (
          <text
            key={`tx-${m.id}`}
            x={sx(m.chapter_number)}
            y={h - 22}
            fill="#475569"
            fontSize="9"
            textAnchor="middle"
          >
            {m.chapter_number}
          </text>
        ))}
        <path d={pathD} fill="none" stroke="#818cf8" strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={`n-${sorted[i].id}`}>
            <circle cx={p.cx} cy={p.cy} r={4} fill="#a5b4fc" stroke="#312e81" strokeWidth={1} />
            <title>{sorted[i].label}</title>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-[var(--text-muted)] justify-center">
        {sorted.map((m) => (
          <span key={`lg-${m.id}`}>
            Ch.{m.chapter_number}: {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function CharacterEditModal() {
  const { modalData, closeModal, pushModal } = useUIStore()
  const config = useConfigStore((s) => s.config)
  const bookId = useBookStore((s) => s.currentBookId)!
  const data = modalData as Partial<Character> & { isNew?: boolean } | null
  const modalKey = `${data?.id ?? 'new'}:${config?.faction_labels?.[0]?.value ?? 'neutral'}:${config?.status_labels?.[0]?.value ?? 'active'}`

  return (
    <CharacterEditModalInner
      key={modalKey}
      bookId={bookId}
      config={config}
      data={data}
      closeModal={closeModal}
      pushModal={pushModal}
    />
  )
}

function CharacterEditModalInner({
  bookId,
  config,
  data,
  closeModal,
  pushModal
}: {
  bookId: number
  config: ReturnType<typeof useConfigStore.getState>['config']
  data: (Partial<Character> & { isNew?: boolean }) | null
  closeModal: () => void
  pushModal: ReturnType<typeof useUIStore.getState>['pushModal']
}) {
  const { createCharacter, updateCharacter, getAppearances } = useCharacterStore()
  const isNew = Boolean(data?.isNew || !data?.id)

  const [name, setName] = useState(() => data?.name || '')
  const [faction, setFaction] = useState(() => data?.faction || config?.faction_labels?.[0]?.value || 'neutral')
  const [status, setStatus] = useState(() => data?.status || config?.status_labels?.[0]?.value || 'active')
  const [description, setDescription] = useState(() => data?.description || '')
  const [customFields, setCustomFields] = useState<Record<string, string>>(() => data?.custom_fields || {})
  const [appearances, setAppearances] = useState<Array<{ chapter_id: number; chapter_title: string }>>([])
  const [milestones, setMilestones] = useState<CharacterMilestone[]>([])
  const [msChapter, setMsChapter] = useState(() =>
    Math.max(1, useChapterStore.getState().getCurrentChapterNumber() || 1)
  )
  const [msLabel, setMsLabel] = useState('')
  const [msValue, setMsValue] = useState('')
  const [milestoneSaving, setMilestoneSaving] = useState(false)
  const [milestoneError, setMilestoneError] = useState<string | null>(null)

  const factionLabels = config?.faction_labels || []
  const statusLabels = config?.status_labels || []
  const characterFields = config?.character_fields || []

  useEffect(() => {
    if (!data?.id) return
    let cancelled = false
    const loadAppearances = async () => {
      const rows = await getAppearances(data.id)
      if (!cancelled) setAppearances(rows)
    }
    void loadAppearances()
    return () => {
      cancelled = true
    }
  }, [data?.id, getAppearances])

  useEffect(() => {
    if (!data?.id) return
    let cancelled = false
    const loadMilestones = async () => {
      const rows = (await window.api.getMilestones(data.id)) as CharacterMilestone[]
      if (!cancelled) setMilestones(rows)
    }
    void loadMilestones()
    return () => {
      cancelled = true
    }
  }, [data?.id])

  const addMilestone = async () => {
    if (!data?.id || !msLabel.trim() || milestoneSaving) return
    setMilestoneSaving(true)
    setMilestoneError(null)
    try {
      const row = (await window.api.createMilestone(
        data.id,
        Math.max(1, msChapter),
        msLabel.trim(),
        msValue.trim()
      )) as CharacterMilestone
      setMilestones((prev) => [...prev, row].sort((a, b) => a.chapter_number - b.chapter_number || a.id - b.id))
      setMsLabel('')
      setMsValue('')
      useToastStore.getState().addToast('success', '已新增成长里程碑')
    } catch (error) {
      const message = error instanceof Error ? error.message : '新增里程碑失败'
      setMilestoneError(message)
      useToastStore.getState().addToast('error', message)
    } finally {
      setMilestoneSaving(false)
    }
  }

  const removeMilestone = async (id: number) => {
    await window.api.deleteMilestone(id)
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (isNew) {
      await createCharacter({
        book_id: bookId,
        name: name.trim(),
        faction,
        status,
        custom_fields: customFields,
        description
      })
    } else if (data?.id) {
      await updateCharacter(data.id, {
        name: name.trim(),
        faction,
        status,
        custom_fields: customFields,
        description
      })
    }
    closeModal()
  }

  const goToChapter = (chapterId: number) => {
    closeModal()
    void useChapterStore.getState().selectChapter(chapterId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-[600px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold">
            <Users size={18} />
            <span>{isNew ? '建档：新出场人物' : '编辑角色档案'}</span>
          </div>
          <button
            onClick={closeModal}
            title="关闭角色档案"
            aria-label="关闭角色档案"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">角色姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition"
              placeholder="角色名"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">阵营定位</label>
              <select
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition"
              >
                {factionLabels.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">当前状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition"
              >
                {statusLabels.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t border-[var(--border-primary)] pt-4">
            <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-3 flex items-center">
              <TrendingUp size={14} className="mr-1 text-emerald-500" /> 核心数据
            </h4>
            <div className="space-y-3">
              {characterFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] w-20 shrink-0">{field.label}:</span>
                  <input
                    type="text"
                    value={customFields[field.key] || ''}
                    onChange={(e) => setCustomFields({ ...customFields, [field.key]: e.target.value })}
                    className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-emerald-400 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">性格与人设备注</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-secondary)] text-sm focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="备注..."
            />
          </div>
          {appearances.length > 0 && (
            <div className="border-t border-[var(--border-primary)] pt-4">
              <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-2">出场轨迹</h4>
              <div className="flex flex-wrap gap-1">
                {appearances.map((a) => (
                  <span
                    key={a.chapter_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToChapter(a.chapter_id)}
                    onKeyDown={(e) => e.key === 'Enter' && goToChapter(a.chapter_id)}
                    className="text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-2 py-0.5 rounded text-[var(--text-secondary)] cursor-pointer hover:text-emerald-400 hover:border-emerald-500/30 transition"
                  >
                    {a.chapter_title}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!isNew && data?.id && (
            <div className="border-t border-[var(--border-primary)] pt-4 space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-secondary)] flex items-center">
                <TrendingUp size={14} className="mr-1 text-violet-400" /> 成长记录
              </h4>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-1">章节序号</label>
                  <input
                    type="number"
                    min={1}
                    value={msChapter}
                    onChange={(e) => setMsChapter(Number(e.target.value) || 1)}
                    className="w-20 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-[10px] text-[var(--text-muted)] mb-1">标签</label>
                  <input
                    type="text"
                    value={msLabel}
                    onChange={(e) => setMsLabel(e.target.value)}
                    placeholder="如：实力突破"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex-1 min-w-[80px]">
                  <label className="block text-[10px] text-[var(--text-muted)] mb-1">数值 / 说明</label>
                  <input
                    type="text"
                    value={msValue}
                    onChange={(e) => setMsValue(e.target.value)}
                    placeholder="可填数字用于曲线"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void addMilestone()}
                  disabled={!msLabel.trim() || milestoneSaving}
                  className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg shrink-0"
                >
                  {milestoneSaving ? '新增中...' : '新增里程碑'}
                </button>
              </div>
              {milestoneError && <p className="text-[11px] text-red-400">{milestoneError}</p>}
              {milestones.length > 0 && (
                <ul className="space-y-1.5 text-xs">
                  {milestones.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5"
                    >
                      <span className="text-[var(--text-primary)]">
                        <span className="text-[var(--text-muted)]">第{m.chapter_number}章</span> · {m.label}
                        {m.value ? <span className="text-emerald-500/90 ml-1">{m.value}</span> : null}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          pushModal('confirm', {
                            title: '删除角色里程碑',
                            message: `确定删除第 ${m.chapter_number} 章的里程碑「${m.label}」吗？`,
                            onConfirm: async () => {
                              await removeMilestone(m.id)
                            }
                          })}
                        title="删除里程碑"
                        className="text-[10px] text-[var(--text-muted)] hover:text-red-400 shrink-0"
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <MilestoneGrowthSvg milestones={milestones} />
            </div>
          )}
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3">
          <button onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded flex items-center transition shadow-lg shadow-indigo-900/20"
          >
            <Save size={14} className="mr-1" /> 保存档案
          </button>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { AlertTriangle, ListChecks, Plus, Save, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import type { AiWorkProfile, CanonLockEntry } from '@/utils/ai/assistant-workflow'

/**
 * DI-07 v1 — Canon Pack 手动锁定面板
 *
 * 嵌入 AiSettingsModal 的"作品 AI 档案" tab。允许写作者手动锁定关键设定 —
 * 例如人物年龄、世界观规则、不可调和的禁忌, 并附 priority 等级。后续
 * world-consistency / chapter-review-pro Skill 在检查冲突时, 会优先以这
 * 些锁定条目为参照。
 *
 * Schema (canon_pack_locks 字段值, 字符串化):
 *   { entries: CanonLockEntry[] }
 *
 * 兼容空字段 / 旧格式: 解析失败时一律视作空数组。
 */

const PRIORITY_OPTIONS: Array<{ id: CanonLockEntry['priority']; label: string; hint: string }> = [
  { id: 'critical', label: '🔴 强制 (critical)', hint: '违反必抛冲突, 后续 AI 输出强校验' },
  { id: 'high', label: '🟠 警告 (high)', hint: 'AI 输出与之冲突时显眼提示作者' },
  { id: 'medium', label: '🟡 建议 (medium)', hint: 'AI 在 review 中给出建议' },
  { id: 'low', label: '🟢 记录 (low)', hint: '仅记录, 不主动校验' }
]

interface CanonLocksData {
  entries: CanonLockEntry[]
}

function parseLocks(stored: string | undefined): CanonLockEntry[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    if (parsed && Array.isArray((parsed as CanonLocksData).entries)) {
      return (parsed as CanonLocksData).entries.filter((e) => e && typeof e.id === 'string')
    }
    if (Array.isArray(parsed)) {
      return (parsed as CanonLockEntry[]).filter((e) => e && typeof e.id === 'string')
    }
    return []
  } catch {
    return []
  }
}

function newEntry(): CanonLockEntry {
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `lock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    value: '',
    priority: 'high',
    createdAt: new Date().toISOString()
  }
}

interface Props {
  bookId: number
  profile: AiWorkProfile
  onSaved: () => Promise<void> | void
}

export default function CanonLocksSection({ bookId, profile, onSaved }: Props) {
  const initial = useMemo(() => parseLocks(profile.canon_pack_locks), [profile.canon_pack_locks])
  const [entries, setEntries] = useState<CanonLockEntry[]>(initial)
  const [dirty, setDirty] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  const updateEntry = (id: string, patch: Partial<CanonLockEntry>) => {
    setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    setDirty(true)
  }

  const removeEntry = (id: string) => {
    setEntries((cur) => cur.filter((e) => e.id !== id))
    setDirty(true)
  }

  const addEntry = () => {
    setEntries((cur) => [...cur, newEntry()])
    setDirty(true)
  }

  const handleSave = async () => {
    const cleaned = entries
      .map((e) => ({ ...e, label: e.label.trim(), value: e.value.trim() }))
      .filter((e) => e.label.length > 0 && e.value.length > 0)
    const payload: CanonLocksData = { entries: cleaned }
    await window.api.aiSaveWorkProfile(bookId, {
      canon_pack_locks: JSON.stringify(payload)
    })
    addToast('success', `已保存 ${cleaned.length} 条 Canon 锁定`)
    setEntries(cleaned)
    setDirty(false)
    await onSaved()
  }

  const counts = useMemo(() => {
    const by: Record<CanonLockEntry['priority'], number> = { critical: 0, high: 0, medium: 0, low: 0 }
    entries.forEach((e) => {
      by[e.priority] += 1
    })
    return by
  }, [entries])

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <ShieldCheck size={14} className="text-[var(--accent-secondary)]" />
          Canon Pack 关键设定锁 (DI-07)
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          <span>🔴 {counts.critical}</span>
          <span>🟠 {counts.high}</span>
          <span>🟡 {counts.medium}</span>
          <span>🟢 {counts.low}</span>
        </div>
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        这里手动锁定关键设定 (人物年龄 / 世界观规则 / 不可调和的禁忌等)。world-consistency
        与章末速评 Skill 会按 priority 优先级把锁定值与 AI 生成的内容对照, critical
        条目违反时强制抛冲突。每条建议精简到 1~2 句话以便 AI 注入。
      </p>

      <div className="space-y-2">
        {entries.length === 0 && (
          <div className="rounded border border-dashed border-[var(--border-primary)] p-4 text-center text-xs text-[var(--text-muted)]">
            <ListChecks size={20} className="mx-auto mb-1 opacity-40" />
            暂无锁定条目, 点击下方 "新增条目" 开始。
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`rounded border p-2 ${
              entry.priority === 'critical'
                ? 'border-[var(--danger-border)] bg-[var(--danger-surface)]/40'
                : entry.priority === 'high'
                  ? 'border-[var(--warning-border)] bg-[var(--warning-surface)]/40'
                  : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'
            }`}
          >
            <div className="grid grid-cols-[140px_1fr_140px_auto] items-start gap-2">
              <input
                value={entry.label}
                onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                placeholder="设定名 (例: 主角年龄)"
                className="field text-xs"
              />
              <textarea
                rows={2}
                value={entry.value}
                onChange={(e) => updateEntry(entry.id, { value: e.target.value })}
                placeholder="设定值 (例: 17 岁, 不允许在前 30 章出现成年场景)"
                className="field min-h-[40px] resize-vertical text-xs"
              />
              <select
                value={entry.priority}
                onChange={(e) =>
                  updateEntry(entry.id, { priority: e.target.value as CanonLockEntry['priority'] })
                }
                className="field text-xs"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} title={opt.hint}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="rounded p-1 text-[var(--text-muted)] transition hover:text-red-500"
                aria-label="删除条目"
                title="删除条目"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-1 text-xs text-[var(--accent-secondary)] hover:underline"
        >
          <Plus size={12} /> 新增条目
        </button>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--warning-primary)]">
              <AlertTriangle size={11} /> 有未保存的改动
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty}
            className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:opacity-40"
          >
            <Save size={12} /> 保存锁定
          </button>
        </div>
      </div>

      <details className="mt-3 text-[11px] text-[var(--text-muted)]">
        <summary className="cursor-pointer hover:text-[var(--text-primary)]">
          <ShieldAlert size={11} className="mr-1 inline" /> Canon Pack 优先级语义说明
        </summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          {PRIORITY_OPTIONS.map((opt) => (
            <li key={opt.id}>
              <span className="font-bold">{opt.label}:</span> {opt.hint}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

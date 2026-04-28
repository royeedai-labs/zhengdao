import { useMemo, useState } from 'react'
import { Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import type { AiWorkProfile } from '@/utils/ai/assistant-workflow'

/**
 * DI-01 v2 — AI 风格学习面板
 *
 * 嵌入 AiSettingsModal 的"作品上下文" tab，让作者粘贴 1~3 段过往作品，
 * 调用后端 layer2.style-learning Skill 抽取结构化风格指纹（用词偏好、句长
 * 分布、修辞密度、情感色彩）并保存到 ai_work_profiles.style_fingerprint。
 *
 * 后续 AiAssistantDock 在调用 continue_writing / polish_text 等 skill 时
 * 会把 style_fingerprint 透给后端，后端再以 fingerprint 为依据生成贴合作
 * 者风格的文本。
 */

const SAMPLE_MIN = 100
const SAMPLE_MAX = 5_000

interface StyleFingerprint {
  vocabulary: {
    preferredWords: string[]
    avoidedWords: string[]
    register: 'literary' | 'colloquial' | 'mixed' | 'technical' | 'formal'
  }
  sentence: {
    averageLength: number
    lengthDistribution: { short: number; medium: number; long: number }
    questionRate: number
  }
  rhetoric: {
    metaphorDensity: 'low' | 'medium' | 'high'
    dialogueRatio: number
    sensoryRatio: number
  }
  emotion: {
    primaryTone: string
    intensityDistribution: { muted: number; moderate: number; intense: number }
  }
  summary: string
}

interface StyleLearningOutput {
  projectId: string
  productGenre: string
  fingerprint: StyleFingerprint
  examples: {
    goodWritingFromSamples: string[]
    badPatternsToAvoid: string[]
  }
  sampleCount: number
}

function tryParseFingerprint(stored: string | undefined): StyleLearningOutput | null {
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as StyleLearningOutput | StyleFingerprint
    if (parsed && 'fingerprint' in parsed) {
      return parsed as StyleLearningOutput
    }
    if (parsed && 'vocabulary' in parsed && 'sentence' in parsed) {
      return {
        projectId: '',
        productGenre: 'webnovel',
        fingerprint: parsed as StyleFingerprint,
        examples: { goodWritingFromSamples: [], badPatternsToAvoid: [] },
        sampleCount: 0
      }
    }
    return null
  } catch {
    return null
  }
}

interface Props {
  bookId: number
  profile: AiWorkProfile
  onSaved: () => Promise<void> | void
}

export default function StyleLearningSection({ bookId, profile, onSaved }: Props) {
  const existing = useMemo(() => tryParseFingerprint(profile.style_fingerprint), [profile.style_fingerprint])
  const [editing, setEditing] = useState(!existing)
  const [samples, setSamples] = useState<string[]>(['', '', ''])
  const [running, setRunning] = useState(false)
  const [pending, setPending] = useState<StyleLearningOutput | null>(null)
  const addToast = useToastStore((s) => s.addToast)

  const productGenre = (profile.genre as StyleLearningOutput['productGenre']) || 'webnovel'

  const ready = samples.some((s) => s.trim().length >= SAMPLE_MIN)

  const handleLearn = async () => {
    const trimmed = samples
      .map((s, i) => ({ index: i, text: s.trim() }))
      .filter((s) => s.text.length >= SAMPLE_MIN)
    if (trimmed.length === 0) {
      addToast('error', `每段样本至少 ${SAMPLE_MIN} 字, 请至少填一段过往作品片段`)
      return
    }
    if (trimmed.some((s) => s.text.length > SAMPLE_MAX)) {
      addToast('error', `每段样本最多 ${SAMPLE_MAX} 字, 请精简后再试`)
      return
    }
    setRunning(true)
    try {
      const r = await window.api.aiExecuteSkill(
        'layer2.style-learning',
        {
          projectId: String(bookId),
          productGenre,
          samples: trimmed.map((s) => ({ label: `样本 ${s.index + 1}`, text: s.text }))
        },
        { modelHint: 'heavy' }
      )
      if (r.error) {
        const msg =
          r.code === 'PRO_REQUIRED'
            ? '风格学习是 Pro 功能, 请先升级证道 Pro'
            : r.code === 'GENRE_PACK_REQUIRED'
              ? `当前题材 (${r.genre || productGenre}) 需要订阅对应题材包`
              : r.code === 'SKILL_TIMEOUT'
                ? '风格学习超时, 请减少样本字数或稍后再试'
                : r.error
        addToast('error', msg)
        return
      }
      setPending(r.output as StyleLearningOutput)
    } finally {
      setRunning(false)
    }
  }

  const handleApply = async () => {
    if (!pending) return
    await window.api.aiSaveWorkProfile(bookId, {
      style_fingerprint: JSON.stringify(pending)
    })
    addToast('success', '风格指纹已保存到作品档案')
    setPending(null)
    setEditing(false)
    setSamples(['', '', ''])
    await onSaved()
  }

  const handleClear = async () => {
    await window.api.aiSaveWorkProfile(bookId, { style_fingerprint: '' })
    addToast('success', '已清除作品的风格指纹')
    await onSaved()
    setEditing(true)
    setPending(null)
  }

  const display = pending || existing

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Sparkles size={14} className="text-[var(--accent-secondary)]" />
          AI 风格学习 (DI-01)
        </div>
        {existing && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-[var(--accent-secondary)] hover:underline"
          >
            重新学习
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        粘贴 1~3 段过往作品 (每段 {SAMPLE_MIN}~{SAMPLE_MAX} 字), AI 会抽取你的写作指纹: 用词偏好、句长分布、修辞密度、情感色彩。
        指纹会保存到当前作品档案, 续写、润色、章末速评等 AI 能力调用时会自动注入。
      </p>

      {(editing || !existing) && (
        <div className="space-y-3">
          {samples.map((value, idx) => (
            <div key={idx}>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>样本 {idx + 1}{idx === 0 ? ' (必填)' : ' (可选)'}</span>
                <span>{value.trim().length} / {SAMPLE_MAX} 字</span>
              </div>
              <textarea
                rows={4}
                value={value}
                onChange={(e) =>
                  setSamples((cur) => {
                    const next = [...cur]
                    next[idx] = e.target.value
                    return next
                  })
                }
                placeholder={`粘贴第 ${idx + 1} 段过往作品片段, 至少 ${SAMPLE_MIN} 字...`}
                className="field min-h-[80px] resize-vertical font-mono text-xs"
              />
            </div>
          ))}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              当前题材: {productGenre} · 模型档位: heavy (高质量, 单次约 2~30 秒)
            </span>
            <button
              type="button"
              onClick={() => void handleLearn()}
              disabled={!ready || running}
              className="primary-btn disabled:opacity-50"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {running ? '学习中...' : '学习风格'}
            </button>
          </div>
        </div>
      )}

      {display && (
        <div className={`${editing ? 'mt-4 border-t border-[var(--border-primary)] pt-4' : ''} space-y-3`}>
          {pending && (
            <div className="flex items-center justify-between rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-3 py-2 text-xs text-[var(--accent-secondary)]">
              <span>新指纹已生成, 点"应用到作品档案"才会持久化覆盖</span>
              <button type="button" onClick={() => void handleApply()} className="primary-btn">
                应用到作品档案
              </button>
            </div>
          )}
          <FingerprintSummary data={display.fingerprint} />
          {display.examples.goodWritingFromSamples.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--accent-secondary)]">
                AI 标记的写得好的片段 ({display.examples.goodWritingFromSamples.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-4 text-[var(--text-muted)]">
                {display.examples.goodWritingFromSamples.map((line, i) => (
                  <li key={i} className="list-disc">{line}</li>
                ))}
              </ul>
            </details>
          )}
          {display.examples.badPatternsToAvoid.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--accent-secondary)]">
                AI 标记的需要避免的写法 ({display.examples.badPatternsToAvoid.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-4 text-[var(--text-muted)]">
                {display.examples.badPatternsToAvoid.map((line, i) => (
                  <li key={i} className="list-disc">{line}</li>
                ))}
              </ul>
            </details>
          )}
          {existing && !editing && (
            <button
              type="button"
              onClick={() => void handleClear()}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-500"
            >
              <Trash2 size={12} /> 清除指纹
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FingerprintSummary({ data }: { data: StyleFingerprint }) {
  return (
    <div className="grid gap-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs md:grid-cols-2">
      <div className="md:col-span-2">
        <div className="mb-1 text-[var(--text-muted)]">总体风格摘要</div>
        <div className="text-[var(--text-primary)]">{data.summary}</div>
      </div>
      <Stat label="语体" value={data.vocabulary.register} />
      <Stat label="平均句长" value={`${data.sentence.averageLength} 字`} />
      <Stat
        label="句长分布"
        value={`短 ${pct(data.sentence.lengthDistribution.short)} · 中 ${pct(data.sentence.lengthDistribution.medium)} · 长 ${pct(data.sentence.lengthDistribution.long)}`}
      />
      <Stat label="疑问句率" value={pct(data.sentence.questionRate)} />
      <Stat label="比喻密度" value={data.rhetoric.metaphorDensity} />
      <Stat label="对话占比" value={pct(data.rhetoric.dialogueRatio)} />
      <Stat label="感官描写" value={pct(data.rhetoric.sensoryRatio)} />
      <Stat label="主导情感" value={data.emotion.primaryTone || '—'} />
      {data.vocabulary.preferredWords.length > 0 && (
        <div className="md:col-span-2">
          <div className="mb-1 text-[var(--text-muted)]">偏好用词</div>
          <div className="flex flex-wrap gap-1">
            {data.vocabulary.preferredWords.map((w) => (
              <span key={w} className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[var(--text-primary)]">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.vocabulary.avoidedWords.length > 0 && (
        <div className="md:col-span-2">
          <div className="mb-1 text-[var(--text-muted)]">回避用词</div>
          <div className="flex flex-wrap gap-1">
            {data.vocabulary.avoidedWords.map((w) => (
              <span key={w} className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[var(--text-muted)] line-through">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[var(--text-muted)]">{label}</div>
      <div className="text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

function pct(v: number): string {
  if (Number.isNaN(v)) return '—'
  return `${Math.round(v * 100)}%`
}

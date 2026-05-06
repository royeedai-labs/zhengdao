import { useCallback, useEffect, useState } from 'react'
import { Archive, Coins, GitBranch, Image, Loader2, Sparkles, Tags, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import type { VisualAsset, VisualGenerateInput, VisualSkillId } from '../../../../shared/visual'

const SKILLS: Array<{ id: VisualSkillId; label: string }> = [
  { id: 'layer2.visual.cover-gen', label: '封面' },
  { id: 'layer2.visual.character-portrait', label: '角色肖像' },
  { id: 'layer2.visual.scene-illustration', label: '场景插画' }
]

function skillLabel(skillId: VisualSkillId): string {
  return SKILLS.find((skill) => skill.id === skillId)?.label || skillId
}

function metadataText(asset: VisualAsset, key: string): string {
  const value = asset.metadata?.[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export default function VisualStudioModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const bookId = useBookStore((s) => s.currentBookId)
  const addToast = useToastStore((s) => s.addToast)
  const [skillId, setSkillId] = useState<VisualSkillId>('layer2.visual.cover-gen')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('')
  const [assets, setAssets] = useState<VisualAsset[]>([])
  const [loading, setLoading] = useState(false)

  const refreshAssets = useCallback(async () => {
    if (!bookId) return
    const rows = await window.api.visual.listAssets(bookId) as VisualAsset[]
    setAssets(rows)
  }, [bookId])

  useEffect(() => {
    void refreshAssets()
  }, [refreshAssets])

  const generate = async () => {
    if (!bookId) return
    if (!prompt.trim()) {
      addToast('error', '请输入视觉提示词')
      return
    }
    setLoading(true)
    try {
      const input: VisualGenerateInput = {
        bookId,
        skillId,
        modelHint: 'balanced',
        input: {
          prompt: prompt.trim(),
          style: style.trim() || undefined,
          n: 1
        }
      }
      const result = await window.api.visual.generate(input) as { assets: VisualAsset[]; error?: string; code?: string }
      if (result.error) {
        addToast('error', result.code === 'VISUAL_QUOTA_EXCEEDED' ? '视觉额度不足' : result.error)
        return
      }
      setAssets((current) => [...result.assets, ...current])
      addToast('success', `已生成 ${result.assets.length} 个视觉资产`)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const coverCount = assets.filter((asset) => asset.skill_id === 'layer2.visual.cover-gen').length
  const characterCount = assets.filter((asset) => asset.skill_id === 'layer2.visual.character-portrait').length
  const sceneCount = assets.filter((asset) => asset.skill_id === 'layer2.visual.scene-illustration').length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <Image size={18} className="text-[var(--accent-secondary)]" />
            视觉资产
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden">
          <aside className="space-y-3 overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
            <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <Archive size={14} className="text-[var(--accent-secondary)]" />
                资产库
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded border border-[var(--border-primary)] px-2 py-1">
                  <div className="font-bold text-[var(--text-primary)]">{coverCount}</div>
                  <div className="text-[var(--text-muted)]">封面</div>
                </div>
                <div className="rounded border border-[var(--border-primary)] px-2 py-1">
                  <div className="font-bold text-[var(--text-primary)]">{characterCount}</div>
                  <div className="text-[var(--text-muted)]">角色</div>
                </div>
                <div className="rounded border border-[var(--border-primary)] px-2 py-1">
                  <div className="font-bold text-[var(--text-primary)]">{sceneCount}</div>
                  <div className="text-[var(--text-muted)]">场景</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                生成结果按作品保存在本地，优先绑定封面候选、人物设定和章节场景参考。
              </div>
            </section>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              类型
              <select value={skillId} onChange={(e) => setSkillId(e.target.value as VisualSkillId)} className="field mt-1 w-full text-xs">
                {SKILLS.map((skill) => (
                  <option key={skill.id} value={skill.id}>{skill.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Prompt
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="field mt-1 min-h-[160px] w-full resize-none text-xs"
                placeholder="画面主体、构图、光线、时代、角色特征"
              />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Style
              <input
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="field mt-1 w-full text-xs"
                placeholder="cinematic, ink wash, etc."
              />
            </label>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={!bookId || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--accent-contrast)] disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              生成
            </button>
          </aside>

          <main className="overflow-y-auto p-4">
            {assets.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] text-sm text-[var(--text-muted)]">
                暂无视觉资产
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assets.map((asset) => (
                  <article key={asset.id} className="overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
                    <div className="aspect-[4/3] bg-[var(--bg-tertiary)]">
                      {asset.url ? (
                        <img src={asset.url} alt={asset.skill_id} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">无预览</div>
                      )}
                    </div>
                    <div className="space-y-1 p-3 text-[11px] text-[var(--text-muted)]">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-surface)] px-2 py-0.5 font-semibold text-[var(--accent-secondary)]">
                          {skillLabel(asset.skill_id)}
                        </span>
                        {metadataText(asset, 'promptVersion') && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-primary)] px-2 py-0.5">
                            <GitBranch size={10} />
                            {metadataText(asset, 'promptVersion')}
                          </span>
                        )}
                        {metadataText(asset, 'pointCost') && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-primary)] px-2 py-0.5">
                            <Coins size={10} />
                            {metadataText(asset, 'pointCost')} 点
                          </span>
                        )}
                      </div>
                      {(metadataText(asset, 'characterName') || metadataText(asset, 'chapterTitle') || metadataText(asset, 'usageStatus')) && (
                        <div className="flex flex-wrap gap-1">
                          {metadataText(asset, 'characterName') && (
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5">
                              <Tags size={10} /> {metadataText(asset, 'characterName')}
                            </span>
                          )}
                          {metadataText(asset, 'chapterTitle') && (
                            <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5">
                              {metadataText(asset, 'chapterTitle')}
                            </span>
                          )}
                          {metadataText(asset, 'usageStatus') && (
                            <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5">
                              {metadataText(asset, 'usageStatus')}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="font-mono text-[var(--text-primary)]">{asset.skill_id}</div>
                      {asset.prompt_used && (
                        <div className="line-clamp-2 text-[var(--text-secondary)]">prompt: {asset.prompt_used}</div>
                      )}
                      {asset.local_path ? (
                        <div className="break-all">local: {asset.local_path}</div>
                      ) : (
                        <div className="text-[var(--warning-primary)]">本地文件未保存</div>
                      )}
                      {asset.sha256 && <div className="break-all">sha256: {asset.sha256.slice(0, 16)}...</div>}
                      <div>{asset.width || '?'} x {asset.height || '?'} · {asset.mime_type || asset.provider || 'unknown'}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

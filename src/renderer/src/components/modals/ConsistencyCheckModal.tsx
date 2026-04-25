import { useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useCharacterStore } from '@/stores/character-store'
import { useBookStore } from '@/stores/book-store'
import { useToastStore } from '@/stores/toast-store'
import { aiComplete, getResolvedAiConfigForBook, isAiConfigReady } from '@/utils/ai'
import type { Character } from '@/types'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '\n').replace(/\s+/g, ' ').trim()
}

function extractRelevantParagraphs(html: string, name: string, maxChars: number): string {
  const plain = stripHtml(html)
  if (!plain.includes(name)) return plain.slice(0, maxChars)
  const sentences = plain.split(/(?<=[。！？\n])/).filter((s) => s.includes(name))
  let out = sentences.join('').trim()
  if (!out) out = plain
  return out.slice(0, maxChars)
}

export default function ConsistencyCheckModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const characters = useCharacterStore((s) => s.characters)
  const bookId = useBookStore((s) => s.currentBookId)!
  const [characterId, setCharacterId] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const checkConsistency = async () => {
    if (characterId === '') return
    const character = characters.find((c) => c.id === characterId) as Character | undefined
    if (!character) return

    const config = await getResolvedAiConfigForBook(bookId)
    if (!isAiConfigReady(config)) {
      useToastStore.getState().addToast('warning', '请先在应用设置中配置 AI')
      return
    }

    setLoading(true)
    setResult('')
    try {
      const appearances = (await window.api.getCharacterAppearances(characterId)) as {
        chapter_id: number
        chapter_title: string
      }[]
      const allChapters = (await window.api.getAllChaptersForBook(bookId)) as Array<{
        id: number
        title: string
        content: string | null
      }>

      const chapterMap = new Map(allChapters.map((c) => [c.id, c]))
      const contexts: string[] = []
      let budget = 12000

      for (const app of appearances.slice(0, 10)) {
        const chapter = chapterMap.get(app.chapter_id)
        if (!chapter?.content) continue
        const chunkBudget = Math.min(1800, budget)
        if (chunkBudget < 200) break
        const relevant = extractRelevantParagraphs(chapter.content, character.name, chunkBudget)
        const block = `=== ${chapter.title} ===\n${relevant}`
        contexts.push(block)
        budget -= block.length
      }

      if (contexts.length === 0) {
        useToastStore.getState().addToast('warning', '未找到包含该角色的章节正文')
        setLoading(false)
        return
      }

      const cfg = {
        ai_provider: config.ai_provider,
        ai_api_key: config.ai_api_key,
        ai_api_endpoint: config.ai_api_endpoint,
        ai_model: config.ai_model || '',
        ai_official_profile_id: config.ai_official_profile_id || ''
      }

      const prompt = `分析以下角色在各章节中的描述是否一致。检查：称呼、性格、能力、外貌等是否前后矛盾。\n角色信息：${character.name}，${character.faction}，${character.description}\n\n列出发现的不一致之处，格式：[章节名] 具体问题描述`

      const res = await aiComplete(cfg, prompt, contexts.join('\n\n'))
      if (res.error) {
        useToastStore.getState().addToast('error', res.error)
        setLoading(false)
        return
      }
      setResult(res.content.trim())
    } catch (e) {
      useToastStore.getState().addToast('error', e instanceof Error ? e.message : '检查失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 shrink-0">
          <div className="flex items-center space-x-2 font-bold text-[var(--warning-primary)]">
            <ShieldAlert size={18} />
            <span>角色一致性检查</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="mb-1 block text-[11px] uppercase text-[var(--text-muted)]">选择角色</label>
            <select
              value={characterId === '' ? '' : String(characterId)}
              onChange={(e) => setCharacterId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--warning-primary)] focus:outline-none"
            >
              <option value="">请选择</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={characterId === '' || loading}
            onClick={() => void checkConsistency()}
            className="w-full rounded-lg bg-[var(--warning-primary)] py-2 text-sm font-bold text-[var(--warning-contrast)] transition hover:brightness-105 disabled:opacity-40"
          >
            {loading ? '分析中…' : '开始检查'}
          </button>

          {result && (
            <div className="whitespace-pre-wrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
              {result}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

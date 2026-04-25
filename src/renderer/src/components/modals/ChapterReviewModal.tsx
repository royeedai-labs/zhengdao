import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, ClipboardList, Loader2, Send, X } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { usePlotStore } from '@/stores/plot-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { getResolvedAiConfigForBook, isAiConfigReady, aiPrompt } from '@/utils/ai'
import {
  CHAPTER_REVIEW_SECTIONS,
  buildChapterReviewPrompt,
  extractReviewAssetDrafts,
  normalizeReviewReport
} from '@/utils/chapter-review'
import { stripHtmlToText } from '@/utils/html-to-text'
import type { AiDraftPayload } from '@/utils/ai/assistant-workflow'

function draftTitle(draft: AiDraftPayload): string {
  if (typeof draft.title === 'string' && draft.title.trim()) return draft.title
  if (typeof draft.name === 'string' && draft.name.trim()) return draft.name
  if (typeof draft.text === 'string' && draft.text.trim()) return draft.text.slice(0, 24)
  switch (draft.kind) {
    case 'create_character':
      return '新角色建议'
    case 'create_wiki_entry':
      return '新设定建议'
    case 'create_plot_node':
      return '新剧情节点建议'
    case 'create_foreshadowing':
      return '新伏笔建议'
    default:
      return 'AI 资产建议'
  }
}

export default function ChapterReviewModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)
  const bookId = useBookStore((s) => s.currentBookId)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const characters = useCharacterStore((s) => s.characters)
  const foreshadowings = useForeshadowStore((s) => s.foreshadowings)
  const plotNodes = usePlotStore((s) => s.plotNodes)
  const [focus, setFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [assetDrafts, setAssetDrafts] = useState<AiDraftPayload[]>([])
  const [draftsSent, setDraftsSent] = useState(false)

  const chapterText = useMemo(() => stripHtmlToText(currentChapter?.content || '').trim(), [currentChapter?.content])

  const runReview = async () => {
    if (!bookId || !currentChapter) return
    if (!chapterText) {
      useToastStore.getState().addToast('warning', '本章暂无正文，无法审稿')
      return
    }

    const config = await getResolvedAiConfigForBook(bookId)
    if (!isAiConfigReady(config)) {
      useToastStore.getState().addToast('warning', '请先在应用设置中配置 AI 全局账号，或补充作品 AI 档案')
      return
    }

    setLoading(true)
    setReport('')
    setAssetDrafts([])
    setDraftsSent(false)
    try {
      const charactersText = characters
        .slice(0, 30)
        .map((character) => `- ${character.name}：${character.description || '无描述'}`)
        .join('\n')
      const foreshadowingsText = foreshadowings
        .slice(0, 30)
        .map((item) => `- [${item.status}] ${item.text}`)
        .join('\n')
      const plotNodesText = plotNodes
        .slice(0, 30)
        .map((node) => `- Ch${node.chapter_number} ${node.title}：${node.description || '无说明'}`)
        .join('\n')

      const prompt = buildChapterReviewPrompt({
        chapterTitle: currentChapter.title,
        chapterText,
        charactersText,
        foreshadowingsText,
        plotNodesText,
        userFocus: focus
      })
      const response = await aiPrompt(config, prompt.systemPrompt, prompt.userPrompt, 2600, 0.35)
      if (response.error) {
        useToastStore.getState().addToast('error', response.error)
        return
      }
      const nextReport = normalizeReviewReport(response.content)
      setReport(nextReport)
      setAssetDrafts(extractReviewAssetDrafts(response.content).drafts)
    } catch (error) {
      useToastStore.getState().addToast('error', error instanceof Error ? error.message : '审稿失败')
    } finally {
      setLoading(false)
    }
  }

  const sendDraftsToBasket = async () => {
    if (!bookId || !report || assetDrafts.length === 0) return
    try {
      const conversation = (await window.api.aiGetOrCreateConversation(bookId)) as { id: number }
      const userMessage = await window.api.aiAddMessage(
        conversation.id,
        'user',
        `本章审稿：${currentChapter?.title || '未命名章节'}`,
        { mode: 'chapter_review' }
      ) as { id: number }
      const assistantMessage = await window.api.aiAddMessage(
        conversation.id,
        'assistant',
        report,
        { mode: 'chapter_review', asset_draft_count: assetDrafts.length }
      ) as { id: number }
      void userMessage

      for (const draft of assetDrafts) {
        await window.api.aiCreateDraft({
          book_id: bookId,
          conversation_id: conversation.id,
          message_id: assistantMessage.id,
          kind: draft.kind,
          title: draftTitle(draft),
          payload: draft,
          target_ref: currentChapter ? `chapter:${currentChapter.id}` : ''
        })
      }
      setDraftsSent(true)
      openAiAssistant()
      useToastStore.getState().addToast('success', '资产建议已进入 AI 草稿篮')
    } catch (error) {
      useToastStore.getState().addToast('error', error instanceof Error ? error.message : '发送草稿失败')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--accent-secondary)]">
            <Bot size={18} />
            <span>本章审稿台</span>
            {currentChapter && <span className="text-xs font-normal text-[var(--text-muted)]">{currentChapter.title}</span>}
          </div>
          <button type="button" onClick={closeModal} className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 lg:border-b-0 lg:border-r">
            <div className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 text-xs text-[var(--text-secondary)]">
              <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <ClipboardList size={14} /> 固定审稿维度
              </div>
              <div className="space-y-1">
                {CHAPTER_REVIEW_SECTIONS.map((section) => (
                  <div key={section} className="flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-[var(--success-primary)]" />
                    <span>{section}</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              额外关注
              <textarea
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                rows={5}
                placeholder="例如：重点看主角行为是否降智、伏笔是否拖太久、这一章是否够爽。"
                className="mt-2 w-full resize-none rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-normal text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </label>

            <button
              type="button"
              disabled={!currentChapter || loading}
              onClick={() => void runReview()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
              {loading ? '审稿中…' : '开始审稿'}
            </button>

            {assetDrafts.length > 0 && (
              <div className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-surface)] p-3 text-xs text-[var(--accent-secondary)]">
                <div className="font-semibold">发现 {assetDrafts.length} 条资产建议</div>
                <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
                  {assetDrafts.map((draft, index) => (
                    <div key={`${draft.kind}-${index}`} className="truncate">
                      {index + 1}. {draftTitle(draft)}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={draftsSent}
                  onClick={() => void sendDraftsToBasket()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] disabled:opacity-50"
                >
                  <Send size={13} />
                  {draftsSent ? '已进入草稿篮' : '发送到草稿篮确认'}
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {!report ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-center text-sm text-[var(--text-muted)]">
                <div>
                  <Bot size={32} className="mx-auto mb-3 text-[var(--accent-secondary)]" />
                  <p>审稿报告会显示在这里。</p>
                  <p className="mt-1 text-xs">AI 只给建议，正文和资产改动必须由你确认。</p>
                </div>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4 font-sans text-sm leading-7 text-[var(--text-primary)]">
                {report}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

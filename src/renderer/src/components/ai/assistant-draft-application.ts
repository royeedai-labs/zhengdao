import {
  planTextDraftApplication,
  type AiDraftPayload
} from '@/utils/ai/assistant-workflow'
import { stripHtmlToText } from '@/utils/html-to-text'
import { getActiveEditor } from '@/components/editor/active-editor'
import {
  applyProfessionalTemplate,
  getProfessionalTemplate
} from '../../../../shared/professional-templates'
import { useToastStore } from '@/stores/toast-store'
import { ensureHtmlContent } from './ai-assistant-helpers'

/**
 * SPLIT-006 phase 3 — apply an AI-emitted draft against local SQLite + the
 * active Tiptap editor.
 *
 * 13 draft kinds, each with its own DB-write or editor-command sequence:
 *   - insert_text / replace_text — Tiptap `insertContentAt` + snapshot rollback
 *   - create_chapter — finds-or-creates the target volume, then chapter
 *   - update_chapter_summary — confirm-overwrite if non-empty
 *   - create_character / create_wiki_entry / create_plot_node /
 *     create_foreshadowing — direct repo writes
 *   - create_citation / create_reference / create_policy_anchor —
 *     academic + professional flavours of wiki entries
 *     (categories: 'citation' / 'reference' / 'policy')
 *   - apply_format_template — DI-05 公文 template wrap on chapter content
 *   - create_section_outline — not yet supported (DI-02 / DI-07 v2)
 *
 * Pulled out of the 1100-LOC AiAssistantPanel component so the heavy
 * branching logic has a separate review surface from the React render.
 */

export interface ApplyAiDraftRow {
  id: number
  conversation_id?: number | null
  kind: string
  title: string
  payload: Record<string, unknown>
  status: 'pending' | 'applied' | 'dismissed'
  target_ref?: string
}

export interface ApplyAiDraftCurrentChapter {
  id: number
  content?: string | null
  summary?: string | null
  word_count?: number
}

export interface ApplyAiDraftVolume {
  id: number
  title: string
}

export interface ApplyAiDraftDeps {
  currentChapter: ApplyAiDraftCurrentChapter | null
  bookId: number
  volumes: ApplyAiDraftVolume[]
  updateChapterContent: (chapterId: number, html: string, wordCount: number) => Promise<void> | void
  createVolume: (bookId: number, title: string) => Promise<ApplyAiDraftVolume>
  createChapter: (
    volumeId: number,
    title: string,
    contentHtml: string,
    summary: string
  ) => Promise<{ id: number }>
  selectChapter: (chapterId: number) => Promise<void> | void
  updateChapterSummary: (chapterId: number, summary: string) => Promise<void> | void
  createCharacter: (input: {
    book_id: number
    name: string
    faction: string
    status: string
    description: string
    custom_fields: Record<string, string>
  }) => Promise<unknown>
  createWikiEntry: (input: {
    book_id: number
    category: string
    title: string
    content: string
  }) => Promise<unknown>
  createPlotNode: (input: {
    book_id: number
    title: string
    description: string
    chapter_number: number
    score: number
    node_type: 'main' | 'branch'
  }) => Promise<unknown>
  createForeshadowing: (input: {
    book_id: number
    chapter_id?: number
    text: string
    expected_chapter: number | null
    expected_word_count: number | null
    status: 'pending'
  }) => Promise<unknown>
  markDraft: (draftId: number, status: 'applied' | 'dismissed') => Promise<void>
  /** Confirmation prompt; default uses window.confirm. Injected for tests. */
  confirm?: (message: string) => boolean
}

export async function applyAiDraft(
  draft: ApplyAiDraftRow,
  deps: ApplyAiDraftDeps
): Promise<void> {
  const payload = draft.payload
  const confirmFn = deps.confirm ?? ((message: string) => window.confirm(message))
  try {
    switch (draft.kind) {
      case 'insert_text': {
        if (!deps.currentChapter) throw new Error('请先打开目标章节')
        const plan = planTextDraftApplication(payload as AiDraftPayload, deps.currentChapter.id)
        if (!plan || plan.kind === 'invalid' || plan.kind !== 'insert_text') {
          throw new Error(plan?.kind === 'invalid' ? plan.error : '草稿正文为空')
        }
        const htmlFragment = ensureHtmlContent(plan.content)
        const activeEditor = getActiveEditor()
        if (activeEditor) {
          const beforeHtml = activeEditor.getHTML()
          const beforeWordCount = stripHtmlToText(beforeHtml).replace(/\s/g, '').length
          await window.api.createSnapshot({
            chapter_id: deps.currentChapter.id,
            content: beforeHtml,
            word_count: beforeWordCount
          })
          const maxPos = activeEditor.state.doc.content.size
          const insertAt = Math.max(0, Math.min(plan.insertAt ?? maxPos, maxPos))
          const inserted = activeEditor.commands.insertContentAt(insertAt, htmlFragment)
          if (!inserted) throw new Error('无法将 AI 草稿插入当前正文。')
          const nextHtml = activeEditor.getHTML()
          await deps.updateChapterContent(
            deps.currentChapter.id,
            nextHtml,
            stripHtmlToText(nextHtml).replace(/\s/g, '').length
          )
        } else {
          const html = `${deps.currentChapter.content || ''}${htmlFragment}`
          await window.api.createSnapshot({
            chapter_id: deps.currentChapter.id,
            content: deps.currentChapter.content || '',
            word_count: deps.currentChapter.word_count || 0
          })
          await deps.updateChapterContent(
            deps.currentChapter.id,
            html,
            stripHtmlToText(html).replace(/\s/g, '').length
          )
        }
        break
      }
      case 'replace_text': {
        if (!deps.currentChapter) throw new Error('请先打开目标章节')
        const plan = planTextDraftApplication(payload as AiDraftPayload, deps.currentChapter.id)
        if (!plan || plan.kind === 'invalid' || plan.kind !== 'replace_text') {
          throw new Error(plan?.kind === 'invalid' ? plan.error : '替换正文为空')
        }
        const activeEditor = getActiveEditor()
        if (!activeEditor) throw new Error('请返回编辑器后再应用润色草稿。')
        const maxPos = activeEditor.state.doc.content.size
        if (plan.from < 0 || plan.to > maxPos) {
          throw new Error('原选区已失效，请重新生成润色草稿。')
        }
        const liveText = activeEditor.state.doc.textBetween(plan.from, plan.to, '\n')
        if (liveText !== plan.expectedText) {
          throw new Error('原选区已变化，请重新生成润色草稿。')
        }
        const beforeHtml = activeEditor.getHTML()
        const beforeWordCount = stripHtmlToText(beforeHtml).replace(/\s/g, '').length
        await window.api.createSnapshot({
          chapter_id: deps.currentChapter.id,
          content: beforeHtml,
          word_count: beforeWordCount
        })
        const replaced = activeEditor.commands.insertContentAt(
          { from: plan.from, to: plan.to },
          ensureHtmlContent(plan.content)
        )
        if (!replaced) throw new Error('无法将润色草稿应用到当前选区。')
        const nextHtml = activeEditor.getHTML()
        await deps.updateChapterContent(
          deps.currentChapter.id,
          nextHtml,
          stripHtmlToText(nextHtml).replace(/\s/g, '').length
        )
        break
      }
      case 'create_chapter': {
        const requestedVolumeId = Number(payload.volume_id || payload.volumeId)
        const requestedVolumeTitle = String(
          payload.volume_title || payload.volumeTitle || payload.volume || ''
        ).trim()
        let volumeId =
          Number.isFinite(requestedVolumeId) && deps.volumes.some((volume) => volume.id === requestedVolumeId)
            ? requestedVolumeId
            : null
        if (volumeId == null && requestedVolumeTitle) {
          const existingVolume = deps.volumes.find(
            (volume) => volume.title.trim() === requestedVolumeTitle
          )
          volumeId = existingVolume?.id ?? null
          if (volumeId == null) {
            const createdVolume = await deps.createVolume(deps.bookId, requestedVolumeTitle)
            volumeId = createdVolume.id
          }
        }
        if (volumeId == null) {
          const fallbackVolume =
            deps.volumes[deps.volumes.length - 1] ?? (await deps.createVolume(deps.bookId, '第一卷'))
          volumeId = fallbackVolume.id
        }
        const content = String(payload.content || payload.body || '').trim()
        if (!content) throw new Error('章节正文为空')
        const chapter = await deps.createChapter(
          volumeId,
          String(payload.title || draft.title || 'AI 新章节'),
          ensureHtmlContent(content),
          String(payload.summary || '').trim()
        )
        await deps.selectChapter(chapter.id)
        break
      }
      case 'update_chapter_summary': {
        if (!deps.currentChapter) throw new Error('请先打开目标章节')
        if (deps.currentChapter.summary?.trim()) {
          const ok = confirmFn('当前章节已有摘要。确定用这条 AI 摘要覆盖吗？')
          if (!ok) return
        }
        const summary = String(payload.summary || payload.content || '').trim()
        if (!summary) throw new Error('摘要内容为空')
        await deps.updateChapterSummary(deps.currentChapter.id, summary)
        break
      }
      case 'create_character': {
        await deps.createCharacter({
          book_id: deps.bookId,
          name: String(payload.name || draft.title || 'AI 角色'),
          faction: String(payload.faction || 'neutral'),
          status: String(payload.status || 'active'),
          description: String(payload.description || payload.content || ''),
          custom_fields: (payload.custom_fields || {}) as Record<string, string>
        })
        break
      }
      case 'create_wiki_entry': {
        await deps.createWikiEntry({
          book_id: deps.bookId,
          category: String(payload.category || 'AI 设定'),
          title: String(payload.title || draft.title || 'AI 设定'),
          content: String(payload.content || '')
        })
        break
      }
      case 'create_plot_node': {
        await deps.createPlotNode({
          book_id: deps.bookId,
          title: String(payload.title || draft.title || 'AI 剧情节点'),
          description: String(payload.description || payload.content || ''),
          chapter_number: Number(payload.chapter_number || 0),
          score: Math.max(-5, Math.min(5, Number(payload.score || 0))),
          node_type: payload.node_type === 'branch' ? 'branch' : 'main'
        })
        break
      }
      case 'create_foreshadowing': {
        await deps.createForeshadowing({
          book_id: deps.bookId,
          chapter_id: deps.currentChapter?.id,
          text: String(payload.text || payload.content || draft.title || 'AI 伏笔'),
          expected_chapter: payload.expected_chapter == null ? null : Number(payload.expected_chapter),
          expected_word_count:
            payload.expected_word_count == null ? null : Number(payload.expected_word_count),
          status: 'pending'
        })
        break
      }
      // GP-05 v2: 5 个 academic / professional 题材专属 kind 的副作用。
      // 引用 / Reference / 政策对照统一落到 wiki_entries (复用 settings_wiki)
      // 用 category 区分；apply_format_template 用 DI-05 公文模板包装章节
      // 正文。create_section_outline 因为 chapters 表当前没有 outline 字段
      // 暂不支持，等 DI-02 引用管理 / DI-07 Canon Pack v2 给章节加上 outline
      // 列后再补。
      case 'create_citation': {
        const authors = Array.isArray(payload.authors)
          ? (payload.authors as unknown[]).map(String).filter(Boolean).join('，')
          : String(payload.authors || '')
        const formatted = String(
          payload.formatted ||
            `${authors}. ${String(payload.title || '')}. ${String(payload.source || '')}, ${String(payload.year || '')}.`
        ).trim()
        await deps.createWikiEntry({
          book_id: deps.bookId,
          category: 'citation',
          title: String(payload.title || draft.title || 'AI 引用'),
          content: JSON.stringify(
            {
              formatted,
              authors,
              year: payload.year ?? '',
              source: payload.source ?? '',
              doi: payload.doi ?? '',
              format: payload.format ?? 'GBT7714'
            },
            null,
            2
          )
        })
        break
      }
      case 'create_reference': {
        await deps.createWikiEntry({
          book_id: deps.bookId,
          category: 'reference',
          title: String(payload.title || draft.title || 'AI 文献'),
          content: String(payload.content || JSON.stringify(payload, null, 2))
        })
        break
      }
      case 'create_policy_anchor': {
        await deps.createWikiEntry({
          book_id: deps.bookId,
          category: 'policy',
          title: String(payload.title || payload.policyName || draft.title || 'AI 政策依据'),
          content: JSON.stringify(
            {
              policyNumber: payload.policyNumber ?? '',
              issuer: payload.issuer ?? '',
              date: payload.policyDate ?? payload.date ?? '',
              excerpt: payload.excerpt ?? payload.content ?? ''
            },
            null,
            2
          )
        })
        break
      }
      case 'apply_format_template': {
        if (!deps.currentChapter) throw new Error('请先打开目标章节')
        const templateId = String(payload.templateName || payload.templateId || '')
        if (!templateId || !getProfessionalTemplate(templateId)) {
          throw new Error('未指定有效的公文模板（如 red-header-notice / request 等）')
        }
        const original = stripHtmlToText(deps.currentChapter.content || '')
        const rawContentToWrap = String(payload.contentToWrap || original).trim()
        if (!rawContentToWrap) throw new Error('章节内容为空，无法套用公文模板')
        const fields = (payload.fields as Record<string, string>) ?? {}
        const wrapped = applyProfessionalTemplate(templateId, rawContentToWrap, fields)
        await window.api.createSnapshot({
          chapter_id: deps.currentChapter.id,
          content: deps.currentChapter.content ?? '',
          word_count: stripHtmlToText(deps.currentChapter.content || '').replace(/\s/g, '').length
        })
        const wrappedHtml = wrapped
          .split('\n\n')
          .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('')
        await deps.updateChapterContent(
          deps.currentChapter.id,
          wrappedHtml,
          stripHtmlToText(wrappedHtml).replace(/\s/g, '').length
        )
        break
      }
      case 'create_section_outline': {
        throw new Error(
          '章节大纲草稿暂不支持，等待 DI-02 引用管理 / DI-07 Canon Pack v2 上线后启用。'
        )
      }
      default:
        throw new Error('暂不支持应用该草稿')
    }
    await deps.markDraft(draft.id, 'applied')
    useToastStore.getState().addToast('success', 'AI 草稿已应用')
  } catch (err) {
    useToastStore.getState().addToast('error', err instanceof Error ? err.message : '应用草稿失败')
  }
}

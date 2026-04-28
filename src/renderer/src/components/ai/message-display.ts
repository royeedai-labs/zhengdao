import {
  createChapterDraftFromAssistantResponse,
  parseAssistantDrafts,
  type AiDraftPayload
} from '../../utils/ai/assistant-workflow'
import {
  buildDraftPreviewModel,
  type DraftPreviewModel
} from './draft-preview'

export type AssistantMessageDisplay =
  | {
      kind: 'text'
      text: string
    }
  | {
      kind: 'drafts'
      intro: string
      drafts: DraftPreviewModel[]
    }

type MessageLike = {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, unknown>
}

function draftTitle(draft: AiDraftPayload): string {
  if (typeof draft.title === 'string' && draft.title.trim()) return draft.title.trim()
  if (typeof draft.name === 'string' && draft.name.trim()) return draft.name.trim()
  switch (draft.kind) {
    case 'insert_text':
      return '插入正文'
    case 'replace_text':
      return '替换正文'
    case 'create_chapter':
      return '创建章节'
    case 'update_chapter_summary':
      return '更新章节摘要'
    case 'create_character':
      return '创建角色'
    case 'create_wiki_entry':
      return '创建设定'
    case 'create_plot_node':
      return '创建剧情节点'
    case 'create_foreshadowing':
      return '创建伏笔'
    default:
      return 'AI 草稿'
  }
}

function looksLikeStructuredDraft(text: string): boolean {
  return /^(?:```|\{|\[)/.test(text.trim())
}

export function buildAssistantMessageDisplay(message: MessageLike): AssistantMessageDisplay {
  const text = message.content.trim()
  if (message.role !== 'assistant') {
    return { kind: 'text', text: message.content }
  }

  if (!looksLikeStructuredDraft(text)) {
    if (message.metadata?.skill_key === 'create_chapter') {
      const draft = createChapterDraftFromAssistantResponse(text, 'AI 新章节', {
        allowPlainTextFallback: true
      })
      if (draft) {
        return {
          kind: 'text',
          text: `已生成《${draftTitle(draft)}》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。`
        }
      }
    }
    return { kind: 'text', text: message.content }
  }

  const parsed = parseAssistantDrafts(text)
  if (parsed.drafts.length === 0) {
    const chapterDraft = createChapterDraftFromAssistantResponse(text, 'AI 新章节', {
      allowPlainTextFallback: message.metadata?.skill_key === 'create_chapter'
    })
    if (chapterDraft) {
      return {
        kind: 'text',
        text: `已生成《${draftTitle(chapterDraft)}》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。`
      }
    }
    return { kind: 'text', text: message.content }
  }

  if (parsed.drafts.every((draft) => draft.kind === 'create_chapter')) {
    const firstTitle = draftTitle(parsed.drafts[0])
    const countLabel = parsed.drafts.length > 1 ? `${parsed.drafts.length} 个章节草稿` : `《${firstTitle}》`
    return {
      kind: 'text',
      text: `已生成${parsed.drafts.length > 1 ? ' ' : ''}${countLabel}，已切到中间的 AI 章节草稿预览。确认后才会写入小说。`
    }
  }

  return {
    kind: 'drafts',
    intro: `已生成 ${parsed.drafts.length} 个草稿，已放入草稿篮。`,
    drafts: parsed.drafts.map((draft) =>
      buildDraftPreviewModel({
        kind: draft.kind,
        title: draftTitle(draft),
        payload: draft
      })
    )
  }
}

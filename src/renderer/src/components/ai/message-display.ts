import {
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
  if (message.role !== 'assistant' || !looksLikeStructuredDraft(text)) {
    return { kind: 'text', text: message.content }
  }

  const parsed = parseAssistantDrafts(text)
  if (parsed.drafts.length === 0) {
    return {
      kind: 'text',
      text: 'AI 返回了结构化草稿，但内容无法解析。请重试或清空当前会话。'
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

import {
  createChapterDraftFromAssistantResponse,
  parseAssistantDrafts,
  type AiAssistantContext,
  type AiDraftPayload,
  type AiSkillTemplate
} from '@/utils/ai/assistant-workflow'

/**
 * SPLIT-006 — generic helpers reused by AiAssistantPanel + the
 * BookshelfCreationAssistantPanel.
 *
 * Pure functions, no React state. The HTML escaping helpers stay
 * here because both panels apply them when seeding chapter content.
 */

export function plainToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(
      (part) =>
        `<p>${part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

export function ensureHtmlContent(text: string): string {
  const value = text.trim()
  if (!value) return ''
  return /<\/?[a-z][^>]*>/i.test(value) ? value : plainToHtml(value)
}

export function draftTitle(draft: AiDraftPayload): string {
  if (typeof draft.title === 'string' && draft.title.trim()) return draft.title
  if (typeof draft.name === 'string' && draft.name.trim()) return draft.name
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

export function normalizeAssistantDrafts(
  skill: AiSkillTemplate,
  content: string
): { drafts: AiDraftPayload[]; errors: string[] } {
  if (skill.output_contract === 'plain_text') {
    if (skill.key === 'continue_writing') {
      return { drafts: [{ kind: 'insert_text', content }], errors: [] }
    }
    return { drafts: [], errors: [] }
  }
  const parsed = parseAssistantDrafts(content)
  if (
    skill.key === 'create_chapter' &&
    parsed.drafts.length === 0 &&
    parsed.errors.every((error) => error === 'AI 返回内容不是可解析的 JSON 草稿')
  ) {
    const draft = createChapterDraftFromAssistantResponse(content, 'AI 新章节', {
      allowPlainTextFallback: true
    })
    if (draft) return { drafts: [draft], errors: [] }
  }
  return parsed
}

export function withLocalRagChip(context: AiAssistantContext): AiAssistantContext {
  if (context.chips.some((chip) => chip.id === 'local_rag')) return context
  return {
    ...context,
    chips: [
      ...context.chips,
      {
        id: 'local_rag',
        kind: 'local_rag',
        label: '本地片段',
        enabled: true
      }
    ]
  }
}

export function formatProviderLabel(provider?: string | null): string {
  switch (provider) {
    case 'zhengdao_official':
      return '官方 AI'
    case 'openai':
      return 'OpenAI 兼容'
    case 'gemini':
      return 'Gemini API'
    case 'gemini_cli':
      return 'Gemini CLI'
    case 'ollama':
      return 'Ollama'
    case 'custom_openai':
      return '自定义兼容'
    default:
      return '未配置'
  }
}

type DraftLike = {
  kind: string
  title: string
  payload: Record<string, unknown>
}

export type DraftPreviewField = {
  label: string
  value: string
}

export type DraftPreviewModel = {
  title: string
  summary: string
  fields: DraftPreviewField[]
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function contentSummary(value: unknown): string {
  const text = textValue(value)
  if (!text) return ''
  return /<\/?[a-z][^>]*>/i.test(text) ? htmlToPlainText(text) : text
}

function appendField(fields: DraftPreviewField[], label: string, value: unknown) {
  const text = textValue(value)
  if (!text) return
  fields.push({ label, value: text })
}

export function buildDraftPreviewModel(draft: DraftLike): DraftPreviewModel {
  const payload = draft.payload || {}
  const fields: DraftPreviewField[] = []

  switch (draft.kind) {
    case 'create_character': {
      appendField(fields, '阵营', payload.faction)
      appendField(fields, '状态', payload.status)
      const customFields = payload.custom_fields
      if (customFields && typeof customFields === 'object' && !Array.isArray(customFields)) {
        for (const [key, value] of Object.entries(customFields)) {
          appendField(fields, key, value)
        }
      }
      return {
        title: textValue(payload.name) || draft.title || 'AI 角色',
        summary: contentSummary(payload.description || payload.content),
        fields
      }
    }
    case 'create_wiki_entry': {
      appendField(fields, '分类', payload.category)
      return {
        title: textValue(payload.title) || draft.title || 'AI 设定',
        summary: contentSummary(payload.content),
        fields
      }
    }
    case 'create_plot_node': {
      appendField(fields, '章节', payload.chapter_number)
      appendField(fields, '情绪分', payload.score)
      appendField(fields, '节点类型', payload.node_type)
      return {
        title: textValue(payload.title) || draft.title || 'AI 剧情节点',
        summary: contentSummary(payload.description || payload.content),
        fields
      }
    }
    case 'create_foreshadowing': {
      appendField(fields, '预期章节', payload.expected_chapter)
      appendField(fields, '预期字数', payload.expected_word_count)
      return {
        title: textValue(payload.title) || textValue(payload.text) || draft.title || 'AI 伏笔',
        summary: contentSummary(payload.text || payload.content),
        fields
      }
    }
    case 'create_chapter': {
      return {
        title: textValue(payload.title) || draft.title || 'AI 新章节',
        summary: contentSummary(payload.content),
        fields
      }
    }
    case 'update_chapter_summary': {
      return {
        title: draft.title || '章节摘要',
        summary: contentSummary(payload.summary || payload.content),
        fields
      }
    }
    case 'replace_text':
    case 'insert_text':
    default:
      return {
        title: draft.title || 'AI 草稿',
        summary: contentSummary(
          payload.content || payload.description || payload.text || payload.summary || payload.title || payload.name
        ),
        fields
      }
  }
}

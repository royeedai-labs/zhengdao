import type { DraftListPanelDraft } from './panel-parts/DraftListPanel'

export type DraftQualityStep = {
  label: string
  status: 'done' | 'todo'
}

export type DraftQualityLoopModel = {
  title: string
  steps: DraftQualityStep[]
  canInspect: boolean
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function payloadText(draft: DraftListPanelDraft): string {
  const payload = draft.payload || {}
  return (
    textValue(payload.content) ||
    textValue(payload.text) ||
    textValue(payload.summary) ||
    textValue(payload.description) ||
    textValue(payload.title) ||
    textValue(payload.name)
  )
}

function isDeslopDraft(draft: DraftListPanelDraft): boolean {
  const payload = draft.payload || {}
  return (
    textValue(payload.skill_id) === 'layer2.deslop' ||
    textValue(payload.source_skill_id) === 'layer2.deslop' ||
    textValue(payload.skillRunId).startsWith('run-deslop') ||
    draft.title.includes('去 AI 味')
  )
}

export function buildDraftQualityLoopModel(draft: DraftListPanelDraft): DraftQualityLoopModel {
  const deslopDone = isDeslopDraft(draft)
  const assetDraft = !['insert_text', 'replace_text', 'create_chapter', 'update_chapter_summary'].includes(draft.kind)

  return {
    title: assetDraft ? '事实库确认链路' : '写入前质量闭环',
    canInspect: Boolean(payloadText(draft)),
    steps: [
      { label: '已进入草稿篮', status: 'done' },
      { label: deslopDone ? '已去 AI 味' : '待风格/一致性检查', status: deslopDone ? 'done' : 'todo' },
      { label: '作者确认后写入', status: draft.status === 'pending' ? 'todo' : 'done' }
    ]
  }
}

export function buildDraftQualityCheckPrompt(draft: DraftListPanelDraft): string {
  const text = payloadText(draft)
  const excerpt = text.length > 5000 ? `${text.slice(0, 5000)}\n\n[已截断，优先检查前 5000 字]` : text
  return [
    `检查草稿篮 #${draft.id}「${draft.title || draft.kind}」的写入前质量。`,
    '请按三项输出：1) AI 味/套话/句式过匀；2) 与现有设定、人物动机、伏笔或引用的冲突风险；3) 是否建议应用。',
    '不要直接写入正文。如果需要改写，请给出可复制的建议文本；作者会再决定是否应用。',
    '',
    '草稿内容：',
    excerpt || '（该草稿没有可检查的文本内容）'
  ].join('\n')
}

// DI-05 — 公文格式模板 12 种（professional 题材包）
//
// 适用 GB/T 9704-2012《党政机关公文格式》。每个模板定义 wrap(content, fields)
// 把作者原文包装为正式公文格式，供 apply_format_template 草稿 kind 应用。
//
// PRD GP-05 已经把 apply_format_template / create_policy_anchor 加入
// ai_drafts.kind 白名单（migration v19）；本文件提供数据层。draft-applier
// 在 DI-05 后续 PR 中接通副作用。

export type ProfessionalTemplateId =
  | 'red-header-notice'
  | 'notice'
  | 'request'
  | 'report'
  | 'reply'
  | 'decision'
  | 'announcement'
  | 'notification'
  | 'letter'
  | 'opinion'
  | 'motion'
  | 'minutes'

export interface ProfessionalTemplateField {
  key: string
  label: string
  required: boolean
  placeholder?: string
}

export interface ProfessionalTemplate {
  id: ProfessionalTemplateId
  label: string
  description: string
  fields: ProfessionalTemplateField[]
  /**
   * 按 fields 把作者原文 (`content`) 包装为完整公文。`fields` 是模板字段
   * key→value 的填充映射，缺失字段使用 placeholder（仅作为预览，正式公文
   * 必须填齐所有 required=true 的字段）。
   */
  wrap: (content: string, fields: Record<string, string>) => string
}

const FIELD_ISSUER: ProfessionalTemplateField = {
  key: 'issuer',
  label: '发文机关',
  required: true,
  placeholder: '××部门',
}
const FIELD_DOC_NUMBER: ProfessionalTemplateField = {
  key: 'docNumber',
  label: '发文字号',
  required: true,
  placeholder: '××〔2026〕1 号',
}
const FIELD_TITLE: ProfessionalTemplateField = {
  key: 'title',
  label: '标题',
  required: true,
  placeholder: '关于 ×× 的 ×× ',
}
const FIELD_RECIPIENT: ProfessionalTemplateField = {
  key: 'recipient',
  label: '主送机关',
  required: true,
  placeholder: '××部门、××部门',
}
const FIELD_SIGNER: ProfessionalTemplateField = {
  key: 'signer',
  label: '署名',
  required: true,
  placeholder: '××部门',
}
const FIELD_DATE: ProfessionalTemplateField = {
  key: 'date',
  label: '成文日期',
  required: true,
  placeholder: '2026 年 4 月 28 日',
}

function value(fields: Record<string, string>, field: ProfessionalTemplateField): string {
  const v = fields[field.key]?.trim()
  if (v && v.length > 0) return v
  return field.placeholder ?? ''
}

function defaultStandardWrap(args: {
  content: string
  fields: Record<string, string>
  documentTypeLabel: string
  withIssuer?: boolean
  withDocNumber?: boolean
  withRecipient?: boolean
  closingPhrase?: string
}): string {
  const lines: string[] = []
  if (args.withIssuer !== false) lines.push(`【红头】${value(args.fields, FIELD_ISSUER)}${args.documentTypeLabel}`)
  if (args.withDocNumber !== false) lines.push(value(args.fields, FIELD_DOC_NUMBER))
  lines.push('')
  lines.push(value(args.fields, FIELD_TITLE))
  lines.push('')
  if (args.withRecipient !== false) {
    lines.push(`${value(args.fields, FIELD_RECIPIENT)}：`)
    lines.push('')
  }
  lines.push(args.content.trim())
  if (args.closingPhrase) {
    lines.push('')
    lines.push(args.closingPhrase)
  }
  lines.push('')
  lines.push(value(args.fields, FIELD_SIGNER))
  lines.push(value(args.fields, FIELD_DATE))
  return lines.join('\n')
}

export const PROFESSIONAL_TEMPLATES: Record<ProfessionalTemplateId, ProfessionalTemplate> = {
  'red-header-notice': {
    id: 'red-header-notice',
    label: '红头通知',
    description: '上级机关向下级机关发布周知性事项；标题含「关于…的通知」。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '文件',
        closingPhrase: '特此通知。',
      }),
  },
  'notice': {
    id: 'notice',
    label: '通知（普通）',
    description: '部门内或单位间发布周知性事项；标题含「关于…的通知」。',
    fields: [FIELD_ISSUER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '通知',
        withDocNumber: false,
        closingPhrase: '特此通知。',
      }),
  },
  'request': {
    id: 'request',
    label: '请示',
    description: '下级机关向上级机关请求指示或批准；一文一事。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '请示',
        closingPhrase: '当否，请批示。',
      }),
  },
  'report': {
    id: 'report',
    label: '报告',
    description: '汇报工作 / 反映情况 / 答复询问，不夹带请示事项。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '报告',
        closingPhrase: '特此报告。',
      }),
  },
  'reply': {
    id: 'reply',
    label: '批复',
    description: '答复下级机关的请示事项；与请示一对一。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '批复',
        closingPhrase: '此复。',
      }),
  },
  'decision': {
    id: 'decision',
    label: '决定',
    description: '对重要事项作出决策和部署；具有约束力。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '决定',
        withRecipient: false,
      }),
  },
  'announcement': {
    id: 'announcement',
    label: '公告',
    description: '向国内外宣布重要事项 / 法定事项。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '公告',
        withRecipient: false,
        closingPhrase: '特此公告。',
      }),
  },
  'notification': {
    id: 'notification',
    label: '通报',
    description: '表彰先进 / 批评错误 / 传达重要精神。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '通报',
        closingPhrase: '特此通报。',
      }),
  },
  'letter': {
    id: 'letter',
    label: '函',
    description: '不相隶属机关之间商洽工作 / 询问 / 答复 / 请求批准。',
    fields: [FIELD_ISSUER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '函',
        withDocNumber: false,
      }),
  },
  'opinion': {
    id: 'opinion',
    label: '意见',
    description: '对重要问题提出见解和处理办法；可指导性 / 决策性 / 协调性。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '意见',
      }),
  },
  'motion': {
    id: 'motion',
    label: '议案',
    description: '各级人民政府按法定程序向同级人民代表大会或其常委会提请审议事项。',
    fields: [FIELD_ISSUER, FIELD_DOC_NUMBER, FIELD_TITLE, FIELD_RECIPIENT, FIELD_SIGNER, FIELD_DATE],
    wrap: (content, fields) =>
      defaultStandardWrap({
        content,
        fields,
        documentTypeLabel: '议案',
        closingPhrase: '请审议。',
      }),
  },
  'minutes': {
    id: 'minutes',
    label: '纪要',
    description: '记载会议主要情况和议定事项。',
    fields: [
      { key: 'meetingTitle', label: '会议名称', required: true, placeholder: '××会议' },
      FIELD_TITLE,
      FIELD_DATE,
      { key: 'attendees', label: '出席人员', required: true, placeholder: '××，××，……' },
    ],
    wrap: (content, fields) => {
      const meetingTitle = fields.meetingTitle?.trim() || '××会议'
      const title = fields.title?.trim() || '××纪要'
      const date = fields.date?.trim() || '2026 年 4 月 28 日'
      const attendees = fields.attendees?.trim() || '××，××'
      return [
        `【纪要】${meetingTitle}纪要`,
        '',
        title,
        '',
        `时间：${date}`,
        `出席：${attendees}`,
        '',
        content.trim(),
        '',
      ].join('\n')
    },
  },
}

export const PROFESSIONAL_TEMPLATE_IDS = Object.keys(PROFESSIONAL_TEMPLATES) as ProfessionalTemplateId[]

export function getProfessionalTemplate(id: string): ProfessionalTemplate | undefined {
  return (PROFESSIONAL_TEMPLATES as Record<string, ProfessionalTemplate>)[id]
}

export function applyProfessionalTemplate(
  templateId: string,
  content: string,
  fields: Record<string, string> = {},
): string {
  const template = getProfessionalTemplate(templateId)
  if (!template) {
    throw new Error(`unknown professional template: ${templateId}`)
  }
  return template.wrap(content, fields)
}

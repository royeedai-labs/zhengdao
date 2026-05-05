export type AssistantInteractionMode = 'creation_planning' | 'direct_writing'

export const DEFAULT_ASSISTANT_INTERACTION_MODE: AssistantInteractionMode = 'creation_planning'

export const ASSISTANT_INTERACTION_MODE_OPTIONS: Array<{
  id: AssistantInteractionMode
  label: string
  description: string
}> = [
  {
    id: 'creation_planning',
    label: '创作策划',
    description: '先拆目标、结构、风险和下一步，不生成可应用草稿。'
  },
  {
    id: 'direct_writing',
    label: '直接写作',
    description: '生成正文或资产草稿，但仍需在草稿篮确认后才写入。'
  }
]

export function isAssistantInteractionMode(value: unknown): value is AssistantInteractionMode {
  return value === 'creation_planning' || value === 'direct_writing'
}


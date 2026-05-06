export type AssistantToolActionId =
  | 'dialogueRewrite'
  | 'worldConsistency'
  | 'directorPanel'
  | 'canonPack'
  | 'visualStudio'
  | 'writingIntel'
  | 'marketScanDeconstruct'
  | 'mcpSettings'
  | 'citationsManager'
  | 'teamManagement'
  | 'aiSettings'

export type AssistantToolActionGroupId = 'draft-control' | 'creation-tools' | 'external-workflow'

export interface AssistantToolAction {
  id: AssistantToolActionId
  label: string
  title: string
  group: AssistantToolActionGroupId
  requiredGenre?: 'script' | 'academic'
}

export interface AssistantToolActionGroup {
  id: AssistantToolActionGroupId
  label: string
  actions: AssistantToolAction[]
}

export const ASSISTANT_TOOL_ACTIONS: AssistantToolAction[] = [
  {
    id: 'dialogueRewrite',
    label: '对白改写',
    title: '对白块改写 (剧本)',
    group: 'draft-control',
    requiredGenre: 'script'
  },
  {
    id: 'worldConsistency',
    label: '一致性检查',
    title: '世界观一致性检查 (Canon Pack)',
    group: 'draft-control'
  },
  {
    id: 'directorPanel',
    label: '自动导演',
    title: 'Pro 自动导演',
    group: 'creation-tools'
  },
  {
    id: 'canonPack',
    label: 'Canon Pack',
    title: 'Canon Pack 视图 (关系图谱 / 时间线 / 组织架构)',
    group: 'creation-tools'
  },
  {
    id: 'visualStudio',
    label: '视觉资产',
    title: '视觉资产',
    group: 'creation-tools'
  },
  {
    id: 'writingIntel',
    label: '写作情报',
    title: '写作情报中心',
    group: 'creation-tools'
  },
  {
    id: 'marketScanDeconstruct',
    label: '拆书工作台',
    title: '拆书工作台（网文拆文）',
    group: 'creation-tools'
  },
  {
    id: 'mcpSettings',
    label: 'MCP 桥接',
    title: 'MCP 只读桥接',
    group: 'external-workflow'
  },
  {
    id: 'citationsManager',
    label: '引文管理',
    title: '学术引文管理 (academic)',
    group: 'external-workflow',
    requiredGenre: 'academic'
  },
  {
    id: 'teamManagement',
    label: '团队空间',
    title: '团队空间 (DI-06)',
    group: 'external-workflow'
  },
  {
    id: 'aiSettings',
    label: 'AI 能力与上下文',
    title: 'AI 能力与上下文',
    group: 'external-workflow'
  }
]

const ASSISTANT_TOOL_GROUP_LABELS: Record<AssistantToolActionGroupId, string> = {
  'draft-control': '写入前检查',
  'creation-tools': '创作工具',
  'external-workflow': '连接与设置'
}

export function getAssistantToolActionGroups(profileGenre: string | null | undefined): AssistantToolActionGroup[] {
  const groupIds: AssistantToolActionGroupId[] = ['draft-control', 'creation-tools', 'external-workflow']
  return groupIds
    .map((id) => ({
      id,
      label: ASSISTANT_TOOL_GROUP_LABELS[id],
      actions: ASSISTANT_TOOL_ACTIONS.filter(
        (action) => action.group === id && (!action.requiredGenre || action.requiredGenre === profileGenre)
      )
    }))
    .filter((group) => group.actions.length > 0)
}

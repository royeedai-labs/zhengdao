export type CreationFlowStep = 1 | 2 | 3 | 4

export type CreationStage =
  | 'empty'
  | 'brief_ready'
  | 'generating'
  | 'preview_ready'
  | 'creating'

export type CreationFlowStepMeta = {
  step: CreationFlowStep
  title: string
  description: string
}

export type CreationFlowState = CreationFlowStepMeta & {
  stage: CreationStage
  status: string
}

export type ResolveCreationFlowStateInput = {
  hasBriefInput: boolean
  generating: boolean
  hasPackageDraft: boolean
  creating: boolean
}

export const CREATION_FLOW_STEPS: CreationFlowStepMeta[] = [
  { step: 1, title: '写灵感', description: '一句话即可' },
  { step: 2, title: '选方向（可选）', description: '不填也能生成' },
  { step: 3, title: '生成方案', description: 'AI 补全规划' },
  { step: 4, title: '确认创建', description: '确认后写入' }
]

export const GENERATION_STAGE_ITEMS = [
  '整理灵感',
  '补全设定',
  '生成章节人物',
  '校验预览'
]

function getStepMeta(step: CreationFlowStep): CreationFlowStepMeta {
  return CREATION_FLOW_STEPS.find((item) => item.step === step) || CREATION_FLOW_STEPS[0]
}

export function resolveCreationFlowState(input: ResolveCreationFlowStateInput): CreationFlowState {
  if (input.creating) {
    return {
      ...getStepMeta(4),
      stage: 'creating',
      status: '第 4/4 步 · 正在创建本地作品'
    }
  }

  if (input.hasPackageDraft) {
    return {
      ...getStepMeta(4),
      stage: 'preview_ready',
      status: '第 4/4 步 · 确认后才创建作品'
    }
  }

  if (input.generating) {
    return {
      ...getStepMeta(3),
      stage: 'generating',
      status: '第 3/4 步 · 正在生成起书方案'
    }
  }

  if (input.hasBriefInput) {
    return {
      ...getStepMeta(2),
      stage: 'brief_ready',
      status: '第 2/4 步 · 可选方向随时补充'
    }
  }

  return {
    ...getStepMeta(1),
    stage: 'empty',
    status: '第 1/4 步 · 先写一句故事灵感'
  }
}

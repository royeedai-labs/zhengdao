export const DESKTOP_PLANNING_REPORT_VERSION = 'desktop-planning.v1'

export const PLANNING_REPORT_SECTIONS = [
  '目标确认',
  '下一步推进',
  '结构风险',
  '可采纳草稿建议',
  '质量检查清单'
] as const

export function buildPlanningReportInstruction(): string {
  return [
    '固定使用以下 Markdown 二级标题：',
    ...PLANNING_REPORT_SECTIONS.map((section) => `## ${section}`),
    '每个标题下都要给出具体、可执行、能回到当前作品资产或章节的建议。',
    '“可采纳草稿建议”只能描述建议转成草稿的内容，不要输出 drafts JSON。'
  ].join('\n')
}

export function buildBookPlanningInput(kind: 'plan' | 'review'): string {
  const goal =
    kind === 'plan'
      ? '基于当前作品状态，帮我规划后续剧情推进。'
      : '请复盘当前作品结构，指出主线、人物和节奏风险。'
  return [
    goal,
    buildPlanningReportInstruction()
  ].join('\n\n')
}

export function buildDraftTransferInput(kind: 'plot_node' | 'foreshadowing'): string {
  if (kind === 'plot_node') {
    return [
      '请把上一份规划报告中最值得落地的一项，转成 create_plot_node 草稿。',
      '只返回符合 create_plot_node 输出契约的 JSON 草稿，不要直接写入作品。'
    ].join('\n')
  }
  return [
    '请把上一份规划报告中最值得追踪的一条线索，转成 create_foreshadowing 草稿。',
    '只返回符合 create_foreshadowing 输出契约的 JSON 草稿，不要直接写入作品。'
  ].join('\n')
}

export function findLatestPlanningReportMessageId(
  messages: Array<{
    id: number
    role: 'user' | 'assistant' | 'system'
    content?: unknown
    metadata?: Record<string, unknown> | null
  }>
): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (
      message.role === 'assistant' &&
      message.metadata?.planning_report_version === DESKTOP_PLANNING_REPORT_VERSION
    ) {
      return message.id
    }
  }
  return null
}

export function shouldLinkPlanningDraftSource(action: {
  key: string
  targetMode?: 'creation_planning' | 'direct_writing'
}): boolean {
  return (
    action.targetMode === 'direct_writing' &&
    (action.key === 'create_plot_node' || action.key === 'create_foreshadowing')
  )
}

export function withPlanningDraftSource<T extends Record<string, unknown>>(
  payload: T,
  sourcePlanMessageId: number | null | undefined
): T & { source_plan_message_id?: number } {
  if (!sourcePlanMessageId) return payload
  return {
    ...payload,
    source_plan_message_id: sourcePlanMessageId
  }
}

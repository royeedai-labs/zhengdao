export const AUTHOR_THOUGHT_START_MARKER = '<<<AUTHOR_THOUGHT_BLOCK>>>'
export const AUTHOR_THOUGHT_END_MARKER = '<<<END_AUTHOR_THOUGHT_BLOCK>>>'

export interface AuthorThoughtBlock {
  style: 'author_inner_monologue'
  title: '作者思路模拟'
  lines: string[]
}

export interface AssistantPresentationMetadata {
  // 展示层元数据：可渲染、可随消息持久化，但不是正文/资产真理源，
  // 也不能绕过草稿篮确认直接写回作品数据。
  authorThought?: AuthorThoughtBlock
  aigc_label?: boolean
  aigc_blocked?: boolean
}

export function buildAuthorThoughtProtocolInstruction(input: {
  strictOutput?: boolean
} = {}): string {
  const outputRule = input.strictOutput
    ? '正文主输出必须严格满足当前输出契约；如果要求只输出 JSON，就先输出 JSON 主体，再单独追加作者思路块。'
    : '先给出正式回答或正文主输出，再单独追加作者思路块。'

  return [
    '你需要额外提供一个“作者思路模拟”块，但绝不要暴露完整推理过程。',
    '作者思路模拟的目标是帮助作者理解取舍，不是解释你自己的推理步骤。',
    '作者思路模拟必须使用第一人称作者内心独白口吻，聚焦人物动机、节奏、信息量、伏笔、情绪或风险。',
    '作者思路模拟必须是 2-4 条短句，禁止输出“我是这样想的”“我推理如下”“下面是我的完整思考过程”这类表述。',
    outputRule,
    '作者思路模拟块必须严格放在主输出之后，使用以下精确格式：',
    AUTHOR_THOUGHT_START_MARKER,
    '{"style":"author_inner_monologue","title":"作者思路模拟","lines":["...","..."]}',
    AUTHOR_THOUGHT_END_MARKER,
    '不要在主输出中提到这些标记，也不要输出额外标题。'
  ].join('\n')
}

export function readAuthorThoughtBlock(value: unknown): AuthorThoughtBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const block = value as { style?: unknown; title?: unknown; lines?: unknown }
  if (block.style !== 'author_inner_monologue' || block.title !== '作者思路模拟') return null
  if (!Array.isArray(block.lines)) return null
  const lines = block.lines
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
  if (lines.length < 2) return null
  return {
    style: 'author_inner_monologue',
    title: '作者思路模拟',
    lines
  }
}

export function stripAssistantPresentationFromPartial(text: string): string {
  const start = text.indexOf(AUTHOR_THOUGHT_START_MARKER)
  if (start < 0) return text
  return text.slice(0, start).replace(/\s+$/, '')
}

export function extractAssistantPresentation(text: string): {
  content: string
  authorThought: AuthorThoughtBlock | null
} {
  const start = text.indexOf(AUTHOR_THOUGHT_START_MARKER)
  if (start < 0) {
    return { content: text, authorThought: null }
  }

  const content = text.slice(0, start).replace(/\s+$/, '')
  const tail = text.slice(start + AUTHOR_THOUGHT_START_MARKER.length)
  const end = tail.indexOf(AUTHOR_THOUGHT_END_MARKER)
  if (end < 0) {
    return { content, authorThought: null }
  }

  const payload = tail.slice(0, end).trim()
  try {
    const parsed = JSON.parse(payload) as unknown
    return { content, authorThought: readAuthorThoughtBlock(parsed) }
  } catch {
    return { content, authorThought: null }
  }
}

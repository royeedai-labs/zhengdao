import { nonEmpty, section } from './helpers'
import type { AiAssistantContext, AiSkillTemplate, AiWorkProfile } from './types'

/**
 * SPLIT-008 — prompt assembly.
 *
 * Both functions take a `userInput` + `context` + `profile` and produce a
 * `{ systemPrompt, userPrompt }` pair ready for the AI provider adapter.
 * No I/O, no SDK references; pure string composition.
 */

export function composeSkillPrompt(input: {
  skill: AiSkillTemplate
  profile?: AiWorkProfile | null
  context: AiAssistantContext
  userInput: string
}): { systemPrompt: string; userPrompt: string } {
  const profile = input.profile
  const systemBlocks = [
    input.skill.system_prompt.trim(),
    section('本作品文风', profile?.style_guide),
    section('题材规则', profile?.genre_rules),
    section('内容边界', profile?.content_boundaries),
    section('资产生成规则', profile?.asset_rules),
    section('章节节奏', profile?.rhythm_rules),
    section('输出契约', input.skill.output_contract)
  ].filter(Boolean)

  const chipLine =
    input.context.chips.length > 0
      ? `已附上下文：${input.context.chips.filter((chip) => chip.enabled).map((chip) => chip.label).join('、')}`
      : ''
  const templated = input.skill.user_prompt_template.replace(
    /\{\{\s*input\s*\}\}/g,
    input.userInput.trim()
  )
  const userBlocks = [
    templated,
    chipLine,
    input.context.contextText ? `## 上下文\n${input.context.contextText}` : ''
  ]
  if (input.skill.output_contract !== 'plain_text') {
    userBlocks.unshift('请严格只返回一个可解析的 JSON 对象，不要附加解释、标题或 Markdown。')
  }

  return {
    systemPrompt: systemBlocks.join('\n\n'),
    userPrompt: userBlocks.filter(Boolean).join('\n\n')
  }
}

export function composeAssistantChatPrompt(input: {
  profile?: AiWorkProfile | null
  context: AiAssistantContext
  skills?: Array<Pick<AiSkillTemplate, 'name' | 'description'>>
  userInput: string
}): { systemPrompt: string; userPrompt: string } {
  const profile = input.profile
  const skillList = (input.skills || [])
    .filter((skill) => nonEmpty(skill.name))
    .map(
      (skill) =>
        `- ${skill.name}${nonEmpty(skill.description) ? `：${skill.description.trim()}` : ''}`
    )
    .join('\n')
  const systemBlocks = [
    [
      '你是证道的 AI 创作助手，当前处于普通对话和自动识别模式。',
      '你需要根据用户自然语言自行判断意图，直接回答写作问题、解释配置、给出建议或分析当前上下文。',
      '默认不要直接写入作品，不要声称已经创建章节、正文或小说资产。',
      '如果用户要求生成正文、章节、角色、设定、伏笔或剧情节点，应给出可预览内容，并提醒正式写入仍需草稿篮确认。'
    ].join('\n'),
    section('本作品文风', profile?.style_guide),
    section('题材规则', profile?.genre_rules),
    section('内容边界', profile?.content_boundaries),
    section('可用能力卡', skillList)
  ].filter(Boolean)

  const chipLine =
    input.context.chips.length > 0
      ? `已附上下文：${input.context.chips.filter((chip) => chip.enabled).map((chip) => chip.label).join('、')}`
      : ''
  const userBlocks = [
    input.userInput.trim(),
    chipLine,
    input.context.contextText ? `## 上下文\n${input.context.contextText}` : ''
  ]

  return {
    systemPrompt: systemBlocks.join('\n\n'),
    userPrompt: userBlocks.filter(Boolean).join('\n\n')
  }
}

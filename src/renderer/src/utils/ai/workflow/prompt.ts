import { nonEmpty, section } from './helpers'
import type { AiAssistantContext, AiSkillTemplate, AiWorkProfile } from './types'
import type { StoryBibleSnapshot } from '../../../../../shared/story-bible'
import { buildAuthorThoughtProtocolInstruction } from '../../../../../shared/assistant-presentation'
import { narrativeQualityPromptRules } from './quality-filter'

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
  storyBible?: StoryBibleSnapshot | null
  presentationMode?: 'default' | 'author_thought_dual_channel'
}): { systemPrompt: string; userPrompt: string } {
  const profile = input.profile
  const needsStructuredMainOutput = input.skill.output_contract !== 'plain_text'
  const systemBlocks = [
    input.skill.system_prompt.trim(),
    section('本作品文风', profile?.style_guide),
    section('作者风格指纹', formatStyleFingerprintForPrompt(profile?.style_fingerprint)),
    section('题材规则', profile?.genre_rules),
    section('内容边界', profile?.content_boundaries),
    section('资产生成规则', profile?.asset_rules),
    section('章节节奏', profile?.rhythm_rules),
    section('全局故事圣经', formatStoryBibleForPrompt(input.storyBible)),
    section('生成质量约束', narrativeQualityPromptRules()),
    section('输出契约', input.skill.output_contract),
    input.presentationMode === 'author_thought_dual_channel'
      ? section(
          '双通道展示协议',
          buildAuthorThoughtProtocolInstruction({ strictOutput: needsStructuredMainOutput })
        )
      : ''
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
  if (needsStructuredMainOutput) {
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
  storyBible?: StoryBibleSnapshot | null
  assistantMode?: 'creation_planning' | 'direct_writing'
  presentationMode?: 'default' | 'author_thought_dual_channel'
}): { systemPrompt: string; userPrompt: string } {
  const profile = input.profile
  const assistantMode = input.assistantMode || 'direct_writing'
  const skillList = (input.skills || [])
    .filter((skill) => nonEmpty(skill.name))
    .map(
      (skill) =>
        `- ${skill.name}${nonEmpty(skill.description) ? `：${skill.description.trim()}` : ''}`
    )
    .join('\n')
  const systemBlocks = [
    assistantMode === 'creation_planning'
      ? [
          '你是证道的 AI 创作助手，当前处于创作策划模式。',
          '本轮只做创作策划：拆目标、读者预期、结构、节奏、素材缺口、风险和下一步确认点。',
          '不要输出可直接应用的正文、章节 JSON、角色/设定/伏笔资产 JSON，也不要声称已经创建草稿、章节或小说资产。',
          '如果用户要求“直接写”，先给出写作方案、取舍理由和建议确认点，提醒可切换到“直接写作”生成草稿。'
        ].join('\n')
      : [
          '你是证道的 AI 创作助手，当前处于直接写作模式，兼容普通对话和自动识别模式。',
          '你需要根据用户自然语言自行判断意图，直接回答写作问题、解释配置、给出建议或分析当前上下文。',
          '默认不要直接写入作品，不要声称已经创建章节、正文或小说资产。',
          '如果用户要求生成正文、章节、角色、设定、伏笔或剧情节点，应给出可预览内容，并提醒正式写入仍需草稿篮确认。'
        ].join('\n'),
    section('本作品文风', profile?.style_guide),
    section('作者风格指纹', formatStyleFingerprintForPrompt(profile?.style_fingerprint)),
    section('题材规则', profile?.genre_rules),
    section('内容边界', profile?.content_boundaries),
    section('全局故事圣经', formatStoryBibleForPrompt(input.storyBible)),
    section('生成质量约束', narrativeQualityPromptRules()),
    input.presentationMode === 'author_thought_dual_channel'
      ? section('双通道展示协议', buildAuthorThoughtProtocolInstruction())
      : '',
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

export function formatStyleFingerprintForPrompt(value?: string | null): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const compact = {
      syntax: parsed.syntax,
      diction: parsed.diction,
      voice: parsed.voice,
      rhythm: parsed.rhythm,
      dialogue: parsed.dialogue,
      avoid: parsed.avoid,
      preserve: parsed.preserve,
      fingerprint: parsed.fingerprint
    }
    return [
      JSON.stringify(compact, null, 2),
      '使用规则：保留作者句法、偏好词、语体和人物口吻；不要把生成或去 AI 味结果改成统一腔调。'
    ].join('\n')
  } catch {
    return [
      raw.slice(0, 1600),
      '使用规则：保留作者句法、偏好词、语体和人物口吻；不要把生成或去 AI 味结果改成统一腔调。'
    ].join('\n')
  }
}

export function formatStoryBibleForPrompt(storyBible?: StoryBibleSnapshot | null): string {
  if (!storyBible) return ''
  const compact = {
    characters: storyBible.characters.slice(0, 30).map((character) => ({
      name: character.name,
      status: character.status,
      motivation: character.motivation,
      secret: character.secret,
      description: character.description
    })),
    timeline: storyBible.timeline.slice(0, 30),
    coreSettings: storyBible.settings.slice(0, 30).map((item) => ({
      title: item.title,
      content: item.content
    })),
    foreshadowings: storyBible.foreshadowings.slice(0, 30),
    plotNodes: storyBible.plotNodes.slice(0, 40),
    pendingFacts: storyBible.pendingFacts.slice(0, 20)
  }
  return [
    '以下是已确认资产与待确认事实层汇总。生成时必须保持关键姓名、数字、时间跨度、死亡/失踪/存活状态、死者身份、设定规则一致；如信息不足，只能写“不足以判断”，不得补造事实。',
    JSON.stringify(compact, null, 2)
  ].join('\n')
}

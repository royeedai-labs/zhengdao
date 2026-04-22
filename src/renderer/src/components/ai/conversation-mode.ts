import {
  resolveSkillForBook,
  type AiSkillOverride,
  type AiSkillTemplate
} from '../../utils/ai/assistant-workflow'

export function resolveAssistantSkillSelection(
  skills: AiSkillTemplate[],
  overrides: AiSkillOverride[],
  skillKey: string | null | undefined
): AiSkillTemplate | null {
  if (!skillKey) return null
  const base = skills.find((skill) => skill.key === skillKey)
  if (!base) return null
  const override = overrides.find((item) => item.skill_key === base.key) || null
  return resolveSkillForBook(base, override)
}

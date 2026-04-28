import {
  resolveSkillForBook,
  type AiSkillOverride,
  type AiSkillTemplate
} from '../../utils/ai/assistant-workflow'

export type AssistantIntent = {
  mode: 'chat' | 'skill'
  skillKey: string | null
  confidence: number
  reason: string
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function hasSkill(skills: AiSkillTemplate[], key: string): boolean {
  return skills.some((skill) => skill.key === key)
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern))
}

function skillIntent(skillKey: string, confidence: number, reason: string): AssistantIntent {
  return { mode: 'skill', skillKey, confidence, reason }
}

export function resolveAssistantIntent(input: {
  skills: AiSkillTemplate[]
  userInput?: string | null
  selectedText?: string | null
  hasCurrentChapter?: boolean
  hasVolumes?: boolean
}): AssistantIntent {
  const text = normalizeText(input.userInput)
  const hasSelection = Boolean(input.selectedText?.trim())
  const hasCurrentChapter = input.hasCurrentChapter !== false

  const wantsRewrite = includesAny(text, [
    '润色',
    '改写',
    '重写',
    '优化',
    '更顺',
    '通顺',
    '精炼',
    '扩写',
    '删减',
    '更有画面',
    'show not tell',
    'rewrite',
    'polish'
  ])
  if (hasSelection && wantsRewrite && hasSkill(input.skills, 'polish_text')) {
    return skillIntent('polish_text', 0.92, '检测到选区和润色/改写意图')
  }

  const wantsChapterDraft = includesAny(text, [
    '新章节',
    '新建章节',
    '创建章节',
    '生成章节',
    '章节草稿',
    '新建一章',
    '创建一章',
    '生成一章',
    '新建第',
    '创建第',
    '生成第',
    '写第',
    '写一章',
    '写下一章',
    '下一章草稿',
    '章节卷',
    'chapter'
  ])
  if (wantsChapterDraft && hasSkill(input.skills, 'create_chapter')) {
    return skillIntent('create_chapter', 0.9, '检测到章节生成意图')
  }

  const wantsReview = includesAny(text, [
    '审核',
    '审稿',
    '检查本章',
    '检查这一章',
    '毒点',
    '节奏问题',
    '一致性',
    'review'
  ])
  if (hasCurrentChapter && wantsReview && hasSkill(input.skills, 'review_chapter')) {
    return skillIntent('review_chapter', 0.88, '检测到本章审核意图')
  }

  const wantsContinue = includesAny(text, [
    '续写',
    '继续写',
    '接着写',
    '往下写',
    '下一段',
    '延续',
    'continue'
  ])
  if (hasCurrentChapter && wantsContinue && hasSkill(input.skills, 'continue_writing')) {
    return skillIntent('continue_writing', 0.88, '检测到续写意图')
  }

  const wantsCharacter =
    includesAny(text, ['角色', '人物', '人物卡', '主角', '反派', '配角', 'character']) &&
    includesAny(text, ['生成', '创建', '设计', '补一个', '来一个', '写一个', '做一个', 'create'])
  if (wantsCharacter && hasSkill(input.skills, 'create_character')) {
    return skillIntent('create_character', 0.86, '检测到角色生成意图')
  }

  const wantsWiki =
    includesAny(text, ['设定', '世界观', '势力', '功法', '法宝', '道具', '规则', '地图', 'wiki']) &&
    includesAny(text, ['生成', '创建', '设计', '整理', '补一个', '写一个', 'create'])
  if (wantsWiki && hasSkill(input.skills, 'create_wiki_entry')) {
    return skillIntent('create_wiki_entry', 0.84, '检测到设定生成意图')
  }

  const wantsForeshadow =
    includesAny(text, ['伏笔', '埋线', '线索', '回收', '填坑', 'foreshadow']) &&
    includesAny(text, ['整理', '生成', '创建', '提取', '记录', 'create'])
  if (wantsForeshadow && hasSkill(input.skills, 'create_foreshadowing')) {
    return skillIntent('create_foreshadowing', 0.84, '检测到伏笔整理意图')
  }

  const wantsPlot =
    includesAny(text, ['剧情节点', '剧情', '情节', '大纲', '爽点', '节奏', 'plot']) &&
    includesAny(text, ['建议', '生成', '创建', '设计', '梳理', '安排', 'create'])
  if (wantsPlot && hasSkill(input.skills, 'create_plot_node')) {
    return skillIntent('create_plot_node', 0.82, '检测到剧情节点意图')
  }

  return { mode: 'chat', skillKey: null, confidence: 0.35, reason: '未检测到高置信写作能力，保持普通对话' }
}

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

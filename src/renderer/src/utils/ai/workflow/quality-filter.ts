export interface NarrativeQualityIssue {
  patternId: string
  quote: string
  suggestion: string
}

const FORBIDDEN_ACTIONS = [
  '沉默了几秒',
  '沉默了片刻',
  '脸色一变',
  '脸色骤变',
  '深吸一口气',
  '瞳孔一缩',
  '空气仿佛凝固',
  '不该发现的东西'
]

const SUBJECT_OPENING = /^(他|她|我|你|林|陈|张|王|李|苏|沈|顾|周|赵|许|陆|江|叶|顾|主角|少年|男人|女人)[^，。！？]{0,12}[，。！？]/

export function narrativeQualityPromptRules(): string {
  return [
    '线索获取不得机械降神：主角不能直接拿到完整答案，必须先遇到物理/心理/社会或信息障碍。',
    '关键线索必须拆成多个不完整碎片，分散在不同场景、物件或人物话语中，由主角主动推导。',
    '避免套路动作词：不要使用“沉默了几秒/片刻、脸色一变、深吸一口气、瞳孔一缩、空气仿佛凝固”。',
    '需要表现沉默或惊讶时，用具体微动作、视线偏移、手部动作、物品交互或场景反应替代。',
    '段落起手必须有变化，避免连续以人名、他/她/我等代词开头；可用动作、景物、声音、气味或倒装起手。'
  ].join('\n')
}

export function scanNarrativeQuality(text: string): NarrativeQualityIssue[] {
  const issues: NarrativeQualityIssue[] = []
  for (const pattern of FORBIDDEN_ACTIONS) {
    if (text.includes(pattern)) {
      issues.push({
        patternId: `forbidden-action.${pattern}`,
        quote: pattern,
        suggestion: '改用具体微动作、物品交互或环境反应。'
      })
    }
  }

  const paragraphs = text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  let run = 0
  for (const paragraph of paragraphs) {
    if (SUBJECT_OPENING.test(paragraph)) {
      run += 1
      if (run >= 4) {
        issues.push({
          patternId: 'paragraph.subject-opening-run',
          quote: paragraph.slice(0, 40),
          suggestion: '连续段落起手重复，改用景物、声音、动作或倒装句起手。'
        })
        break
      }
    } else {
      run = 0
    }
  }

  return issues
}

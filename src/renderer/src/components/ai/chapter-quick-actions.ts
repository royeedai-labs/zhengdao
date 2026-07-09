import type { Chapter, Volume } from '@/types'

export const START_FIRST_CHAPTER_INPUT =
  '基于当前作品设定、本章摘要、人物和剧情节点，起草第一章正文。只返回可采纳的正文草稿，不要直接写入正文。'

const START_CURRENT_CHAPTER_INPUT =
  '基于当前作品设定、本章摘要、人物和剧情节点，起草本章正文。只返回可采纳的正文草稿，不要直接写入正文。'

// CG-A1 v1 — 去 AI 味 quick action 输入文案（按选段 / 全章两档）。
// 后端 layer2.deslop Skill 实际接收的是 text + genre + mode；这里只是
// 前端 quick action 的占位文本，dispatch 时由 useAiAssistantRequest
// 根据 hasSelection 决定附带选段还是整章正文。
export const REMOVE_AI_TONE_SELECTION_INPUT =
  '使用 layer2.deslop Skill 对当前选区做"去 AI 味"扫描，按 5 题材独立 prompt + 8 步流程产出 issues + rewritten。改写后的草稿进草稿篮等待我确认。'

export const REMOVE_AI_TONE_CHAPTER_INPUT =
  '使用 layer2.deslop Skill 对当前章节正文做"去 AI 味"扫描；保护数字 / 命令 / 引用 / BibTeX / 公式不动；输出 issues + rewritten + secondPassAudit。改写后的草稿进草稿篮等待我确认。'

export const PRO_QUALITY_REVIEW_INPUT =
  '使用 layer2.chapter-review-pro 做 Pro 质量复盘：结构风险、爽点/毒点、人物一致性、伏笔回收和可执行修改建议。不可直接改正文。'

export function isRemoveAiToneQuickActionInput(value: string | null | undefined): boolean {
  const text = String(value || '').trim()
  return text === REMOVE_AI_TONE_SELECTION_INPUT || text === REMOVE_AI_TONE_CHAPTER_INPUT
}

export function isProQualityReviewQuickActionInput(value: string | null | undefined): boolean {
  return String(value || '').trim() === PRO_QUALITY_REVIEW_INPUT
}

export function buildRemoveAiToneSendOptions(): {
  assistantMode: 'direct_writing'
  sourcePlanMessageId: null
} {
  return {
    assistantMode: 'direct_writing',
    sourcePlanMessageId: null
  }
}

export function canRunRemoveAiTone(input: {
  currentChapter: { content?: string | null } | null
  hasSelection: boolean
}): boolean {
  if (!input.currentChapter) return false
  return input.hasSelection || !isBlankChapterContent(input.currentChapter.content)
}

export type ChapterQuickAction = {
  key: string
  label: string
  description: string
  disabled?: boolean
  input?: string
  targetMode?: 'creation_planning' | 'direct_writing'
}

export function isBlankChapterContent(content: string | null | undefined): boolean {
  return String(content || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .trim().length === 0
}

function getChapterNumber(volumes: Volume[], chapterId: number | null | undefined): number {
  if (chapterId == null) return 0
  let number = 0
  for (const volume of volumes) {
    for (const chapter of volume.chapters || []) {
      number += 1
      if (chapter.id === chapterId) return number
    }
  }
  return 0
}

function isFirstChapter(chapter: Chapter, volumes: Volume[]): boolean {
  return getChapterNumber(volumes, chapter.id) === 1 || chapter.title.includes('第一章')
}

export function buildChapterEditorQuickActions(input: {
  currentChapter: Chapter | null
  volumes: Volume[]
  hasSelection: boolean
}): ChapterQuickAction[] {
  const blankChapter = input.currentChapter ? isBlankChapterContent(input.currentChapter.content) : false
  const firstChapter = input.currentChapter ? isFirstChapter(input.currentChapter, input.volumes) : false
  const removeAiToneAvailable = canRunRemoveAiTone(input)

  return [
    {
      key: 'continue_writing',
      label: blankChapter ? (firstChapter ? '开始写第一章' : '开始写本章') : '续写当前章',
      description: blankChapter
        ? '基于作品设定、本章摘要和现有资产生成正文草稿。'
        : '从当前章节末尾或光标位置继续推进正文。',
      disabled: !input.currentChapter,
      input: blankChapter ? (firstChapter ? START_FIRST_CHAPTER_INPUT : START_CURRENT_CHAPTER_INPUT) : undefined
    },
    {
      key: 'polish_text',
      label: '润色选区',
      description: '改写当前选中文本，保留原意和人物口吻。',
      disabled: !input.hasSelection
    },
    {
      key: 'review_chapter',
      label: '审核本章',
      description: '检查节奏、毒点、伏笔和人物一致性。',
      disabled: !input.currentChapter || blankChapter
    },
    {
      key: 'pro_quality_review',
      label: 'Pro 质量复盘',
      description: '调用 layer2.chapter-review-pro；不可用时回退本地审稿。',
      disabled: !input.currentChapter || blankChapter,
      input: PRO_QUALITY_REVIEW_INPUT,
      targetMode: 'direct_writing'
    },
    {
      // CG-A1 — 去 AI 味（5 题材独立 prompt）。
      // 优先在选区上跑（更精确，cost 更低）；没选区时退回整章。
      // 没有可用选区且无章节时禁用。
      key: 'remove_ai_tone',
      label: input.hasSelection ? '去 AI 味（选区）' : '去 AI 味（本章）',
      description:
        '扫描并修复 AI 写作痕迹：5 题材独立 prompt + 保护数字 / 命令 / 引用 / 公式不动 + 二次回读。',
      disabled: !removeAiToneAvailable,
      input: input.hasSelection ? REMOVE_AI_TONE_SELECTION_INPUT : REMOVE_AI_TONE_CHAPTER_INPUT,
      targetMode: 'direct_writing'
    }
  ]
}

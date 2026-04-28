import type { Chapter, Volume } from '@/types'

export const START_FIRST_CHAPTER_INPUT =
  '基于当前作品设定、本章摘要、人物和剧情节点，起草第一章正文。只返回可采纳的正文草稿，不要直接写入正文。'

const START_CURRENT_CHAPTER_INPUT =
  '基于当前作品设定、本章摘要、人物和剧情节点，起草本章正文。只返回可采纳的正文草稿，不要直接写入正文。'

export type ChapterQuickAction = {
  key: string
  label: string
  description: string
  disabled?: boolean
  input?: string
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
      disabled: !input.currentChapter
    }
  ]
}

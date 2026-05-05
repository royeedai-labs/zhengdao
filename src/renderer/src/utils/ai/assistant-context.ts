import type { ModalType } from '@/types'
import type { AssistantSurface, ResolvedAssistantContext } from '../../../../shared/ai-book-creation'

export type ResolveAssistantContextInput = {
  currentBookId: number | null
  currentChapterTitle?: string | null
  hasSelection?: boolean
  activeModal?: ModalType
  requestedSurface?: AssistantSurface | null
}

const CREATION_PLANNING_TITLE = '创作策划'
const CREATION_PLANNING_SUBTITLE = '先确定选题、读者、结构、风格、素材和章节安排，再开始写作。'

function surfaceFromModal(modal: ModalType): AssistantSurface | null {
  switch (modal) {
    case 'bookOverview':
      return 'book_overview'
    case 'character':
    case 'fullCharacters':
    case 'characterCompare':
      return 'characters'
    case 'settings':
      return 'wiki'
    case 'foreshadow':
    case 'foreshadowBoard':
      return 'foreshadow'
    case 'stats':
      return 'stats'
    case 'projectSettings':
    case 'aiSettings':
    case 'appSettings':
      return 'settings'
    default:
      return null
  }
}

export function resolveAssistantContext(input: ResolveAssistantContextInput): ResolvedAssistantContext {
  const requested = input.requestedSurface
  const surface =
    requested ||
    surfaceFromModal(input.activeModal ?? null) ||
    (input.currentBookId == null ? 'bookshelf' : 'chapter_editor')

  switch (surface) {
    case 'bookshelf':
      return {
        surface,
        title: CREATION_PLANNING_TITLE,
        description: CREATION_PLANNING_SUBTITLE,
        quickActions: [
          {
            key: 'start_creation',
            label: '我只有一个灵感',
            input: '我想写一部新小说，只有一个大概灵感，请先帮我整理成可生成起书方案的方向。'
          },
          {
            key: 'summarize_brief',
            label: '帮我整理方向',
            input: '请整理当前已确认的起书方向，未填写的部分交给 AI 后续补全。'
          },
          {
            key: 'offer_options',
            label: '给我候选方案',
            input: '我有些创作方向不确定，请给我几个可选方向，但不要替我写死。'
          }
        ]
      }
    case 'book_overview':
      return {
        surface,
        title: 'AI 创作助手 · 作品总览',
        description: '适合做全书规划、阶段复盘、结构检查和下一步计划。',
        quickActions: [
          { key: 'book_plan', label: '规划后续剧情', input: '基于当前作品状态，帮我规划后续剧情推进。' },
          { key: 'book_review', label: '复盘全书结构', input: '请复盘当前作品结构，指出主线、人物和节奏风险。' }
        ]
      }
    case 'characters':
      return {
        surface,
        title: 'AI 创作助手 · 人物',
        description: '适合补角色、梳理人物关系、检查人物弧光。',
        quickActions: [
          { key: 'character_design', label: '设计角色', input: '请根据当前作品设定，帮我设计一个新角色草案。' },
          { key: 'character_relation', label: '梳理关系', input: '请梳理主要人物关系和冲突张力。' }
        ]
      }
    case 'wiki':
      return {
        surface,
        title: 'AI 创作助手 · 设定',
        description: '适合整理世界观、规则、势力、道具和一致性风险。',
        quickActions: [
          { key: 'wiki_entry', label: '生成设定', input: '请为当前作品生成一个设定条目草稿。' },
          { key: 'wiki_check', label: '检查设定冲突', input: '请检查当前设定中可能存在的冲突和缺口。' }
        ]
      }
    case 'foreshadow':
      return {
        surface,
        title: 'AI 创作助手 · 伏笔',
        description: '适合整理埋线、回收计划和悬念节奏。',
        quickActions: [
          { key: 'foreshadow_create', label: '整理伏笔', input: '请从当前想法中整理值得追踪的伏笔。' },
          { key: 'foreshadow_payoff', label: '设计回收', input: '请帮我设计伏笔回收方式和预计章节位置。' }
        ]
      }
    case 'stats':
      return {
        surface,
        title: 'AI 创作助手 · 数据',
        description: '适合分析写作节奏、日更计划和阶段目标。',
        quickActions: [
          { key: 'schedule', label: '制定更新计划', input: '请根据我的目标字数和当前进度，制定接下来的写作计划。' }
        ]
      }
    case 'settings':
      return {
        surface,
        title: 'AI 创作助手 · 配置',
        description: '适合解释作品上下文档案、能力卡和上下文策略。',
        quickActions: [
          { key: 'profile_help', label: '完善上下文', input: '请帮我完善当前作品的上下文档案和上下文策略。' }
        ]
      }
    case 'chapter_editor':
    default:
      return {
        surface: 'chapter_editor',
        title: 'AI 创作助手',
        description: input.currentChapterTitle
          ? `当前章节：${input.currentChapterTitle}`
          : '适合续写、润色、审稿和生成章节草稿。',
        quickActions: [
          {
            key: 'continue_writing',
            label: '续写当前章',
            input: '续写当前章节，保持人物口吻和叙事节奏。',
            disabled: !input.currentChapterTitle
          },
          {
            key: 'polish_text',
            label: '润色选区',
            input: '润色选中文本，保留原意和人物口吻。',
            disabled: !input.hasSelection
          },
          {
            key: 'review_chapter',
            label: '审核本章',
            input: '审核当前章节的节奏、人物一致性、伏笔和毒点风险。',
            disabled: !input.currentChapterTitle
          }
        ]
      }
  }
}

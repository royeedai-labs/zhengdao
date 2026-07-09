import { describe, expect, it } from 'vitest'
import { resolveAssistantContext } from '../assistant-context'

describe('assistant context resolver', () => {
  it('uses bookshelf mode when no book is open', () => {
    const context = resolveAssistantContext({ currentBookId: null })

    expect(context.surface).toBe('bookshelf')
    expect(context.title).toBe('AI 起书')
    expect(context.quickActions.map((action) => action.key)).toContain('start_creation')
  })

  it('switches quick actions for chapter selection and asset modals', () => {
    const chapter = resolveAssistantContext({
      currentBookId: 1,
      currentChapterTitle: '第一章',
      hasSelection: true
    })
    const characters = resolveAssistantContext({
      currentBookId: 1,
      activeModal: 'fullCharacters'
    })
    const wiki = resolveAssistantContext({
      currentBookId: 1,
      activeModal: 'settings'
    })

    expect(chapter.surface).toBe('chapter_editor')
    expect(chapter.quickActions.map((action) => action.key)).toEqual([
      'continue_writing',
      'polish_text',
      'review_chapter'
    ])
    expect(characters.surface).toBe('characters')
    expect(characters.quickActions.map((action) => action.key)).toContain('character_design')
    expect(wiki.surface).toBe('wiki')
    expect(wiki.quickActions.map((action) => action.key)).toContain('wiki_entry')
  })

  it('uses explicit planning and draft-transfer actions on the book overview surface', () => {
    const context = resolveAssistantContext({
      currentBookId: 1,
      activeModal: 'bookOverview'
    })

    expect(context.surface).toBe('book_overview')
    expect(context.quickActions).toEqual([
      expect.objectContaining({
        key: 'book_plan',
        label: '规划后续剧情',
        targetMode: 'creation_planning',
        input: expect.stringContaining('固定使用以下 Markdown 二级标题')
      }),
      expect.objectContaining({
        key: 'book_review',
        label: '复盘全书结构',
        targetMode: 'creation_planning',
        input: expect.stringContaining('## 质量检查清单')
      }),
      expect.objectContaining({
        key: 'create_plot_node',
        label: '转剧情节点草稿',
        targetMode: 'direct_writing',
        input: expect.stringContaining('create_plot_node')
      }),
      expect.objectContaining({
        key: 'create_foreshadowing',
        label: '转伏笔草稿',
        targetMode: 'direct_writing',
        input: expect.stringContaining('create_foreshadowing')
      })
    ])
  })
})

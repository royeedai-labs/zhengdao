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
})

import { describe, expect, it } from 'vitest'
import { buildAiAssistantSelectionSnapshot } from '../ai-selection'

describe('buildAiAssistantSelectionSnapshot', () => {
  it('returns a safe empty snapshot when the editor is not initialized yet', () => {
    expect(buildAiAssistantSelectionSnapshot({ currentChapterId: 12, editor: null })).toEqual({
      text: '',
      chapterId: 12,
      from: null,
      to: null
    })
  })

  it('captures the selected text and range from the active editor', () => {
    expect(
      buildAiAssistantSelectionSnapshot({
        currentChapterId: 12,
        editor: {
          state: {
            selection: {
              from: 8,
              to: 18,
              empty: false
            },
            doc: {
              textBetween: (from: number, to: number) => `selected:${from}-${to}`
            }
          }
        }
      })
    ).toEqual({
      text: 'selected:8-18',
      chapterId: 12,
      from: 8,
      to: 18
    })
  })
})

import { describe, expect, it } from 'vitest'
import { START_FIRST_CHAPTER_INPUT } from '../chapter-quick-actions'
import { resolveAssistantRequestMaxTokens } from '../useAiAssistantRequest'

describe('resolveAssistantRequestMaxTokens', () => {
  it('keeps ordinary chat and continuation requests on the default budget', () => {
    expect(resolveAssistantRequestMaxTokens({ skillKey: null, userInput: '聊聊人物动机' })).toBe(1400)
    expect(resolveAssistantRequestMaxTokens({ skillKey: 'continue_writing', userInput: '接着写下一段' })).toBe(1400)
  })

  it('uses a larger budget for full chapter drafting', () => {
    expect(resolveAssistantRequestMaxTokens({ skillKey: 'create_chapter', userInput: '生成下一章草稿' })).toBe(4200)
    expect(resolveAssistantRequestMaxTokens({ skillKey: 'continue_writing', userInput: START_FIRST_CHAPTER_INPUT })).toBe(4200)
  })
})

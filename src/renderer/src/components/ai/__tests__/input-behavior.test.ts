import { describe, expect, it } from 'vitest'
import { shouldSubmitAiAssistantInput } from '../input-behavior'

describe('shouldSubmitAiAssistantInput', () => {
  it('submits on plain Enter', () => {
    expect(
      shouldSubmitAiAssistantInput({
        key: 'Enter',
        shiftKey: false,
        nativeEvent: { isComposing: false }
      })
    ).toBe(true)
  })

  it('keeps Shift+Enter for newline', () => {
    expect(
      shouldSubmitAiAssistantInput({
        key: 'Enter',
        shiftKey: true,
        nativeEvent: { isComposing: false }
      })
    ).toBe(false)
  })

  it('does not submit while IME composition is active', () => {
    expect(
      shouldSubmitAiAssistantInput({
        key: 'Enter',
        shiftKey: false,
        nativeEvent: { isComposing: true }
      })
    ).toBe(false)
  })
})

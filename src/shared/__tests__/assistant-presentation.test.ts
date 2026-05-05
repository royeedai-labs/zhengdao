import { describe, expect, it } from 'vitest'
import {
  AUTHOR_THOUGHT_END_MARKER,
  AUTHOR_THOUGHT_START_MARKER,
  buildAuthorThoughtProtocolInstruction,
  extractAssistantPresentation,
  readAuthorThoughtBlock,
  stripAssistantPresentationFromPartial
} from '../assistant-presentation'

describe('assistant presentation helpers', () => {
  it('builds the dual-channel instruction with fixed markers', () => {
    const instruction = buildAuthorThoughtProtocolInstruction({ strictOutput: true })
    expect(instruction).toContain(AUTHOR_THOUGHT_START_MARKER)
    expect(instruction).toContain(AUTHOR_THOUGHT_END_MARKER)
    expect(instruction).toContain('如果要求只输出 JSON，就先输出 JSON 主体')
  })

  it('extracts author thought metadata from the trailing block', () => {
    const text = [
      '正式回答正文',
      AUTHOR_THOUGHT_START_MARKER,
      '{"style":"author_inner_monologue","title":"作者思路模拟","lines":["我这里要先把人物动机钉死。","我不能让这一段只剩解释，还得保留推进感。"]}',
      AUTHOR_THOUGHT_END_MARKER
    ].join('\n')

    expect(extractAssistantPresentation(text)).toEqual({
      content: '正式回答正文',
      authorThought: {
        style: 'author_inner_monologue',
        title: '作者思路模拟',
        lines: ['我这里要先把人物动机钉死。', '我不能让这一段只剩解释，还得保留推进感。']
      }
    })
  })

  it('strips a partial trailing presentation block while streaming', () => {
    const text = `正式回答正文\n${AUTHOR_THOUGHT_START_MARKER}\n{"style":"author_inner_monologue"`
    expect(stripAssistantPresentationFromPartial(text)).toBe('正式回答正文')
  })

  it('rejects malformed metadata blocks', () => {
    expect(readAuthorThoughtBlock({ style: 'other', title: '作者思路模拟', lines: ['a', 'b'] })).toBeNull()
    expect(
      extractAssistantPresentation(
        `正文\n${AUTHOR_THOUGHT_START_MARKER}\n{"style":"author_inner_monologue","title":"作者思路模拟","lines":["只有一句"]}\n${AUTHOR_THOUGHT_END_MARKER}`
      )
    ).toEqual({
      content: '正文',
      authorThought: null
    })
  })
})

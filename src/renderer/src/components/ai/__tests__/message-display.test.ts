import { describe, expect, it } from 'vitest'
import { buildAssistantMessageDisplay } from '../message-display'

describe('assistant message display', () => {
  it('renders structured draft JSON as readable draft summaries', () => {
    const display = buildAssistantMessageDisplay({
      role: 'assistant',
      content: JSON.stringify({
        drafts: [
          {
            kind: 'create_character',
            name: '赵烈',
            faction: 'hostile',
            status: 'active',
            description: '狂飙公会突击队长。'
          }
        ]
      })
    })

    expect(display).toEqual({
      kind: 'drafts',
      intro: '已生成 1 个草稿，已放入草稿篮。',
      drafts: [
        {
          title: '赵烈',
          summary: '狂飙公会突击队长。',
          fields: [
            { label: '阵营', value: 'hostile' },
            { label: '状态', value: 'active' }
          ]
        }
      ]
    })
  })

  it('keeps normal assistant text unchanged', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: '老王踏前一步。'
      })
    ).toEqual({
      kind: 'text',
      text: '老王踏前一步。'
    })
  })

  it('hides malformed structured draft JSON behind a readable error', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: '{"drafts":[{"kind":"create_character","name":"赵烈"'
      })
    ).toEqual({
      kind: 'text',
      text: 'AI 返回了结构化草稿，但内容无法解析。请重试或清空当前会话。'
    })
  })
})

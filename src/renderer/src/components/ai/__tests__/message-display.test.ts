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

  it('strips legacy author-thought markers before rendering chat text', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: [
          '先确认人物目标。',
          '<<<AUTHOR_THOUGHT_BLOCK>>>',
          '{"style":"author_inner_monologue","title":"作者思路模拟","lines":["我先压实动机。","我保留推进感。"]}',
          '<<<END_AUTHOR_THOUGHT_BLOCK>>>'
        ].join('\n')
      })
    ).toEqual({
      kind: 'text',
      text: '先确认人物目标。'
    })
  })

  it('summarizes chapter drafts instead of rendering long chapter content in chat', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: JSON.stringify({
          drafts: [
            {
              kind: 'create_chapter',
              title: '第二章 风雪归人',
              content: '他推开门，风雪倒灌进来。'
            }
          ]
        })
      })
    ).toEqual({
      kind: 'text',
      text: '已生成《第二章 风雪归人》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。'
    })
  })

  it('summarizes a single unwrapped chapter draft object', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: JSON.stringify({
          kind: 'create_chapter',
          title: '第三章 雨夜追兵',
          content: '雨声压住了马蹄声。'
        })
      })
    ).toEqual({
      kind: 'text',
      text: '已生成《第三章 雨夜追兵》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。'
    })
  })

  it('summarizes chapter-shaped JSON even when the model omits kind', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: JSON.stringify({
          chapter_title: '第三章 雨夜追兵',
          content: '雨声压住了马蹄声。'
        })
      })
    ).toEqual({
      kind: 'text',
      text: '已生成《第三章 雨夜追兵》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。'
    })
  })

  it('summarizes malformed structured chapter output using the plain-text fallback', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        metadata: { skill_key: 'create_chapter' },
        content: '{"title":"第三章 雨夜追兵","content":"雨声压住了马蹄声。"'
      })
    ).toEqual({
      kind: 'text',
      text: '已生成《AI 新章节》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。'
    })
  })

  it('summarizes plain-text chapter skill output after the draft is promoted to editor preview', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        metadata: { skill_key: 'create_chapter' },
        content: '第二章 风雪归人\n\n他推开门，风雪倒灌进来。'
      })
    ).toEqual({
      kind: 'text',
      text: '已生成《第二章 风雪归人》，已切到中间的 AI 章节草稿预览。确认后才会写入小说。'
    })
  })

  it('keeps malformed non-chapter structured output as text', () => {
    expect(
      buildAssistantMessageDisplay({
        role: 'assistant',
        content: '{"drafts":[{"kind":"create_character","name":"赵烈"'
      })
    ).toEqual({
      kind: 'text',
      text: '{"drafts":[{"kind":"create_character","name":"赵烈"'
    })
  })
})

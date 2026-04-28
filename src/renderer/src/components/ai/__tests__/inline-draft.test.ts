import { describe, expect, it } from 'vitest'
import { toAiChapterDraft, toInlineAiDraft } from '../inline-draft'

describe('toInlineAiDraft', () => {
  it('turns a matching insert_text draft into a center editor draft model', () => {
    expect(
      toInlineAiDraft(
        {
          id: 12,
          conversation_id: 7,
          kind: 'insert_text',
          title: '续写正文',
          target_ref: 'chapter:3',
          payload: {
            kind: 'insert_text',
            content: '续写段落',
            selection_chapter_id: 3,
            selection_to: 88,
            retry_input: '继续写冲突爆发。'
          }
        },
        3
      )
    ).toEqual({
      id: 12,
      title: '续写正文',
      payload: {
        kind: 'insert_text',
        content: '续写段落',
        selection_chapter_id: 3,
        selection_to: 88,
        retry_input: '继续写冲突爆发。'
      },
      chapterId: 3,
      conversationId: 7,
      retryInput: '继续写冲突爆发。'
    })
  })

  it('keeps drafts for other chapters out of the current editor', () => {
    expect(
      toInlineAiDraft(
        {
          id: 13,
          kind: 'insert_text',
          title: '续写正文',
          target_ref: 'chapter:4',
          payload: {
            kind: 'insert_text',
            content: '其他章节续写',
            selection_chapter_id: 4,
            selection_to: 20
          }
        },
        3
      )
    ).toBeNull()
  })

  it('ignores non-text asset drafts so they stay in the AI workbench basket', () => {
    expect(
      toInlineAiDraft(
        {
          id: 14,
          kind: 'create_character',
          title: '新角色',
          payload: {
            kind: 'create_character',
            name: '苏离'
          }
        },
        3
      )
    ).toBeNull()
  })
})

describe('toAiChapterDraft', () => {
  it('turns a pending create_chapter row into a main-editor chapter draft', () => {
    expect(
      toAiChapterDraft({
        id: 20,
        conversation_id: 9,
        kind: 'create_chapter',
        title: '创建章节',
        payload: {
          kind: 'create_chapter',
          volume_title: '第一卷 潜龙在渊',
          title: '第二章 风雪归人',
          content: '他推开门，风雪倒灌进来。',
          summary: '主角归来。',
          retry_input: '重新写第二章。'
        }
      })
    ).toEqual({
      id: 20,
      title: '第二章 风雪归人',
      content: '他推开门，风雪倒灌进来。',
      summary: '主角归来。',
      volumeId: null,
      volumeTitle: '第一卷 潜龙在渊',
      conversationId: 9,
      retryInput: '重新写第二章。'
    })
  })

  it('keeps empty chapter drafts out of the main editor preview', () => {
    expect(
      toAiChapterDraft({
        id: 21,
        kind: 'create_chapter',
        title: '空章节',
        payload: {
          kind: 'create_chapter',
          title: '空章节',
          content: ''
        }
      })
    ).toBeNull()
  })
})

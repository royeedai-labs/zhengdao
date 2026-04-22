import { describe, expect, it } from 'vitest'
import { buildConversationListItems, pickConversationAfterDelete } from '../conversation-list'

const conversations = [
  { id: 30, title: 'AI 对话', updated_at: '2026-04-22 08:00:00', message_count: 0 },
  { id: 20, title: 'AI 对话', updated_at: '2026-04-22 07:00:00', message_count: 3 },
  { id: 10, title: 'AI 对话', updated_at: '2026-04-22 06:00:00', message_count: 2 }
]

describe('conversation list helpers', () => {
  it('builds stable labels and selected state for the side panel list', () => {
    expect(buildConversationListItems(conversations, 20)).toEqual([
      { id: 30, label: '会话 3', messageCount: 0, updatedAt: '2026-04-22 08:00:00', selected: false },
      { id: 20, label: '会话 2', messageCount: 3, updatedAt: '2026-04-22 07:00:00', selected: true },
      { id: 10, label: '会话 1', messageCount: 2, updatedAt: '2026-04-22 06:00:00', selected: false }
    ])
  })

  it('picks a deterministic fallback when deleting the current conversation', () => {
    expect(pickConversationAfterDelete(conversations, 20, 20)).toBe(30)
    expect(pickConversationAfterDelete(conversations, 30, 20)).toBe(20)
    expect(pickConversationAfterDelete([{ id: 1, title: 'AI 对话', updated_at: '', message_count: 0 }], 1, 1)).toBeNull()
  })
})

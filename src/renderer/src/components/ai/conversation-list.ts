export type ConversationListRow = {
  id: number
  title: string
  updated_at: string
  message_count?: number
}

export type ConversationListItem = {
  id: number
  label: string
  messageCount: number
  updatedAt: string
  selected: boolean
}

export function buildConversationListItems(
  conversations: ConversationListRow[],
  currentConversationId: number | null
): ConversationListItem[] {
  return conversations.map((conversation, index) => ({
    id: conversation.id,
    label: `会话 ${conversations.length - index}`,
    messageCount: Number(conversation.message_count || 0),
    updatedAt: conversation.updated_at,
    selected: conversation.id === currentConversationId
  }))
}

export function pickConversationAfterDelete(
  conversations: Array<Pick<ConversationListRow, 'id'>>,
  deletedConversationId: number,
  currentConversationId: number | null
): number | null {
  if (deletedConversationId !== currentConversationId) return currentConversationId
  return conversations.find((conversation) => conversation.id !== deletedConversationId)?.id ?? null
}

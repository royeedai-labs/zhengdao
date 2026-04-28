export type StreamingAiMessage = {
  id: number
  role: 'assistant'
  content: string
  streaming?: boolean
  streamingLabel?: string
}

type AiMessageLike = {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  streamingLabel?: string
}

export function createPendingAssistantStreamMessage(
  id: number,
  streamingLabel = 'AI 正在生成...'
): StreamingAiMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    streaming: true,
    streamingLabel
  }
}

export function appendAssistantStreamToken<T extends AiMessageLike>(
  messages: T[],
  messageId: number,
  token: string
): T[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          content: `${message.content}${token}`,
          streaming: true
        }
      : message
  )
}

export function replaceAssistantStreamContent<T extends AiMessageLike>(
  messages: T[],
  messageId: number,
  content: string
): T[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          content,
          streaming: true
        }
      : message
  )
}

export function completeAssistantStreamMessage<T extends AiMessageLike>(
  messages: T[],
  pendingId: number,
  finalId: number,
  content: string
): T[] {
  return messages.map((message) =>
    message.id === pendingId
      ? ({
          id: finalId,
          role: 'assistant',
          content
        } as T)
      : message
  )
}

export function getAssistantStreamEmptyError(content: string): string | null {
  return content.trim() ? null : 'AI 返回了空响应，请重试。'
}

export function createAssistantStreamChunkQueue(
  onChunk: (chunk: string) => void,
  intervalMs = 24
) {
  let chunks: string[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let drainResolvers: Array<() => void> = []

  const resolveDrain = () => {
    if (chunks.length > 0 || timer) return
    const resolvers = drainResolvers
    drainResolvers = []
    resolvers.forEach((resolve) => resolve())
  }

  const schedule = () => {
    if (timer || chunks.length === 0) return
    timer = setTimeout(() => {
      timer = null
      const chunk = chunks.shift()
      if (chunk) onChunk(chunk)
      if (chunks.length > 0) {
        schedule()
      } else {
        resolveDrain()
      }
    }, intervalMs)
  }

  return {
    push(chunk: string) {
      if (!chunk) return
      chunks.push(chunk)
      schedule()
    },
    drain(): Promise<void> {
      if (chunks.length === 0 && !timer) return Promise.resolve()
      return new Promise((resolve) => {
        drainResolvers.push(resolve)
        schedule()
      })
    },
    clear() {
      chunks = []
      if (timer) clearTimeout(timer)
      timer = null
      resolveDrain()
    }
  }
}

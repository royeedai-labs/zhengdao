import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendAssistantStreamToken,
  createAssistantStreamChunkQueue,
  createPendingAssistantStreamMessage,
  completeAssistantStreamMessage,
  getAssistantStreamEmptyError,
  replaceAssistantStreamContent
} from '../streaming-message'

afterEach(() => {
  vi.useRealTimers()
})

describe('assistant streaming message helpers', () => {
  it('appends tokens to a pending assistant message and finalizes it', () => {
    const pending = createPendingAssistantStreamMessage(-1)
    const first = appendAssistantStreamToken([pending], pending.id, '第一段')
    const second = appendAssistantStreamToken(first, pending.id, '，第二段')

    expect(second).toEqual([
      {
        id: -1,
        role: 'assistant',
        content: '第一段，第二段',
        streaming: true,
        streamingLabel: 'AI 正在生成...'
      }
    ])

    expect(completeAssistantStreamMessage(second, pending.id, 42, '第一段，第二段')).toEqual([
      {
        id: 42,
        role: 'assistant',
        content: '第一段，第二段'
      }
    ])
  })

  it('reports empty completed stream content as an assistant response error', () => {
    expect(getAssistantStreamEmptyError('')).toBe('AI 返回了空响应，请重试。')
    expect(getAssistantStreamEmptyError('   \n')).toBe('AI 返回了空响应，请重试。')
    expect(getAssistantStreamEmptyError('正常回复')).toBeNull()
  })

  it('can replace pending stream content with parsed display text', () => {
    const pending = createPendingAssistantStreamMessage(-1)

    expect(replaceAssistantStreamContent([pending], pending.id, '正在解析结构...')).toEqual([
      {
        id: -1,
        role: 'assistant',
        content: '正在解析结构...',
        streaming: true,
        streamingLabel: 'AI 正在生成...'
      }
    ])
  })

  it('renders provider delta chunks one by one and resolves after the queue drains', async () => {
    vi.useFakeTimers()
    const rendered: string[] = []
    const queue = createAssistantStreamChunkQueue((chunk) => rendered.push(chunk), 16)

    queue.push('第一段')
    queue.push('第二段')
    const drainPromise = queue.drain()

    expect(rendered).toEqual([])
    await vi.advanceTimersByTimeAsync(16)
    expect(rendered).toEqual(['第一段'])
    await vi.advanceTimersByTimeAsync(16)
    await drainPromise
    expect(rendered).toEqual(['第一段', '第二段'])
  })
})

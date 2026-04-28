import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiSummarize, aiComplete, aiPromptStream, getResolvedGlobalAiConfig } from '../index'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

function setFetch(response: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => response,
    text: async () => JSON.stringify(response),
    body: null
  })) as unknown as typeof fetch
  globalThis.fetch = fetchMock
  return fetchMock as unknown as ReturnType<typeof vi.fn>
}

afterEach(() => {
  vi.useRealTimers()
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true
  })
  vi.restoreAllMocks()
})

describe('AI provider routing', () => {
  it('routes official cloud mode through the preload bridge with the selected profile', async () => {
    const aiCompleteBridge = vi.fn(async () => ({ content: '官方回复' }))
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiComplete: aiCompleteBridge } },
      configurable: true,
      writable: true
    })

    const result = await aiSummarize(
      {
        ai_provider: 'zhengdao_official',
        ai_api_key: '',
        ai_api_endpoint: '',
        ai_model: '',
        ai_official_profile_id: 'profile-1',
        bookId: 42,
        ragMode: 'auto'
      },
      '正文'
    )

    expect(result).toEqual({ content: '官方回复' })
    expect(aiCompleteBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'zhengdao_official',
        profileId: 'profile-1',
        bookId: 42,
        ragMode: 'auto'
      })
    )
  })

  it('routes Gemini API Key mode to the Gemini REST format with default endpoint', async () => {
    const fetchMock = setFetch({
      candidates: [{ content: { parts: [{ text: '章节摘要' }] } }]
    })

    const result = await aiSummarize(
      {
        ai_provider: 'gemini',
        ai_api_key: 'gemini-key',
        ai_api_endpoint: '',
        ai_model: ''
      },
      '第一章正文'
    )

    expect(result).toEqual({ content: '章节摘要' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=gemini-key'
    )
    expect(JSON.parse(String(init?.body))).toMatchObject({
      contents: [{ parts: [{ text: '请为下列章节正文生成摘要：\n\n第一章正文' }] }],
      systemInstruction: {
        parts: [
          {
            text: '你是编辑助理。请用两三句话概括本章剧情要点与情绪走向，客观中立，不要评价文笔。只输出摘要正文。'
          }
        ]
      }
    })
  })

  it('does not require API key or endpoint for Gemini CLI mode and calls the preload bridge', async () => {
    const aiCompleteBridge = vi.fn(async () => ({ content: '续写内容' }))
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiComplete: aiCompleteBridge } },
      configurable: true,
      writable: true
    })

    const result = await aiComplete(
      {
        ai_provider: 'gemini_cli',
        ai_api_key: '',
        ai_api_endpoint: '',
        ai_model: 'gemini-2.5-flash'
      },
      '请续写',
      '已有内容'
    )

    expect(result).toEqual({ content: '续写内容' })
    expect(aiCompleteBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini_cli',
        model: 'gemini-2.5-flash',
        systemPrompt: '你是一位优秀的网文作家助手。请根据已有内容自然地续写，保持风格一致。只输出续写内容，不要解释。',
        userPrompt: '请续写\n\n已有内容：\n已有内容',
        maxTokens: 500,
        temperature: 0.8,
        ragMode: 'auto'
      })
    )
  })

  it('routes Gemini CLI streaming through the preload stream bridge', async () => {
    const aiStreamCompleteBridge = vi.fn((_request, callbacks) => {
      callbacks.onToken('第一')
      callbacks.onToken('第二')
      callbacks.onComplete('第一第二')
    })
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiStreamComplete: aiStreamCompleteBridge } },
      configurable: true,
      writable: true
    })
    const tokens: string[] = []
    let completed = ''

    await aiPromptStream(
      {
        ai_provider: 'gemini_cli',
        ai_api_key: '',
        ai_api_endpoint: '',
        ai_model: 'gemini-2.5-flash'
      },
      'system',
      'user',
      {
        onToken: (token) => tokens.push(token),
        onComplete: (content) => {
          completed = content
        },
        onError: (error) => {
          throw new Error(error)
        }
      }
    )

    expect(tokens).toEqual(['第一', '第二'])
    expect(completed).toBe('第一第二')
    expect(aiStreamCompleteBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini_cli',
        model: 'gemini-2.5-flash',
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 1200,
        temperature: 0.7,
        ragMode: 'auto'
      }),
      expect.any(Object)
    )
  })

  it('runs Gemini CLI stream bridge cleanup when completion is synchronous', async () => {
    const cleanup = vi.fn()
    const aiStreamCompleteBridge = vi.fn((_request, callbacks) => {
      callbacks.onComplete('同步完成')
      return cleanup
    })
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiStreamComplete: aiStreamCompleteBridge } },
      configurable: true,
      writable: true
    })
    let completed = ''

    await aiPromptStream(
      {
        ai_provider: 'gemini_cli',
        ai_api_key: '',
        ai_api_endpoint: '',
        ai_model: 'gemini-3-pro-preview'
      },
      'system',
      'user',
      {
        onToken: () => {},
        onComplete: (content) => {
          completed = content
        },
        onError: (error) => {
          throw new Error(error)
        }
      }
    )

    expect(completed).toBe('同步完成')
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('waits for asynchronous Gemini CLI stream bridge completion before resolving', async () => {
    vi.useFakeTimers()
    const aiStreamCompleteBridge = vi.fn((_request, callbacks) => {
      setTimeout(() => {
        callbacks.onToken('延迟')
        callbacks.onComplete('延迟完成')
      }, 10)
      return vi.fn()
    })
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiStreamComplete: aiStreamCompleteBridge } },
      configurable: true,
      writable: true
    })
    const tokens: string[] = []
    let completed = ''
    let resolved = false

    const pending = aiPromptStream(
      {
        ai_provider: 'gemini_cli',
        ai_api_key: '',
        ai_api_endpoint: '',
        ai_model: 'gemini-2.5-flash'
      },
      'system',
      'user',
      {
        onToken: (token) => tokens.push(token),
        onComplete: (content) => {
          completed = content
        },
        onError: (error) => {
          throw new Error(error)
        }
      }
    ).then(() => {
      resolved = true
      return 'resolved'
    })
    const earlyRace = Promise.race([
      pending,
      new Promise<'still-pending'>((resolve) => setTimeout(() => resolve('still-pending'), 0))
    ])

    await vi.advanceTimersByTimeAsync(0)
    await expect(earlyRace).resolves.toBe('still-pending')
    expect(resolved).toBe(false)

    await vi.runOnlyPendingTimersAsync()
    await pending

    expect(tokens).toEqual(['延迟'])
    expect(completed).toBe('延迟完成')
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })

  it('still requires an API key for OpenAI-compatible mode', async () => {
    const result = await aiSummarize(
      {
        ai_provider: 'openai',
        ai_api_key: '',
        ai_api_endpoint: 'https://api.openai.com/v1/chat/completions',
        ai_model: ''
      },
      '正文'
    )

    expect(result.error).toBe('请先在应用设置 / AI 与模型中完成全局 AI 配置')
  })

  it('falls back to the legacy unified resolver for global AI config', async () => {
    const aiGetResolvedConfigForBook = vi.fn(async () => ({
      ai_provider: 'gemini_cli',
      ai_api_key: '',
      ai_api_endpoint: '',
      ai_model: 'gemini-2.5-flash'
    }))
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiGetResolvedConfigForBook } },
      configurable: true,
      writable: true
    })

    await expect(getResolvedGlobalAiConfig()).resolves.toMatchObject({
      ai_provider: 'gemini_cli',
      ai_model: 'gemini-2.5-flash'
    })
    expect(aiGetResolvedConfigForBook).toHaveBeenCalledWith(0)
  })

  it('prefers the global AI config resolver bridge', async () => {
    const aiGetResolvedGlobalConfig = vi.fn(async () => ({
      ai_provider: 'ollama',
      ai_api_key: '',
      ai_api_endpoint: 'http://localhost:11434',
      ai_model: 'llama3'
    }))
    const aiGetResolvedConfigForBook = vi.fn()
    Object.defineProperty(globalThis, 'window', {
      value: { api: { aiGetResolvedGlobalConfig, aiGetResolvedConfigForBook } },
      configurable: true,
      writable: true
    })

    await expect(getResolvedGlobalAiConfig()).resolves.toMatchObject({
      ai_provider: 'ollama',
      ai_model: 'llama3'
    })
    expect(aiGetResolvedGlobalConfig).toHaveBeenCalledTimes(1)
    expect(aiGetResolvedConfigForBook).not.toHaveBeenCalled()
  })
})

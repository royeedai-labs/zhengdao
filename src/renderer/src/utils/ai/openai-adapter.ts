import type { AiConfig, AiProviderAdapter, AiResponse, AiStreamCallbacks } from './types'

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

function resolveUrl(endpoint: string): string {
  return endpoint?.trim() || DEFAULT_ENDPOINT
}

function toOpenAIConfig(config: AiConfig): AiConfig {
  return {
    ...config,
    ai_model: config.ai_model?.trim() || 'gpt-4o-mini',
    ai_api_endpoint: resolveUrl(config.ai_api_endpoint)
  }
}

export class OpenAIAdapter implements AiProviderAdapter {
  async complete(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 500,
    temperature = 0.8,
    opts?: { signal?: AbortSignal }
  ): Promise<AiResponse> {
    const c = toOpenAIConfig(config)
    if (!c.ai_api_key?.trim()) {
      return { content: '', error: '请先在应用设置 / AI 与模型中完成全局 AI 配置' }
    }

    try {
      const response = await fetch(c.ai_api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.ai_api_key}`
        },
        body: JSON.stringify({
          model: c.ai_model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature
        }),
        signal: opts?.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        return { content: '', error: `AI 请求失败 (${response.status}): ${errText.slice(0, 200)}` }
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string }
      }
      if (data.error?.message) {
        return { content: '', error: data.error.message }
      }
      const text = data?.choices?.[0]?.message?.content || ''
      return { content: text }
    } catch (err: unknown) {
      return { content: '', error: `AI 请求失败: ${(err as Error).message}` }
    }
  }

  async stream(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
    callbacks: AiStreamCallbacks,
    maxTokens = 500,
    temperature = 0.8,
    opts?: { signal?: AbortSignal }
  ): Promise<void> {
    const c = toOpenAIConfig(config)
    if (!c.ai_api_key?.trim()) {
      callbacks.onError('请先在应用设置 / AI 与模型中完成全局 AI 配置')
      return
    }

    let full = ''
    try {
      const response = await fetch(c.ai_api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.ai_api_key}`
        },
        body: JSON.stringify({
          model: c.ai_model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature,
          stream: true
        }),
        signal: opts?.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        callbacks.onError(`AI 请求失败 (${response.status}): ${errText.slice(0, 200)}`)
        return
      }

      const body = response.body
      if (!body) {
        callbacks.onError('AI 响应无正文')
        return
      }

      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handlePayload = (payload: string): boolean => {
        if (payload === '[DONE]') {
          callbacks.onComplete(full)
          return true
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
            error?: { message?: string }
          }
          if (json.error?.message) {
            callbacks.onError(json.error.message)
            return true
          }
          const piece = json?.choices?.[0]?.delta?.content
          if (piece) {
            full += piece
            callbacks.onToken(piece)
          }
        } catch {
          /* ignore malformed chunk */
        }
        return false
      }

      const consumeLine = (line: string): boolean => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) return false
        const payload = trimmed.slice(5).trim()
        return handlePayload(payload)
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() || ''
        let stop = false
        for (const line of parts) {
          if (consumeLine(line)) {
            stop = true
            break
          }
        }
        if (stop) return
      }

      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (consumeLine(line)) return
        }
      }

      callbacks.onComplete(full)
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        callbacks.onComplete(full)
        return
      }
      callbacks.onError(`AI 请求失败: ${(err as Error).message}`)
    }
  }
}

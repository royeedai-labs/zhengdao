import type { AiConfig, AiProviderAdapter, AiResponse, AiStreamCallbacks } from './types'

const DEFAULT_BASE = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3'

function resolveChatUrl(endpoint: string): string {
  const raw = endpoint?.trim() || DEFAULT_BASE
  if (raw.endsWith('/api/chat')) return raw
  return `${raw.replace(/\/$/, '')}/api/chat`
}

function modelName(config: AiConfig): string {
  return config.ai_model?.trim() || DEFAULT_MODEL
}

export class OllamaAdapter implements AiProviderAdapter {
  async complete(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 500,
    temperature = 0.8,
    opts?: { signal?: AbortSignal }
  ): Promise<AiResponse> {
    const url = resolveChatUrl(config.ai_api_endpoint)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName(config),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          options: { num_predict: maxTokens, temperature }
        }),
        signal: opts?.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        return { content: '', error: `AI 请求失败 (${response.status}): ${errText.slice(0, 200)}` }
      }

      const data = (await response.json()) as {
        message?: { content?: string }
        error?: string
      }
      if (data.error) {
        return { content: '', error: data.error }
      }
      const text = data.message?.content || ''
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
    const url = resolveChatUrl(config.ai_api_endpoint)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName(config),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true,
          options: { num_predict: maxTokens, temperature }
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
      let buf = ''
      let full = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let idx: number
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim()
          buf = buf.slice(idx + 1)
          if (!line) continue

          try {
            const json = JSON.parse(line) as {
              message?: { content?: string }
              error?: string
            }
            if (json.error) {
              callbacks.onError(json.error)
              return
            }
            const piece = json.message?.content
            if (piece) {
              full += piece
              callbacks.onToken(piece)
            }
          } catch {
            continue
          }
        }
      }

      const tail = buf.trim()
      if (tail) {
        try {
          const json = JSON.parse(tail) as { message?: { content?: string } }
          const piece = json.message?.content
          if (piece) {
            full += piece
            callbacks.onToken(piece)
          }
        } catch {
          /* ignore */
        }
      }

      callbacks.onComplete(full)
    } catch (err: unknown) {
      callbacks.onError(`AI 请求失败: ${(err as Error).message}`)
    }
  }
}

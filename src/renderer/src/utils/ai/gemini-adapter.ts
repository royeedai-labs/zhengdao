import type { AiConfig, AiProviderAdapter, AiResponse, AiStreamCallbacks } from './types'

const GEMINI_REST_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.0-flash'

function modelName(config: AiConfig): string {
  return config.ai_model?.trim() || DEFAULT_MODEL
}

function buildPath(config: AiConfig, stream: boolean): string {
  const model = modelName(config)
  const base = (config.ai_api_endpoint?.trim() || GEMINI_REST_BASE).replace(/\/$/, '')
  const action = stream ? 'streamGenerateContent' : 'generateContent'
  return `${base}/models/${encodeURIComponent(model)}:${action}`
}

function buildRequestUrl(config: AiConfig, stream: boolean): string {
  const path = buildPath(config, stream)
  const url = new URL(path)
  url.searchParams.set('key', config.ai_api_key.trim())
  if (stream) {
    url.searchParams.set('alt', 'sse')
  }
  return url.toString()
}

function extractText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const parts = d.candidates?.[0]?.content?.parts
  if (!parts?.length) return ''
  return parts.map((p) => p.text || '').join('')
}

export class GeminiAdapter implements AiProviderAdapter {
  async complete(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 500,
    temperature = 0.8,
    opts?: { signal?: AbortSignal }
  ): Promise<AiResponse> {
    if (!config.ai_api_key?.trim()) {
      return { content: '', error: '请先在应用设置 / AI 与模型中完成全局 AI 配置' }
    }

    const url = buildRequestUrl(config, false)
    const body = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts?.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        return { content: '', error: `AI 请求失败 (${response.status}): ${errText.slice(0, 200)}` }
      }

      const data = (await response.json()) as { error?: { message?: string }; candidates?: unknown[] }
      if (data.error?.message) {
        return { content: '', error: data.error.message }
      }
      const text = extractText(data)
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
    if (!config.ai_api_key?.trim()) {
      callbacks.onError('请先在应用设置 / AI 与模型中完成全局 AI 配置')
      return
    }

    const url = buildRequestUrl(config, true)
    const body = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    }

    let full = ''
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts?.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        callbacks.onError(`AI 请求失败 (${response.status}): ${errText.slice(0, 200)}`)
        return
      }

      const streamBody = response.body
      if (!streamBody) {
        callbacks.onError('AI 响应无正文')
        return
      }

      const reader = streamBody.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ''
      let aborted = false

      const processLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) return
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') return
        try {
          const json = JSON.parse(payload) as {
            error?: { message?: string }
            candidates?: unknown[]
          }
          if (json.error?.message) {
            callbacks.onError(json.error.message)
            aborted = true
            return
          }
          const piece = extractText(json)
          if (piece) {
            full += piece
            callbacks.onToken(piece)
          }
        } catch {
          return
        }
      }

      outer: for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() || ''
        for (const line of lines) {
          processLine(line)
          if (aborted) break outer
        }
      }

      if (!aborted && lineBuffer.trim()) {
        for (const l of lineBuffer.split('\n')) {
          processLine(l)
          if (aborted) break
        }
      }

      if (!aborted) {
        callbacks.onComplete(full)
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        callbacks.onComplete(full)
        return
      }
      callbacks.onError(`AI 请求失败: ${(err as Error).message}`)
    }
  }
}

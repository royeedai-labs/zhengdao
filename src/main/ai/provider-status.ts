type ProviderStatusProbeInput = {
  provider: string
  apiKey?: string
  apiEndpoint?: string
  model?: string
}

type ProviderStatusResult = {
  provider: string
  available: boolean
  needsSetup: boolean
  message: string
}

const OPENAI_DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const OLLAMA_DEFAULT_BASE = 'http://localhost:11434'
const DEFAULT_TIMEOUT_MS = 12_000

function trim(value: string | null | undefined): string {
  return value?.trim() || ''
}

function makeStatus(
  provider: string,
  available: boolean,
  needsSetup: boolean,
  message: string
): ProviderStatusResult {
  return { provider, available, needsSetup, message }
}

function summarizeRemoteError(status: number, text: string): string {
  const message = text.replace(/\s+/g, ' ').trim().slice(0, 180)
  return message ? `请求失败 (${status})：${message}` : `请求失败 (${status})`
}

function createTimeoutController(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    finish() {
      clearTimeout(timer)
    }
  }
}

function resolveOpenAiEndpoint(endpoint: string): string {
  return trim(endpoint) || OPENAI_DEFAULT_ENDPOINT
}

function resolveGeminiEndpoint(endpoint: string, model: string): string {
  const base = (trim(endpoint) || GEMINI_DEFAULT_BASE).replace(/\/$/, '')
  const name = trim(model) || 'gemini-2.0-flash'
  const url = new URL(`${base}/models/${encodeURIComponent(name)}:generateContent`)
  return url.toString()
}

function resolveOllamaEndpoint(endpoint: string): string {
  const base = trim(endpoint) || OLLAMA_DEFAULT_BASE
  return base.endsWith('/api/chat') ? base : `${base.replace(/\/$/, '')}/api/chat`
}

async function probeOpenAiLike(input: ProviderStatusProbeInput): Promise<ProviderStatusResult> {
  const apiKey = trim(input.apiKey)
  if (!apiKey) {
    return makeStatus(input.provider, false, true, '需要填写 API Key / Token 后才能检测。')
  }

  const timeout = createTimeoutController()
  try {
    const response = await fetch(resolveOpenAiEndpoint(input.apiEndpoint || ''), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: trim(input.model) || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with ok.' }],
        max_tokens: 1,
        temperature: 0
      }),
      signal: timeout.signal
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return makeStatus(input.provider, false, false, summarizeRemoteError(response.status, text))
    }
    return makeStatus(input.provider, true, false, 'Provider 连通性检测通过。')
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return makeStatus(input.provider, false, false, 'Provider 检测超时，请稍后重试。')
    }
    return makeStatus(
      input.provider,
      false,
      false,
      `Provider 检测失败：${error instanceof Error ? error.message : 'unknown error'}`
    )
  } finally {
    timeout.finish()
  }
}

async function probeGemini(input: ProviderStatusProbeInput): Promise<ProviderStatusResult> {
  const apiKey = trim(input.apiKey)
  if (!apiKey) {
    return makeStatus(input.provider, false, true, '需要填写 Gemini API Key 后才能检测。')
  }

  const timeout = createTimeoutController()
  try {
    const url = new URL(resolveGeminiEndpoint(input.apiEndpoint || '', input.model || ''))
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '只回答 ok。' }] }],
        generationConfig: {
          maxOutputTokens: 8,
          temperature: 0
        }
      }),
      signal: timeout.signal
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return makeStatus(input.provider, false, false, summarizeRemoteError(response.status, text))
    }
    return makeStatus(input.provider, true, false, 'Gemini API 连通性检测通过。')
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return makeStatus(input.provider, false, false, 'Gemini API 检测超时，请稍后重试。')
    }
    return makeStatus(
      input.provider,
      false,
      false,
      `Gemini API 检测失败：${error instanceof Error ? error.message : 'unknown error'}`
    )
  } finally {
    timeout.finish()
  }
}

async function probeOllama(input: ProviderStatusProbeInput): Promise<ProviderStatusResult> {
  const timeout = createTimeoutController()
  try {
    const response = await fetch(resolveOllamaEndpoint(input.apiEndpoint || ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: trim(input.model) || 'llama3',
        messages: [{ role: 'user', content: 'Reply with ok.' }],
        stream: false,
        options: { num_predict: 8, temperature: 0 }
      }),
      signal: timeout.signal
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return makeStatus(input.provider, false, false, summarizeRemoteError(response.status, text))
    }
    return makeStatus(input.provider, true, false, 'Ollama 连通性检测通过。')
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return makeStatus(input.provider, false, false, 'Ollama 检测超时，请稍后重试。')
    }
    return makeStatus(
      input.provider,
      false,
      false,
      `Ollama 检测失败：${error instanceof Error ? error.message : 'unknown error'}`
    )
  } finally {
    timeout.finish()
  }
}

export async function getProviderStatus(
  input: ProviderStatusProbeInput,
  probe = false
): Promise<ProviderStatusResult> {
  const provider = trim(input.provider) || 'openai'

  if (provider === 'gemini_cli') {
    return makeStatus(provider, true, true, 'Gemini CLI 状态由专用检测流程处理。')
  }

  if (!probe) {
    if ((provider === 'openai' || provider === 'gemini' || provider === 'custom') && !trim(input.apiKey)) {
      return makeStatus(provider, false, true, '缺少 API Key / Token，请先填写账号密钥。')
    }
    return makeStatus(provider, true, false, '当前账号配置已填写，可点击“检测”验证连通性。')
  }

  if (provider === 'gemini') return probeGemini(input)
  if (provider === 'ollama') return probeOllama(input)
  return probeOpenAiLike(input)
}

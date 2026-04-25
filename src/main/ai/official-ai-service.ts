import type { AiBridgeCompleteRequest, AiOfficialProfile, AiResponse, AiStreamCallbacks } from '../../shared/ai'
import { formatLocalRagPrompt, retrieveLocalBookSnippets } from './local-rag-service'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

type AgentChatResponse = {
  message?: { role?: string; content?: string }
  error?: string
  messageText?: string
}

function modelHintFromRequest(request: AiBridgeCompleteRequest): 'fast' | 'balanced' | 'heavy' {
  if (request.model === 'balanced' || request.model === 'heavy') return request.model
  return 'fast'
}

async function apiRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  })
  const text = await response.text()
  let payload = {} as T
  if (text) {
    try {
      payload = JSON.parse(text) as T
    } catch {
      if (response.ok) throw new Error('证道官方 AI 响应格式异常')
    }
  }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: string }).message)
      : text
    throw new Error(message || `证道官方 AI 请求失败 (${response.status})`)
  }
  return payload
}

function buildChatPayload(request: AiBridgeCompleteRequest, stream = false) {
  const augmented = withLocalRagContext(request)
  return {
    profileId: augmented.profileId || undefined,
    modelHint: modelHintFromRequest(augmented),
    stream,
    messages: [
      { role: 'system', content: augmented.systemPrompt },
      { role: 'user', content: augmented.userPrompt }
    ]
  }
}

function withLocalRagContext(request: AiBridgeCompleteRequest): AiBridgeCompleteRequest {
  if (request.ragMode === 'off' || request.bookId == null) return request
  try {
    const snippets = retrieveLocalBookSnippets(request.bookId, request.userPrompt, 4)
    if (snippets.length === 0) return request
    const context = formatLocalRagPrompt(snippets)
    return {
      ...request,
      systemPrompt: [
        request.systemPrompt,
        '你会收到“本地检索片段”。当回答依赖作品事实时，只能依据这些片段或用户本轮明确提供的上下文。',
        '引用作品事实时使用 [L1]、[L2] 这样的片段编号；如果片段不足以支持结论，明确说“书中未明确”。'
      ].join('\n\n'),
      userPrompt: `${request.userPrompt}\n\n## 本地检索片段\n${context}`
    }
  } catch (error) {
    console.warn('[OfficialAI] local RAG failed:', error)
    return request
  }
}

export async function getOfficialAiProfiles(token: string | null): Promise<AiOfficialProfile[]> {
  if (!token) return []
  const result = await apiRequest<{ profiles?: AiOfficialProfile[] }>('/agent/profiles', token)
  return result.profiles || []
}

export async function completeOfficialAi(
  request: AiBridgeCompleteRequest,
  token: string | null
): Promise<AiResponse> {
  if (!token) return { content: '', error: '请先登录证道账号后使用官方 AI' }
  try {
    const result = await apiRequest<AgentChatResponse>('/agent/chat', token, {
      method: 'POST',
      body: JSON.stringify(buildChatPayload(request, false))
    })
    return { content: result.message?.content || result.messageText || '' }
  } catch (error) {
    return { content: '', error: error instanceof Error ? error.message : String(error) }
  }
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
  }
  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

export function streamOfficialAi(
  request: AiBridgeCompleteRequest,
  token: string | null,
  callbacks: AiStreamCallbacks
) {
  const controller = new AbortController()
  let fullText = ''

  const done = (async () => {
    if (!token) {
      callbacks.onError('请先登录证道账号后使用官方 AI')
      return
    }
    try {
      const response = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(buildChatPayload(request, true)),
        signal: controller.signal
      })
      if (!response.ok) {
        callbacks.onError(`证道官方 AI 请求失败 (${response.status})：${(await response.text()).slice(0, 200)}`)
        return
      }
      if (!response.body) {
        callbacks.onError('证道官方 AI 响应无正文')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''
        for (const block of blocks) {
          const parsed = parseSseBlock(block)
          if (!parsed) continue
          const data = JSON.parse(parsed.data) as { text?: string; message?: string }
          if (parsed.event === 'delta' && data.text) {
            fullText += data.text
            callbacks.onToken(data.text)
          } else if (parsed.event === 'error') {
            callbacks.onError(data.message || '证道官方 AI 生成失败')
            return
          } else if (parsed.event === 'done') {
            callbacks.onComplete(fullText)
            return
          }
        }
      }
      callbacks.onComplete(fullText)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onComplete(fullText)
        return
      }
      callbacks.onError(error instanceof Error ? error.message : String(error))
    }
  })()

  return {
    cancel: () => controller.abort(),
    done
  }
}

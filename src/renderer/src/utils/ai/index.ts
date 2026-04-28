import { GeminiAdapter } from './gemini-adapter'
import { OllamaAdapter } from './ollama-adapter'
import { OpenAIAdapter } from './openai-adapter'
import type {
  AiBridgeCompleteRequest,
  AiCallerConfig,
  AiConfig,
  AiFetchOpts,
  AiProvider,
  AiProviderAdapter,
  AiResponse,
  AiStreamCallbacks
} from './types'

export type {
  AiBridgeCompleteRequest,
  AiCallerConfig,
  AiConfig,
  AiFetchOpts,
  AiProvider,
  AiResponse,
  AiStreamCallbacks
} from './types'

const PROVIDERS = new Set<AiProvider>(['zhengdao_official', 'openai', 'gemini', 'gemini_cli', 'ollama', 'custom'])
const openaiAdapter = new OpenAIAdapter()
const geminiAdapter = new GeminiAdapter()
const ollamaAdapter = new OllamaAdapter()

type PromptRequest = {
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
}

type AiStreamBridgeHandle =
  | {
      requestId?: string
      cleanup?: () => void
    }
  | (() => void)

type NormalizedAiConfig = AiConfig & Pick<AiCallerConfig, 'bookId' | 'ragMode'>

function normalizeProvider(provider?: string): AiProvider {
  if (provider && PROVIDERS.has(provider as AiProvider)) return provider as AiProvider
  return 'openai'
}

function normalizeConfig(config: AiCallerConfig): NormalizedAiConfig {
  return {
    ai_provider: normalizeProvider(config.ai_provider),
    ai_api_key: config.ai_api_key || '',
    ai_api_endpoint: config.ai_api_endpoint || '',
    ai_model: config.ai_model || '',
    ai_official_profile_id: config.ai_official_profile_id || '',
    ...(config.bookId != null ? { bookId: config.bookId } : {}),
    ragMode: config.ragMode === 'off' ? 'off' : 'auto'
  }
}

function adapterFor(provider: AiProvider): AiProviderAdapter | null {
  if (provider === 'gemini') return geminiAdapter
  if (provider === 'ollama') return ollamaAdapter
  if (provider === 'openai' || provider === 'custom') return openaiAdapter
  return null
}

export function isAiConfigReady(config?: Partial<AiCallerConfig> | null): config is AiCallerConfig {
  if (!config) return false
  const provider = normalizeProvider(config.ai_provider)
  if (provider === 'zhengdao_official' || provider === 'gemini_cli' || provider === 'ollama') return true
  return Boolean(config.ai_api_key?.trim())
}

export async function getResolvedGlobalAiConfig(): Promise<AiCallerConfig | null> {
  if (typeof window === 'undefined' || !window.api) return null
  if (window.api.aiGetResolvedGlobalConfig) {
    return (window.api.aiGetResolvedGlobalConfig() as Promise<AiCallerConfig>) || null
  }
  if (window.api.aiGetResolvedWorkspaceConfig) {
    return (window.api.aiGetResolvedWorkspaceConfig() as Promise<AiCallerConfig>) || null
  }
  if (window.api.aiGetResolvedConfigForBook) {
    return (window.api.aiGetResolvedConfigForBook(0) as Promise<AiCallerConfig>) || null
  }
  return null
}

export async function getResolvedWorkspaceAiConfig(): Promise<AiCallerConfig | null> {
  return getResolvedGlobalAiConfig()
}

export async function getResolvedAiConfigForBook(
  bookId: number | null | undefined
): Promise<AiCallerConfig | null> {
  if (bookId == null) return null
  return getResolvedGlobalAiConfig()
}

function bridgeComplete(request: AiBridgeCompleteRequest): Promise<AiResponse> {
  if (typeof window === 'undefined' || !window.api?.aiComplete) {
    return Promise.resolve({
      content: '',
      error: '当前运行环境不支持 Gemini CLI 调用'
    })
  }
  return window.api.aiComplete(request) as Promise<AiResponse>
}

async function bridgeStreamComplete(
  request: AiBridgeCompleteRequest,
  callbacks: AiStreamCallbacks,
  opts?: AiFetchOpts
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.api?.aiStreamComplete) return false
  await new Promise<void>((resolve) => {
    let cleanup: (() => void) | undefined
    let requestId = ''
    let settled = false
    let removeAbortListener: (() => void) | undefined
    const runCleanup = () => {
      removeAbortListener?.()
      removeAbortListener = undefined
      cleanup?.()
      cleanup = undefined
    }
    const finish = () => {
      if (settled) return
      settled = true
      runCleanup()
      resolve()
    }
    const bridgeHandle = window.api.aiStreamComplete(request, {
      onToken: callbacks.onToken,
      onComplete: (content) => {
        callbacks.onComplete(content)
        finish()
      },
      onError: (error) => {
        callbacks.onError(error)
        finish()
      }
    }) as AiStreamBridgeHandle

    if (typeof bridgeHandle === 'function') {
      cleanup = bridgeHandle
    } else if (bridgeHandle) {
      cleanup = bridgeHandle.cleanup
      requestId = bridgeHandle.requestId || ''
    }

    if (opts?.signal) {
      const cancelOnAbort = () => {
        if (!requestId || typeof window === 'undefined' || !window.api?.aiCancelStream) return
        window.api.aiCancelStream(requestId)
      }
      if (opts.signal.aborted) {
        cancelOnAbort()
      } else {
        opts.signal.addEventListener('abort', cancelOnAbort, { once: true })
        removeAbortListener = () => {
          opts.signal?.removeEventListener('abort', cancelOnAbort)
        }
      }
    }
    if (settled) runCleanup()
  })
  return true
}

async function completeWithProvider(
  config: AiCallerConfig,
  request: PromptRequest,
  opts?: AiFetchOpts
): Promise<AiResponse> {
  const normalized = normalizeConfig(config)
  if (!isAiConfigReady(normalized)) {
    return { content: '', error: '请先在应用设置 / AI 与模型中完成全局 AI 配置' }
  }

  if (normalized.ai_provider === 'zhengdao_official' || normalized.ai_provider === 'gemini_cli') {
    return bridgeComplete({
      provider: normalized.ai_provider,
      model: normalized.ai_model,
      ...(normalized.ai_official_profile_id ? { profileId: normalized.ai_official_profile_id } : {}),
      ...(normalized.bookId != null ? { bookId: normalized.bookId } : {}),
      ragMode: normalized.ragMode,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature
    })
  }

  const adapter = adapterFor(normalized.ai_provider)
  if (!adapter) {
    return { content: '', error: '暂不支持当前 AI Provider' }
  }
  return adapter.complete(
    normalized,
    request.systemPrompt,
    request.userPrompt,
    request.maxTokens,
    request.temperature,
    opts
  )
}

async function streamWithProvider(
  config: AiCallerConfig,
  request: PromptRequest,
  callbacks: AiStreamCallbacks,
  opts?: AiFetchOpts
): Promise<void> {
  const normalized = normalizeConfig(config)
  if (!isAiConfigReady(normalized)) {
    callbacks.onError('请先在应用设置 / AI 与模型中完成全局 AI 配置')
    return
  }

  if (normalized.ai_provider === 'zhengdao_official' || normalized.ai_provider === 'gemini_cli') {
    const bridgeRequest = {
      provider: normalized.ai_provider,
      model: normalized.ai_model,
      ...(normalized.ai_official_profile_id ? { profileId: normalized.ai_official_profile_id } : {}),
      ...(normalized.bookId != null ? { bookId: normalized.bookId } : {}),
      ragMode: normalized.ragMode,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature
    } satisfies AiBridgeCompleteRequest
    if (await bridgeStreamComplete(bridgeRequest, callbacks, opts)) return
    const result = await bridgeComplete(bridgeRequest)
    if (result.error) {
      callbacks.onError(result.error)
      return
    }
    callbacks.onToken(result.content)
    callbacks.onComplete(result.content)
    return
  }

  const adapter = adapterFor(normalized.ai_provider)
  if (!adapter) {
    callbacks.onError('暂不支持当前 AI Provider')
    return
  }
  await adapter.stream(
    normalized,
    request.systemPrompt,
    request.userPrompt,
    callbacks,
    request.maxTokens,
    request.temperature,
    opts
  )
}

export async function aiComplete(
  config: AiCallerConfig,
  prompt: string,
  context: string,
  opts?: AiFetchOpts
): Promise<AiResponse> {
  return completeWithProvider(
    config,
    {
      systemPrompt:
        '你是一位优秀的网文作家助手。请根据已有内容自然地续写，保持风格一致。只输出续写内容，不要解释。',
      userPrompt: `${prompt}\n\n已有内容：\n${context}`,
      maxTokens: 500,
      temperature: 0.8
    },
    opts
  )
}

export async function aiPrompt(
  config: AiCallerConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200,
  temperature = 0.7,
  opts?: AiFetchOpts
): Promise<AiResponse> {
  return completeWithProvider(
    config,
    {
      systemPrompt,
      userPrompt,
      maxTokens,
      temperature
    },
    opts
  )
}

export async function aiPromptStream(
  config: AiCallerConfig,
  systemPrompt: string,
  userPrompt: string,
  callbacks: AiStreamCallbacks,
  maxTokens = 1200,
  temperature = 0.7,
  opts?: AiFetchOpts
): Promise<void> {
  await streamWithProvider(
    config,
    {
      systemPrompt,
      userPrompt,
      maxTokens,
      temperature
    },
    callbacks,
    opts
  )
}

export async function aiCompleteStream(
  config: AiCallerConfig,
  prompt: string,
  context: string,
  callbacks: AiStreamCallbacks,
  opts?: AiFetchOpts
): Promise<void> {
  await streamWithProvider(
    config,
    {
      systemPrompt:
        '你是一位优秀的网文作家助手。请根据已有内容自然地续写，保持风格一致。只输出续写内容，不要解释。',
      userPrompt: `${prompt}\n\n已有内容：\n${context}`,
      maxTokens: 500,
      temperature: 0.8
    },
    callbacks,
    opts
  )
}

export async function aiSummarize(
  config: AiCallerConfig,
  chapterContent: string,
  opts?: AiFetchOpts
): Promise<AiResponse> {
  return completeWithProvider(
    config,
    {
      systemPrompt:
        '你是编辑助理。请用两三句话概括本章剧情要点与情绪走向，客观中立，不要评价文笔。只输出摘要正文。',
      userPrompt: `请为下列章节正文生成摘要：\n\n${chapterContent}`,
      maxTokens: 400,
      temperature: 0.5
    },
    opts
  )
}

export async function aiAnalyzeStyle(
  config: AiCallerConfig,
  text: string,
  opts?: AiFetchOpts
): Promise<AiResponse> {
  return completeWithProvider(
    config,
    {
      systemPrompt:
        '你是文学风格分析师。阅读给定小说文本，输出一个 JSON 对象（不要 markdown 代码围栏），键为：句长均衡度、对话叙事比、用词丰富度、节奏感、画面感、情感张力，值均为 1-10 的整数；另含 "summary" 字符串键，为 2-4 句中文简评。只输出 JSON。',
      userPrompt: text.slice(0, 120000),
      maxTokens: 600,
      temperature: 0.4
    },
    opts
  )
}

export async function aiPolish(
  config: AiCallerConfig,
  text: string,
  opts?: AiFetchOpts
): Promise<AiResponse> {
  return completeWithProvider(
    config,
    {
      systemPrompt:
        '你是一位网文编辑，请润色以下文字，保持原意和风格，使文笔更加流畅生动。只输出润色后的文字。',
      userPrompt: text,
      maxTokens: 1000,
      temperature: 0.6
    },
    opts
  )
}

export async function aiGenerateNames(
  config: AiCallerConfig,
  genre: string,
  faction: string,
  count = 5,
  opts?: AiFetchOpts
): Promise<string[]> {
  const result = await completeWithProvider(
    config,
    {
      systemPrompt: '你是一位小说命名专家。请生成角色名字。只输出名字，每行一个，不要编号。',
      userPrompt: `请为一部${genre}题材的小说生成${count}个${faction}角色名字。`,
      maxTokens: 200,
      temperature: 0.9
    },
    opts
  )
  if (result.error) return []
  return result.content
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
}

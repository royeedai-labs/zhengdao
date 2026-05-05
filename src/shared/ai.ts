import type { AssistantPresentationMetadata } from './assistant-presentation'

export type AiProvider = 'zhengdao_official' | 'openai' | 'gemini' | 'gemini_cli' | 'ollama' | 'custom'

export interface AiOfficialProfile {
  id: string
  name: string
  category: string
  description: string
  default: boolean
  modelHint: 'fast' | 'balanced' | 'heavy'
}

export interface AiConfig {
  ai_provider: AiProvider
  ai_api_key: string
  ai_api_endpoint: string
  ai_model: string
  ai_official_profile_id?: string
}

export type AiCallerConfig = Omit<AiConfig, 'ai_provider'> & {
  ai_provider: AiProvider | string
  bookId?: number
  ragMode?: 'auto' | 'off'
}

export interface AiResponse {
  content: string
  error?: string
  metadata?: AssistantPresentationMetadata
}

export interface AiStreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullText: string, metadata?: AssistantPresentationMetadata) => void
  onError: (error: string) => void
}

export type AiFetchOpts = {
  signal?: AbortSignal
}

export interface AiBridgeCompleteRequest {
  provider: AiProvider
  model: string
  profileId?: string
  bookId?: number
  ragMode?: 'auto' | 'off'
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
}

export interface AiProviderAdapter {
  complete(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number,
    temperature?: number,
    opts?: AiFetchOpts
  ): Promise<AiResponse>
  stream(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
    callbacks: AiStreamCallbacks,
    maxTokens?: number,
    temperature?: number,
    opts?: AiFetchOpts
  ): Promise<void>
}

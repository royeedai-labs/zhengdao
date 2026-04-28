export type AiProviderUiMeta = {
  showApiKeyField: boolean
  apiKeyOptional: boolean
  apiKeyLabel: string
  apiKeyPlaceholder: string
  showEndpointField: boolean
  endpointPlaceholder: string
  modelPlaceholder: string
  supportsStatusCheck: boolean
  supportsAuthLaunch: boolean
}

const DEFAULT_META: AiProviderUiMeta = {
  showApiKeyField: true,
  apiKeyOptional: false,
  apiKeyLabel: 'API Key / Token',
  apiKeyPlaceholder: 'sk-...',
  showEndpointField: true,
  endpointPlaceholder: '可留空使用默认端点',
  modelPlaceholder: '可留空使用 provider 默认模型',
  supportsStatusCheck: true,
  supportsAuthLaunch: false
}

export function getAiProviderUiMeta(provider: string): AiProviderUiMeta {
  switch (provider) {
    case 'gemini':
      return {
        ...DEFAULT_META,
        apiKeyPlaceholder: 'Gemini API Key'
      }
    case 'gemini_cli':
      return {
        ...DEFAULT_META,
        showApiKeyField: false,
        showEndpointField: false,
        modelPlaceholder: '默认 gemini-3-pro-preview',
        supportsStatusCheck: true,
        supportsAuthLaunch: true
      }
    case 'ollama':
      return {
        ...DEFAULT_META,
        apiKeyOptional: true,
        apiKeyLabel: 'API Key（可选）',
        apiKeyPlaceholder: '本地通常无需填写',
        endpointPlaceholder: '可留空使用 http://localhost:11434',
        modelPlaceholder: 'llama3'
      }
    case 'custom':
      return {
        ...DEFAULT_META,
        apiKeyPlaceholder: '兼容服务 Token'
      }
    case 'openai':
    default:
      return DEFAULT_META
  }
}

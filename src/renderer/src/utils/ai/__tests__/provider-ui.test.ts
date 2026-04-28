import { describe, expect, it } from 'vitest'
import { getAiProviderUiMeta } from '../provider-ui'

describe('getAiProviderUiMeta', () => {
  it('treats Gemini CLI as an auth-based provider', () => {
    expect(getAiProviderUiMeta('gemini_cli')).toMatchObject({
      showApiKeyField: false,
      modelPlaceholder: '默认 gemini-3-pro-preview',
      supportsStatusCheck: true,
      supportsAuthLaunch: true
    })
  })

  it('keeps API-key providers on secret-based configuration with status checks', () => {
    expect(getAiProviderUiMeta('gemini')).toMatchObject({
      showApiKeyField: true,
      supportsStatusCheck: true,
      supportsAuthLaunch: false
    })
    expect(getAiProviderUiMeta('openai')).toMatchObject({
      showApiKeyField: true,
      supportsStatusCheck: true,
      supportsAuthLaunch: false
    })
  })
})

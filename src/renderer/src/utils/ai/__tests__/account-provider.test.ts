import { describe, expect, it } from 'vitest'
import { getAiAccountProviderUiMeta } from '../account-provider'

describe('getAiAccountProviderUiMeta', () => {
  it('treats Gemini CLI as an auth-based provider', () => {
    expect(getAiAccountProviderUiMeta('gemini_cli')).toMatchObject({
      showApiKeyField: false,
      modelPlaceholder: '默认 gemini-3-pro-preview',
      supportsStatusCheck: true,
      supportsAuthLaunch: true
    })
  })

  it('keeps API-key providers on secret-based configuration', () => {
    expect(getAiAccountProviderUiMeta('gemini')).toMatchObject({
      showApiKeyField: true,
      supportsStatusCheck: false,
      supportsAuthLaunch: false
    })
    expect(getAiAccountProviderUiMeta('openai')).toMatchObject({
      showApiKeyField: true,
      supportsStatusCheck: false,
      supportsAuthLaunch: false
    })
  })
})

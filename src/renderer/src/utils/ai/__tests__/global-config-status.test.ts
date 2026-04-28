import { describe, expect, it } from 'vitest'
import { buildAiGlobalConfigStatusRequest } from '../global-config-status'

describe('buildAiGlobalConfigStatusRequest', () => {
  it('passes the in-progress global API key for status checks', () => {
    expect(
      buildAiGlobalConfigStatusRequest({
        provider: 'openai',
        api_endpoint: 'http://127.0.0.1:8045/v1',
        model: 'gemini-3-flash',
        api_key: 'local-token'
      }, true)
    ).toEqual({
      provider: 'openai',
      options: {
        probe: true,
        config: {
          api_key: 'local-token',
          api_endpoint: 'http://127.0.0.1:8045/v1',
          model: 'gemini-3-flash'
        }
      }
    })
  })

  it('omits saved config ids because there is only one global config', () => {
    expect(
      buildAiGlobalConfigStatusRequest({
        provider: 'custom',
        api_endpoint: 'https://example.test/v1',
        model: 'gpt-4o-mini',
        api_key: ''
      })
    ).toEqual({
      provider: 'custom',
      options: {
        probe: false,
        config: {
          api_key: '',
          api_endpoint: 'https://example.test/v1',
          model: 'gpt-4o-mini'
        }
      }
    })
  })
})

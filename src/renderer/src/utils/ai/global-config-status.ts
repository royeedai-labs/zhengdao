export type AiGlobalConfigStatusDraft = {
  provider: string
  api_endpoint: string
  model: string
  api_key: string
}

export type AiGlobalConfigStatusRequest = {
  provider: string
  options: {
    probe: boolean
    config: {
      api_key: string
      api_endpoint: string
      model: string
    }
  }
}

export function buildAiGlobalConfigStatusRequest(
  draft: AiGlobalConfigStatusDraft,
  probe = false
): AiGlobalConfigStatusRequest {
  return {
    provider: draft.provider,
    options: {
      probe,
      config: {
        api_key: draft.api_key,
        api_endpoint: draft.api_endpoint,
        model: draft.model
      }
    }
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiBridgeCompleteRequest } from '../../../shared/ai'

vi.mock('../local-rag-service', () => ({
  formatLocalRagPrompt: vi.fn(() => ''),
  retrieveLocalBookSnippets: vi.fn(() => [])
}))

import { completeOfficialAi, streamOfficialAi } from '../official-ai-service'

const fetchMock = vi.fn()

function request(maxTokens: number): AiBridgeCompleteRequest {
  return {
    provider: 'zhengdao_official',
    model: 'balanced',
    profileId: 'profile-1',
    ragMode: 'off',
    systemPrompt: 'system',
    userPrompt: 'user',
    maxTokens,
    temperature: 0.7
  }
}

function sseResponse(payload: string): Response {
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload))
        controller.close()
      }
    })
  } as Response
}

describe('official AI service', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('passes desktop maxTokens to the backend output budget', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: { content: 'ok' } })
    })

    await completeOfficialAi(request(4200), 'token')

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      modelHint: 'balanced',
      maxOutputTokens: 4200,
      stream: false
    })
  })

  it('caps streamed official AI output budget before sending the request', async () => {
    fetchMock.mockResolvedValue(sseResponse('event: done\ndata: {}\n\n'))

    const session = streamOfficialAi(request(7000), 'token', {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn()
    })
    await session.done

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      maxOutputTokens: 6000,
      stream: true
    })
  })
})

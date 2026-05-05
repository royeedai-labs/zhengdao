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

function chunkedSseResponse(chunks: string[]): Response {
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
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
      text: async () =>
        JSON.stringify({
          message: {
            content: 'ok',
            metadata: {
              authorThought: {
                style: 'author_inner_monologue',
                title: '作者思路模拟',
                lines: ['我得先把人物诉求说透。', '我这里不能只给空建议。']
              }
            }
          }
        })
    })

    const result = await completeOfficialAi(request(4200), 'token')

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      modelHint: 'balanced',
      maxOutputTokens: 4200,
      stream: false
    })
    expect(result.metadata?.authorThought?.lines).toHaveLength(2)
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

  it('streams CRLF-separated official AI events', async () => {
    fetchMock.mockResolvedValue(chunkedSseResponse([
      'event: delta\r\n',
      'data: {"text":"甲"}\r\n\r\n',
      'event: presentation\r\n',
      'data: {"authorThought":{"style":"author_inner_monologue","title":"作者思路模拟","lines":["我这里要先把目标压实。","我得保住这一段的推进感。"]}}\r\n\r\n',
      'event: done\r\n',
      'data: {}\r\n\r\n'
    ]))
    const onToken = vi.fn()
    const onComplete = vi.fn()
    const onError = vi.fn()

    const session = streamOfficialAi(request(1000), 'token', {
      onToken,
      onComplete,
      onError
    })
    await session.done

    expect(onToken).toHaveBeenCalledWith('甲')
    expect(onComplete).toHaveBeenCalledWith('甲', {
      authorThought: {
        style: 'author_inner_monologue',
        title: '作者思路模拟',
        lines: ['我这里要先把目标压实。', '我得保住这一段的推进感。']
      }
    })
    expect(onError).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirectorEvent } from '../../../shared/director'

vi.mock('../../database/ai-assistant-repo', () => ({
  createAiDraft: vi.fn()
}))

vi.mock('../../database/pro-feature-repo', () => ({
  getDirectorRunLinkByRemoteId: vi.fn(),
  listDirectorChapterCache: vi.fn(),
  listDirectorRunLinks: vi.fn(),
  updateDirectorRunStatus: vi.fn(),
  upsertDirectorChapterCache: vi.fn(),
  upsertDirectorRunLink: vi.fn()
}))

import { subscribeDirectorProgress } from '../director-service'

const fetchMock = vi.fn()

function sseResponse(chunks: string[]): Response {
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

function directorEvent(runId = 'run-1'): DirectorEvent {
  return {
    type: 'run_started',
    runId,
    genre: 'webnovel',
    seed: 'seed',
    ts: '2026-05-01T00:00:00.000Z'
  }
}

async function collectDirectorEvents(chunks: string[]): Promise<DirectorEvent[]> {
  fetchMock.mockResolvedValueOnce(sseResponse(chunks))
  const events: DirectorEvent[] = []
  await new Promise<void>((resolve, reject) => {
    subscribeDirectorProgress('run-1', 'token', {
      onEvent: (event) => events.push(event),
      onError: reject,
      onDone: resolve
    })
  })
  return events
}

describe('director service progress SSE parsing', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('parses LF-separated Director events', async () => {
    const event = directorEvent('lf-run')
    const events = await collectDirectorEvents([`data: ${JSON.stringify(event)}\n\n`])

    expect(events).toEqual([event])
  })

  it('parses CRLF-separated Director events', async () => {
    const event = directorEvent('crlf-run')
    const events = await collectDirectorEvents([`data: ${JSON.stringify(event)}\r\n\r\n`])

    expect(events).toEqual([event])
  })

  it('keeps a partial Director event across chunks', async () => {
    const event = directorEvent('partial-run')
    const payload = `data: ${JSON.stringify(event)}\r\n\r\n`
    const events = await collectDirectorEvents([payload.slice(0, 12), payload.slice(12)])

    expect(events).toEqual([event])
  })

  it('joins multiple Director data lines before parsing JSON', async () => {
    const events = await collectDirectorEvents([
      [
        'data: {',
        'data: "type": "run_started",',
        'data: "runId": "multi-line-run",',
        'data: "genre": "webnovel",',
        'data: "seed": "seed",',
        'data: "ts": "2026-05-01T00:00:00.000Z"',
        'data: }',
        '',
        ''
      ].join('\r\n')
    ])

    expect(events).toEqual([directorEvent('multi-line-run')])
  })

  it('ignores invalid Director JSON and keeps parsing later events', async () => {
    const event = directorEvent('valid-run')
    const events = await collectDirectorEvents([
      `data: not-json\r\n\r\ndata: ${JSON.stringify(event)}\r\n\r\n`
    ])

    expect(events).toEqual([event])
  })
})

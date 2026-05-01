import * as aiAssistantRepo from '../database/ai-assistant-repo'
import {
  getDirectorRunLinkByRemoteId,
  listDirectorChapterCache,
  listDirectorRunLinks,
  updateDirectorRunStatus,
  upsertDirectorChapterCache,
  upsertDirectorRunLink
} from '../database/pro-feature-repo'
import type {
  DirectorAcceptChapterInput,
  DirectorAcceptChapterResult,
  DirectorEvent,
  DirectorRemoteChapter,
  DirectorRemoteRun,
  DirectorRunLink,
  DirectorStepName,
  DirectorStartRunInput,
  DirectorStartRunResult
} from '../../shared/director'
import { parseSseBlock, splitSseBlocks } from './sse-parser'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

async function apiRequest<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  if (!token) throw new Error('请先登录证道账号后使用 Pro 自动导演')
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  })
  const text = await response.text()
  let payload = {} as T
  if (text) {
    try {
      payload = JSON.parse(text) as T
    } catch {
      if (response.ok) throw new Error('Pro 自动导演响应格式异常')
    }
  }
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message?: string }).message)
        : text
    throw new Error(message || `Pro 自动导演请求失败 (${response.status})`)
  }
  return payload
}

export async function startDirectorRun(
  input: DirectorStartRunInput,
  token: string | null
): Promise<DirectorStartRunResult> {
  const result = await apiRequest<{ runId: string; status: string }>('/director/runs', token, {
    method: 'POST',
    body: JSON.stringify({
      seed: input.seed,
      genre: input.genre,
      options: input.options
    })
  })
  const link = upsertDirectorRunLink({
    bookId: input.bookId,
    remoteRunId: result.runId,
    seed: input.seed,
    genre: input.genre,
    status: result.status === 'scheduled' ? 'pending' : 'running'
  })
  return { runId: result.runId, link }
}

export async function getDirectorRun(runId: string, token: string | null): Promise<DirectorRemoteRun> {
  const run = await apiRequest<DirectorRemoteRun>(`/director/runs/${encodeURIComponent(runId)}`, token)
  updateDirectorRunStatus(runId, run.status)
  return run
}

export async function pauseDirectorRun(runId: string, token: string | null): Promise<DirectorRemoteRun> {
  const run = await apiRequest<DirectorRemoteRun>(
    `/director/runs/${encodeURIComponent(runId)}/pause`,
    token,
    { method: 'POST' }
  )
  updateDirectorRunStatus(runId, run.status)
  return run
}

export async function resumeDirectorRun(runId: string, token: string | null): Promise<DirectorRemoteRun> {
  const run = await apiRequest<DirectorRemoteRun>(
    `/director/runs/${encodeURIComponent(runId)}/resume`,
    token,
    { method: 'POST' }
  )
  updateDirectorRunStatus(runId, run.status)
  return run
}

export async function cancelDirectorRun(runId: string, token: string | null): Promise<DirectorRemoteRun> {
  const run = await apiRequest<DirectorRemoteRun>(
    `/director/runs/${encodeURIComponent(runId)}/cancel`,
    token,
    { method: 'POST' }
  )
  updateDirectorRunStatus(runId, run.status)
  return run
}

export async function regenerateDirectorStep(
  runId: string,
  stepName: DirectorStepName,
  token: string | null
): Promise<DirectorRemoteRun> {
  const run = await apiRequest<DirectorRemoteRun>(
    `/director/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepName)}/regenerate`,
    token,
    { method: 'POST' }
  )
  updateDirectorRunStatus(runId, run.status)
  return run
}

export async function listDirectorRuns(bookId: number): Promise<DirectorRunLink[]> {
  return listDirectorRunLinks(bookId)
}

export async function listDirectorChapters(runId: string, token: string | null) {
  const link = getDirectorRunLinkByRemoteId(runId)
  if (!link) return []
  const result = await apiRequest<{ chapters: DirectorRemoteChapter[] }>(
    `/director/runs/${encodeURIComponent(runId)}/chapters`,
    token
  )
  for (const chapter of result.chapters) {
    upsertDirectorChapterCache(link.id, chapter)
  }
  return listDirectorChapterCache(link.id)
}

export async function acceptDirectorChapter(
  input: DirectorAcceptChapterInput,
  token: string | null
): Promise<DirectorAcceptChapterResult> {
  const link = getDirectorRunLinkByRemoteId(input.runId)
  if (!link) throw new Error('本地未找到该 Director run')
  const remote = await apiRequest<DirectorRemoteChapter>(
    `/director/runs/${encodeURIComponent(input.runId)}/chapters/${encodeURIComponent(input.chapterId)}/accept`,
    token,
    { method: 'POST' }
  )
  const chapter = upsertDirectorChapterCache(link.id, remote)
  const draft = aiAssistantRepo.createAiDraft({
    book_id: input.bookId,
    kind: 'create_chapter',
    title: remote.title || `第 ${remote.chapterIndex} 章`,
    payload: {
      title: remote.title,
      content: remote.content,
      source: 'director',
      runId: input.runId,
      chapterId: input.chapterId,
      chapterIndex: remote.chapterIndex,
      metadata: remote.metadata
    },
    target_ref: `director:${input.runId}:${input.chapterId}`
  })
  return { chapter, draft }
}

export async function rejectDirectorChapter(runId: string, chapterId: string, token: string | null) {
  const link = getDirectorRunLinkByRemoteId(runId)
  if (!link) throw new Error('本地未找到该 Director run')
  const remote = await apiRequest<DirectorRemoteChapter>(
    `/director/runs/${encodeURIComponent(runId)}/chapters/${encodeURIComponent(chapterId)}/reject`,
    token,
    { method: 'POST' }
  )
  return upsertDirectorChapterCache(link.id, remote)
}

function parseSseEvents(buffer: string): { events: DirectorEvent[]; rest: string } {
  const events: DirectorEvent[] = []
  const { blocks, rest } = splitSseBlocks(buffer)
  for (const block of blocks) {
    const parsed = parseSseBlock(block)
    if (!parsed) continue
    try {
      events.push(JSON.parse(parsed.data) as DirectorEvent)
    } catch {
      void 0
    }
  }
  return { events, rest }
}

export function subscribeDirectorProgress(
  runId: string,
  token: string | null,
  handlers: {
    onEvent: (event: DirectorEvent) => void
    onError: (message: string) => void
    onDone: () => void
  }
): () => void {
  if (!token) throw new Error('请先登录证道账号后订阅 Pro 自动导演进度')
  const controller = new AbortController()

  void (async () => {
    try {
      const response = await fetch(`${API_BASE}/director/runs/${encodeURIComponent(runId)}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      })
      if (!response.ok || !response.body) {
        handlers.onError(`Pro 自动导演进度订阅失败 (${response.status})`)
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parsed = parseSseEvents(buffer)
        buffer = parsed.rest
        for (const event of parsed.events) handlers.onEvent(event)
      }
      handlers.onDone()
    } catch (error) {
      if (controller.signal.aborted) return
      handlers.onError(error instanceof Error ? error.message : String(error))
    }
  })()

  return () => controller.abort()
}

import type {
  WritingIntelApiResult,
  WritingIntelGenreStatsResponse,
  WritingIntelInsightsResponse,
  WritingIntelOverviewResponse,
  WritingIntelQuery,
  WritingIntelRankingsResponse,
  WritingIntelSourcesResponse
} from '../../shared/writing-intel'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

function buildPath(path: string, query: WritingIntelQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

async function publicRequest<T>(path: string, query?: WritingIntelQuery): Promise<WritingIntelApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${buildPath(path, query)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: 'NETWORK_ERROR'
    }
  }

  const text = await response.text()
  let payload: unknown = {}
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      return { ok: false, error: '写作情报服务响应格式异常', code: 'BAD_RESPONSE' }
    }
  }

  if (!response.ok) {
    const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const message =
      typeof body.message === 'string'
        ? body.message
        : `写作情报服务请求失败 (${response.status})`
    const code = typeof body.code === 'string' ? body.code : `HTTP_${response.status}`
    return { ok: false, error: message, code }
  }

  return { ok: true, data: payload as T }
}

export function listSources(query?: Pick<WritingIntelQuery, 'platform' | 'limit'>) {
  return publicRequest<WritingIntelSourcesResponse>('/writing-intel/sources', query)
}

export function getOverview(query?: Pick<WritingIntelQuery, 'platform' | 'limit'>) {
  return publicRequest<WritingIntelOverviewResponse>('/writing-intel/overview', query)
}

export function listGenreStats(query?: WritingIntelQuery) {
  return publicRequest<WritingIntelGenreStatsResponse>('/writing-intel/genre-stats', query)
}

export function listRankings(query?: WritingIntelQuery) {
  return publicRequest<WritingIntelRankingsResponse>('/writing-intel/rankings', query)
}

export function listTrends(query?: WritingIntelQuery) {
  return publicRequest<WritingIntelRankingsResponse>('/writing-intel/trends', query)
}

export function listInsights(query?: WritingIntelQuery) {
  return publicRequest<WritingIntelInsightsResponse>('/writing-intel/insights', query)
}

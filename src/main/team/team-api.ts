// DI-06 v2 — 桌面端团队 API 客户端
//
// 调用 agent.xiangweihu.com /v1/teams/* 路由, 使用证道账号 token (与
// official-ai-service / skill-execute-service 共享同一份 token 来源)。
//
// 所有方法返回 { ok, data?, error?, code? } 结构, IPC handler 把 ok=false
// 的情况转成业务字段, 桌面端 store 按 code 做 i18n。

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

export interface TeamSummary {
  id: string
  name: string
  plan: string
  seatLimit: number
  ownerUserId: string
  myRole?: 'owner' | 'admin' | 'member'
  joinedAt?: string
  createdAt: string
}

export interface TeamMember {
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

export interface TeamInvitation {
  id: string
  teamId: string
  email: string
  role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  token?: string
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
}

export interface TeamApiResult<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

async function apiRequest<T>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown
): Promise<TeamApiResult<T>> {
  if (!token) return { ok: false, error: '请先登录证道账号', code: 'UNAUTHENTICATED' }
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: 'NETWORK_ERROR'
    }
  }

  const text = await response.text()
  let payload: Record<string, unknown> = {}
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>
    } catch {
      if (response.ok) {
        return { ok: false, error: '团队服务响应格式异常', code: 'BAD_RESPONSE' }
      }
    }
  }

  if (!response.ok) {
    const code = typeof payload.code === 'string' ? payload.code : `HTTP_${response.status}`
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : `团队服务请求失败 (${response.status})`
    return { ok: false, error: message, code }
  }

  return { ok: true, data: payload as T }
}

export function listMyTeams(token: string | null) {
  return apiRequest<{ teams: TeamSummary[] }>('GET', '/teams', token)
}

export function createTeam(
  token: string | null,
  body: { name: string; plan?: string; seatLimit?: number }
) {
  return apiRequest<{ team: TeamSummary }>('POST', '/teams', token, body)
}

export function listTeamMembers(token: string | null, teamId: string) {
  return apiRequest<{ members: TeamMember[] }>('GET', `/teams/${encodeURIComponent(teamId)}/members`, token)
}

export function removeTeamMember(token: string | null, teamId: string, userId: string) {
  return apiRequest<{ ok: true }>(
    'DELETE',
    `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
    token
  )
}

export function listTeamInvitations(token: string | null, teamId: string) {
  return apiRequest<{ invitations: TeamInvitation[] }>(
    'GET',
    `/teams/${encodeURIComponent(teamId)}/invitations`,
    token
  )
}

export function createTeamInvitation(
  token: string | null,
  teamId: string,
  body: { email: string; role?: 'admin' | 'member'; expiresInHours?: number }
) {
  return apiRequest<{ invitation: TeamInvitation }>(
    'POST',
    `/teams/${encodeURIComponent(teamId)}/invitations`,
    token,
    body
  )
}

export function revokeTeamInvitation(token: string | null, teamId: string, invitationId: string) {
  return apiRequest<{ ok: true }>(
    'DELETE',
    `/teams/${encodeURIComponent(teamId)}/invitations/${encodeURIComponent(invitationId)}`,
    token
  )
}

export function acceptInvitationByToken(token: string | null, invitationToken: string) {
  return apiRequest<{ team: TeamSummary; role: 'owner' | 'admin' | 'member' }>(
    'POST',
    `/teams/invitations/${encodeURIComponent(invitationToken)}/accept`,
    token
  )
}

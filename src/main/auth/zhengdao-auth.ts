import { shell } from 'electron'
import * as appStateRepo from '../database/app-state-repo'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl)
    const normalized = hostname.replace(/^\[|\]$/g, '')
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
  } catch {
    return false
  }
}

function buildDesktopLoginUrl(state: string): string {
  const url = new URL('/login', `${WEBSITE_URL}/`)
  url.searchParams.set('client', 'desktop')
  url.searchParams.set('desktop_state', state)
  return url.toString()
}

function resolveDesktopLoginUrl(session: { state: string; loginUrl?: string }): string {
  if (!session.loginUrl) return buildDesktopLoginUrl(session.state)

  try {
    const url = new URL(session.loginUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return buildDesktopLoginUrl(session.state)
    if (isLoopbackUrl(session.loginUrl) && !isLoopbackUrl(API_BASE)) return buildDesktopLoginUrl(session.state)
    return url.toString()
  } catch {
    return buildDesktopLoginUrl(session.state)
  }
}

export interface ZhengdaoUser {
  id: string
  email: string
  displayName?: string | null
  role: 'user' | 'admin'
  tier: 'free' | 'pro' | 'team'
  pro: boolean
  pointsBalance: number
  emailVerified: boolean
}

const KEYS = {
  token: 'zhengdao_auth_token',
  user: 'zhengdao_auth_user',
  pendingState: 'zhengdao_auth_pending_state'
} as const

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  const text = await res.text()
  const payload = text ? JSON.parse(text) as T : ({} as T)
  if (!res.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: string }).message)
      : text
    throw new Error(message || `证道账号请求失败 (${res.status})`)
  }
  return payload
}

export class ZhengdaoAuth {
  async login(): Promise<{ ok: boolean; loginUrl?: string; error?: string }> {
    try {
      const session = await apiRequest<{ state: string; loginUrl: string }>('/auth/desktop/start', {
        method: 'POST',
        body: JSON.stringify({})
      })
      appStateRepo.setAppState(KEYS.pendingState, session.state)
      const loginUrl = resolveDesktopLoginUrl(session)
      await shell.openExternal(loginUrl)
      return { ok: true, loginUrl }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async openUpgradePage(): Promise<void> {
    await shell.openExternal(`${WEBSITE_URL}/pricing?from=desktop#pro-cdk`)
  }

  async openAccountPage(): Promise<void> {
    await shell.openExternal(`${WEBSITE_URL}/app/account`)
  }

  async openCommunityFeedbackPage(): Promise<void> {
    await shell.openExternal(`${WEBSITE_URL}/community/new?category=feedback`)
  }

  async handleCallback(url: string): Promise<ZhengdaoUser> {
    const parsed = new URL(url)
    const state = parsed.searchParams.get('state')
    const code = parsed.searchParams.get('code')
    const expectedState = appStateRepo.getAppState(KEYS.pendingState)
    if (!state || !code || state !== expectedState) throw new Error('证道账号登录回调无效')

    const exchanged = await apiRequest<{ token: string; user: ZhengdaoUser }>('/auth/desktop/exchange', {
      method: 'POST',
      body: JSON.stringify({ state, code })
    })
    appStateRepo.setAppState(KEYS.token, exchanged.token)
    appStateRepo.deleteAppState(KEYS.pendingState)
    const user = await this.refreshUser(exchanged.token)
    return user ?? exchanged.user
  }

  async getUser(): Promise<ZhengdaoUser | null> {
    const token = await this.getAccessToken()
    if (token) {
      const refreshed = await this.refreshUser(token).catch(() => null)
      if (refreshed) return refreshed
    }
    return parseJson<ZhengdaoUser>(appStateRepo.getAppState(KEYS.user))
  }

  async getAccessToken(): Promise<string | null> {
    return appStateRepo.getAppState(KEYS.token)
  }

  async logout(): Promise<void> {
    appStateRepo.deleteAppState(KEYS.token)
    appStateRepo.deleteAppState(KEYS.user)
    appStateRepo.deleteAppState(KEYS.pendingState)
  }

  private async refreshUser(token: string): Promise<ZhengdaoUser | null> {
    const res = await apiRequest<{ user: ZhengdaoUser }>('/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    appStateRepo.setAppState(KEYS.user, JSON.stringify(res.user))
    return res.user
  }
}

import { shell } from 'electron'
import * as appStateRepo from '../database/app-state-repo'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

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

export interface ZhengdaoAuthCredentials {
  email: string
  password: string
}

export interface ZhengdaoRegisterInput extends ZhengdaoAuthCredentials {
  code: string
  displayName?: string
}

export type ZhengdaoAuthResult =
  | { ok: true; user: ZhengdaoUser }
  | { ok: false; error: string }

export type ZhengdaoRegistrationCodeResult =
  | { ok: true; devVerificationCode?: string }
  | { ok: false; error: string }

class ZhengdaoAuthRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ZhengdaoAuthRequestError'
  }
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

function isAuthExpiredError(error: unknown): error is ZhengdaoAuthRequestError {
  return error instanceof ZhengdaoAuthRequestError && error.status === 401
}

function requestErrorMessage(status: number, path: string, message: string): string {
  if (status === 401 && path === '/auth/login') return '邮箱或密码不正确'
  if (status === 401) return '登录状态已过期，请重新登录'
  if (status === 403 && /email not verified/i.test(message)) return '邮箱尚未验证，请先完成邮箱验证码验证'
  if (status === 409 && /email already registered/i.test(message)) return '邮箱已注册，请直接登录'
  if (status === 400 && /invalid or expired code/i.test(message)) return '验证码无效或已过期'
  if (status === 503 && /SMTP not configured/i.test(message)) return '邮件服务暂不可用，请稍后重试'
  return message || `证道账号请求失败 (${status})`
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
    throw new ZhengdaoAuthRequestError(res.status, requestErrorMessage(res.status, path, message))
  }
  return payload
}

export class ZhengdaoAuth {
  async login(input: ZhengdaoAuthCredentials): Promise<ZhengdaoAuthResult> {
    try {
      const response = await apiRequest<{ token: string; user: ZhengdaoUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input)
      })
      const user = await this.persistSession(response.token, response.user)
      return { ok: true, user }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async sendRegistrationCode(email: string): Promise<ZhengdaoRegistrationCodeResult> {
    try {
      const response = await apiRequest<{ ok: true; devVerificationCode?: string }>('/auth/register/code', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      return response
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async register(input: ZhengdaoRegisterInput): Promise<ZhengdaoAuthResult> {
    try {
      const response = await apiRequest<{ token: string; user: ZhengdaoUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input)
      })
      const user = await this.persistSession(response.token, response.user)
      return { ok: true, user }
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
      const refreshed = await this.refreshUser(token).catch(async (error) => {
        if (isAuthExpiredError(error)) {
          await this.logout()
          return null
        }
        return null
      })
      if (refreshed) return refreshed
    }
    return parseJson<ZhengdaoUser>(appStateRepo.getAppState(KEYS.user))
  }

  async getAccessToken(): Promise<string | null> {
    return appStateRepo.getAppState(KEYS.token)
  }

  async getValidAccessToken(): Promise<string | null> {
    const token = await this.getAccessToken()
    if (!token) return null
    try {
      await this.refreshUser(token)
      return token
    } catch (error) {
      if (isAuthExpiredError(error)) {
        await this.logout()
        return null
      }
      return token
    }
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

  private async persistSession(token: string, fallbackUser: ZhengdaoUser): Promise<ZhengdaoUser> {
    appStateRepo.setAppState(KEYS.token, token)
    appStateRepo.deleteAppState(KEYS.pendingState)
    appStateRepo.setAppState(KEYS.user, JSON.stringify(fallbackUser))
    return (await this.refreshUser(token).catch(() => null)) ?? fallbackUser
  }
}

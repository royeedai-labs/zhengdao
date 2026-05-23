import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
  fetch: vi.fn(),
  appState: new Map<string, string>()
}))

vi.mock('electron', () => ({
  shell: {
    openExternal: mocks.openExternal
  }
}))

vi.mock('../../database/app-state-repo', () => ({
  getAppState: vi.fn((key: string) => mocks.appState.get(key) ?? null),
  setAppState: vi.fn((key: string, value: string) => {
    mocks.appState.set(key, value)
  }),
  deleteAppState: vi.fn((key: string) => {
    mocks.appState.delete(key)
  })
}))

const accountUser = {
  id: 'user-1',
  email: 'author@example.com',
  role: 'user',
  tier: 'pro',
  pro: true,
  pointsBalance: 100,
  emailVerified: true
}

async function createAuth() {
  const { ZhengdaoAuth } = await import('../zhengdao-auth')
  return new ZhengdaoAuth()
}

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('ZhengdaoAuth account credentials', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    mocks.openExternal.mockReset()
    mocks.openExternal.mockResolvedValue(undefined)
    mocks.fetch.mockReset()
    mocks.appState.clear()
    delete process.env.ZHENGDAO_WEBSITE_URL
    delete process.env.ZHENGDAO_API_URL
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('logs in with email/password and stores the token and refreshed user', async () => {
    mocks.fetch
      .mockResolvedValueOnce(mockJsonResponse({ token: 'session-token', user: accountUser }))
      .mockResolvedValueOnce(mockJsonResponse({ user: { ...accountUser, pointsBalance: 120 } }))

    const result = await (await createAuth()).login({ email: 'author@example.com', password: 'password123' })

    expect(result).toEqual({ ok: true, user: { ...accountUser, pointsBalance: 120 } })
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      'https://agent.xiangweihu.com/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'author@example.com', password: 'password123' })
      })
    )
    expect(mocks.appState.get('zhengdao_auth_token')).toBe('session-token')
    expect(JSON.parse(mocks.appState.get('zhengdao_auth_user') ?? '{}')).toMatchObject({ pointsBalance: 120 })
  })

  it('returns a user-facing error for invalid credentials', async () => {
    mocks.fetch.mockResolvedValueOnce(mockJsonResponse({ message: 'invalid credentials' }, 401))

    const result = await (await createAuth()).login({ email: 'author@example.com', password: 'wrong-password' })

    expect(result).toEqual({ ok: false, error: '邮箱或密码不正确' })
    expect(mocks.appState.has('zhengdao_auth_token')).toBe(false)
  })

  it('sends a registration code without storing auth state', async () => {
    mocks.fetch.mockResolvedValueOnce(mockJsonResponse({ ok: true, devVerificationCode: '123456' }))

    const result = await (await createAuth()).sendRegistrationCode('author@example.com')

    expect(result).toEqual({ ok: true, devVerificationCode: '123456' })
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://agent.xiangweihu.com/api/v1/auth/register/code',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'author@example.com' })
      })
    )
    expect(mocks.appState.has('zhengdao_auth_token')).toBe(false)
  })

  it('registers with email code and password, then stores the session', async () => {
    mocks.fetch
      .mockResolvedValueOnce(mockJsonResponse({ token: 'registered-token', user: accountUser }))
      .mockResolvedValueOnce(mockJsonResponse({ user: accountUser }))

    const result = await (await createAuth()).register({
      email: 'author@example.com',
      password: 'password123',
      code: '123456'
    })

    expect(result).toEqual({ ok: true, user: accountUser })
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      'https://agent.xiangweihu.com/api/v1/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'author@example.com', password: 'password123', code: '123456' })
      })
    )
    expect(mocks.appState.get('zhengdao_auth_token')).toBe('registered-token')
  })

  it('clears cached auth state when the stored token is rejected', async () => {
    mocks.appState.set('zhengdao_auth_token', 'expired-token')
    mocks.appState.set('zhengdao_auth_user', JSON.stringify(accountUser))
    mocks.fetch.mockResolvedValueOnce(mockJsonResponse({ message: 'missing or invalid token' }, 401))

    const user = await (await createAuth()).getUser()

    expect(user).toBeNull()
    expect(mocks.appState.has('zhengdao_auth_token')).toBe(false)
    expect(mocks.appState.has('zhengdao_auth_user')).toBe(false)
  })
})

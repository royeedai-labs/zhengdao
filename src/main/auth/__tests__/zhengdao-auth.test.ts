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

function mockDesktopStartResponse(body: { state: string; loginUrl?: string }): void {
  mocks.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body)
  } as Response)
}

async function createAuth() {
  const { ZhengdaoAuth } = await import('../zhengdao-auth')
  return new ZhengdaoAuth()
}

describe('ZhengdaoAuth login', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    mocks.openExternal.mockReset()
    mocks.fetch.mockReset()
    mocks.appState.clear()
    delete process.env.ZHENGDAO_WEBSITE_URL
    delete process.env.ZHENGDAO_API_URL
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('opens the backend desktop login URL and stores the pending state', async () => {
    const loginUrl = 'https://agent.xiangweihu.com/login?client=desktop&desktop_state=state-1'
    mockDesktopStartResponse({ state: 'state-1', loginUrl })

    const result = await (await createAuth()).login()

    expect(result).toEqual({ ok: true, loginUrl })
    expect(mocks.appState.get('zhengdao_auth_pending_state')).toBe('state-1')
    expect(mocks.openExternal).toHaveBeenCalledWith(loginUrl)
  })

  it('rewrites a loopback login URL to the configured official website when the API is not local', async () => {
    mockDesktopStartResponse({
      state: 'state-prod',
      loginUrl: 'http://localhost:3000/login?client=desktop&desktop_state=state-prod'
    })

    const result = await (await createAuth()).login()

    const expected = 'https://agent.xiangweihu.com/login?client=desktop&desktop_state=state-prod'
    expect(result).toEqual({ ok: true, loginUrl: expected })
    expect(mocks.openExternal).toHaveBeenCalledWith(expected)
  })

  it('keeps loopback login URLs for local desktop auth development', async () => {
    process.env.ZHENGDAO_WEBSITE_URL = 'http://localhost:3000'
    process.env.ZHENGDAO_API_URL = 'http://localhost:8787/v1'
    const loginUrl = 'http://localhost:3000/login?client=desktop&desktop_state=state-local'
    mockDesktopStartResponse({ state: 'state-local', loginUrl })

    const result = await (await createAuth()).login()

    expect(result).toEqual({ ok: true, loginUrl })
    expect(mocks.openExternal).toHaveBeenCalledWith(loginUrl)
  })

  it('falls back to a desktop login URL when the backend omits one', async () => {
    mockDesktopStartResponse({ state: 'state-fallback' })

    const result = await (await createAuth()).login()

    const expected = 'https://agent.xiangweihu.com/login?client=desktop&desktop_state=state-fallback'
    expect(result).toEqual({ ok: true, loginUrl: expected })
    expect(mocks.openExternal).toHaveBeenCalledWith(expected)
  })
})

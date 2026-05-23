import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type ZhengdaoUser } from '../auth-store'

const proUser: ZhengdaoUser = {
  id: 'u1',
  email: 'u1@example.test',
  role: 'user',
  tier: 'pro',
  pro: true,
  pointsBalance: 0,
  emailVerified: true
}

describe('auth store official sync defaults', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({
      user: null,
      loading: false,
      syncing: false,
      syncEnabled: false,
      lastBookSyncAt: null
    })
  })

  it('defaults official sync on for Pro users when no explicit setting exists', async () => {
    vi.stubGlobal('window', {
      api: {
        authGetUser: vi.fn(async () => proUser),
        getAppState: vi.fn(async () => null)
      }
    })

    await useAuthStore.getState().loadUser()

    expect(useAuthStore.getState().syncEnabled).toBe(true)
  })

  it('honors an explicit manual opt-out', async () => {
    vi.stubGlobal('window', {
      api: {
        authGetUser: vi.fn(async () => proUser),
        getAppState: vi.fn(async (key: string) => (key === 'zhengdao_sync_enabled' ? '0' : null))
      }
    })

    await useAuthStore.getState().loadUser()

    expect(useAuthStore.getState().syncEnabled).toBe(false)
  })

  it('does not read the legacy Google Drive sync toggle', async () => {
    const getAppState = vi.fn(async (key: string) => (key === 'google_sync_enabled' ? '1' : null))
    vi.stubGlobal('window', {
      api: {
        authGetUser: vi.fn(async () => ({ ...proUser, pro: false, tier: 'free' })),
        getAppState
      }
    })

    await useAuthStore.getState().loadUser()

    expect(useAuthStore.getState().syncEnabled).toBe(false)
    expect(getAppState).toHaveBeenCalledWith('zhengdao_sync_enabled')
    expect(getAppState).not.toHaveBeenCalledWith('google_sync_enabled')
  })

  it('stores the returned user after direct email login succeeds', async () => {
    const authLogin = vi.fn(async () => ({ ok: true, user: proUser }))
    vi.stubGlobal('window', {
      api: {
        authLogin
      }
    })

    const result = await useAuthStore.getState().login({ email: 'u1@example.test', password: 'password123' })

    expect(result).toEqual({ ok: true, user: proUser })
    expect(authLogin).toHaveBeenCalledWith({ email: 'u1@example.test', password: 'password123' })
    expect(useAuthStore.getState().user).toEqual(proUser)
  })

  it('stores the returned user after client-side registration succeeds', async () => {
    const authRegister = vi.fn(async () => ({ ok: true, user: proUser }))
    vi.stubGlobal('window', {
      api: {
        authRegister
      }
    })

    const result = await useAuthStore.getState().register({
      email: 'u1@example.test',
      password: 'password123',
      code: '123456'
    })

    expect(result).toEqual({ ok: true, user: proUser })
    expect(authRegister).toHaveBeenCalledWith({ email: 'u1@example.test', password: 'password123', code: '123456' })
    expect(useAuthStore.getState().user).toEqual(proUser)
  })
})

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
})

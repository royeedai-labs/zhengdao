import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('AppSettingsModal', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('renders the overview while the account state is loading', async () => {
    const { default: AppSettingsModal } = await import('../AppSettingsModal')
    const { useAuthStore } = await import('@/stores/auth-store')

    useAuthStore.setState({ user: null, loading: true })

    expect(() => renderToString(<AppSettingsModal />)).not.toThrow()
  })
})

import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ZhengdaoUser } from '@/stores/auth-store'

function makeUser(patch: Partial<ZhengdaoUser> = {}): ZhengdaoUser {
  return {
    id: 'user-1',
    email: 'author@example.com',
    role: 'user',
    tier: 'free',
    pro: false,
    pointsBalance: 0,
    emailVerified: true,
    ...patch
  }
}

describe('AiGlobalConfigSettings Pro gating', () => {
  afterEach(() => {
    vi.doUnmock('@/stores/auth-store')
    vi.resetModules()
  })

  async function renderWithUser(user: ZhengdaoUser) {
    vi.doMock('@/stores/auth-store', () => ({
      useAuthStore: (selector: (state: { user: ZhengdaoUser; loadUser: () => Promise<void> }) => unknown) =>
        selector({ user, loadUser: vi.fn().mockResolvedValue(undefined) })
    }))
    const { default: AiGlobalConfigSettings } = await import('../AiGlobalConfigSettings')
    return renderToString(<AiGlobalConfigSettings />)
  }

  it('shows an upgrade gate for Free users while keeping provider selection visible', async () => {
    const html = await renderWithUser(makeUser())

    expect(html).toContain('官方 AI 需要 Pro 权益')
    expect(html).toContain('OpenAI 兼容')
  })

  it('shows the official AI area for Pro users without the upgrade gate', async () => {
    const html = await renderWithUser(makeUser({ tier: 'pro', pro: true }))

    expect(html).toContain('官方 AI')
    expect(html).toContain('当前没有后台启用的官方 AI 配置')
    expect(html).not.toContain('官方 AI 需要 Pro 权益')
  })
})

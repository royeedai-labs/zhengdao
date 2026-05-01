import { describe, expect, it } from 'vitest'
import { createDeepLinkCoordinator, isZhengdaoAuthCallbackUrl } from '../deep-link'

describe('deep link coordinator', () => {
  it('recognizes Zhengdao auth callback URLs only', () => {
    expect(isZhengdaoAuthCallbackUrl('zhengdao://auth/callback?state=s&code=c')).toBe(true)
    expect(isZhengdaoAuthCallbackUrl('zhengdao://books/open?id=1')).toBe(false)
    expect(isZhengdaoAuthCallbackUrl('https://agent.xiangweihu.com/auth/callback')).toBe(false)
  })

  it('queues auth callbacks until startup is ready', () => {
    const handled: string[] = []
    const coordinator = createDeepLinkCoordinator(
      async (url) => {
        handled.push(url)
      },
      () => undefined
    )

    coordinator.handle('zhengdao://auth/callback?state=s&code=c')
    expect(handled).toEqual([])

    coordinator.markReady()
    expect(handled).toEqual(['zhengdao://auth/callback?state=s&code=c'])
  })

  it('deduplicates the same queued callback URL before startup is ready', () => {
    const handled: string[] = []
    const coordinator = createDeepLinkCoordinator(
      async (url) => {
        handled.push(url)
      },
      () => undefined
    )

    coordinator.handle('zhengdao://auth/callback?state=s&code=c')
    coordinator.handle('zhengdao://auth/callback?state=s&code=c')
    coordinator.markReady()

    expect(handled).toEqual(['zhengdao://auth/callback?state=s&code=c'])
  })

  it('handles auth callbacks immediately after startup is ready', () => {
    const handled: string[] = []
    const coordinator = createDeepLinkCoordinator(
      async (url) => {
        handled.push(url)
      },
      () => undefined
    )

    coordinator.markReady()
    coordinator.handle('zhengdao://auth/callback?state=s&code=c')

    expect(handled).toEqual(['zhengdao://auth/callback?state=s&code=c'])
  })

  it('routes callback failures to the error handler', async () => {
    const errors: unknown[] = []
    const error = new Error('exchange failed')
    const coordinator = createDeepLinkCoordinator(
      async () => {
        throw error
      },
      (caught) => {
        errors.push(caught)
      }
    )

    coordinator.markReady()
    coordinator.handle('zhengdao://auth/callback?state=s&code=c')
    await Promise.resolve()

    expect(errors).toEqual([error])
  })
})

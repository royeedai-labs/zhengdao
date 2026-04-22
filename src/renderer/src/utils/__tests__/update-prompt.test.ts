import { describe, expect, it } from 'vitest'
import { createIdleUpdateSnapshot } from '../../../../shared/update'
import { buildReadyToInstallMessage, shouldAutoOpenUpdateDialog } from '../update-prompt'

describe('update prompt helpers', () => {
  it('auto-opens only when a newly available version has not been prompted yet', () => {
    const idle = createIdleUpdateSnapshot()
    const available = {
      ...createIdleUpdateSnapshot(),
      status: 'available' as const,
      version: '1.2.5'
    }

    expect(shouldAutoOpenUpdateDialog(idle, null)).toBe(false)
    expect(shouldAutoOpenUpdateDialog(available, null)).toBe(true)
    expect(shouldAutoOpenUpdateDialog(available, '1.2.4')).toBe(true)
    expect(shouldAutoOpenUpdateDialog(available, '1.2.5')).toBe(false)
  })

  it('builds a ready-to-install toast message with version details when available', () => {
    const withVersion = {
      ...createIdleUpdateSnapshot(),
      status: 'ready' as const,
      version: '1.2.5'
    }

    expect(buildReadyToInstallMessage(withVersion)).toContain('1.2.5')
    expect(
      buildReadyToInstallMessage({
        ...createIdleUpdateSnapshot(),
        status: 'ready' as const,
        version: null
      })
    ).toContain('应用设置 / 关于')
  })
})

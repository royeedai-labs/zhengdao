import { describe, expect, it } from 'vitest'
import { createIdleUpdateSnapshot } from '../../../../shared/update'
import {
  buildManualUpdateMessage,
  buildReadyToInstallMessage,
  shouldAutoOpenUpdateDialog,
  shouldUseManualUpdate
} from '../update-prompt'

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
    ).toContain('应用设置 / 更新与关于')
  })

  it('uses a manual download action when automatic updates are unsupported', () => {
    const available = {
      ...createIdleUpdateSnapshot(),
      status: 'available' as const,
      version: '1.3.0',
      automaticUpdateUnsupportedReason: '当前 macOS 公测包未完成签名与公证',
      manualDownloadUrl: 'https://example.test/releases/latest'
    }

    expect(shouldUseManualUpdate(available)).toBe(true)
    expect(buildManualUpdateMessage(available)).toContain('macOS')
    expect(
      shouldUseManualUpdate({
        ...available,
        status: 'checking' as const
      })
    ).toBe(false)
  })
})

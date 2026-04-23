import { describe, expect, it } from 'vitest'
import config from '../../electron-builder.config'

describe('electron-builder release config', () => {
  it('uses the release workflow controlled native rebuild instead of rebuilding every dependency', () => {
    expect(config.npmRebuild).toBe(false)
  })

  it('keeps Windows installer upgrades on the existing install path', () => {
    expect(config.nsis?.oneClick).toBe(false)
    expect(config.nsis?.perMachine).toBe(false)
    expect(config.nsis?.allowToChangeInstallationDirectory).toBe(false)
    expect(config.nsis?.createDesktopShortcut).toBe(true)
    expect(config.nsis?.createStartMenuShortcut).toBe(true)
  })

  it('keeps uninstall identity stable without deleting user data', () => {
    expect(config.nsis?.uninstallDisplayName).toBe('证道')
    expect(config.nsis?.shortcutName).toBe('证道')
    expect(config.nsis?.deleteAppDataOnUninstall).toBe(false)
  })
})

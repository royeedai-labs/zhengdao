import { describe, expect, it } from 'vitest'
import {
  DESKTOP_TRAY_TOOLTIP,
  getDesktopTrayMenuItems,
  shouldCreateDesktopTray,
  shouldHideWindowToTray
} from '../desktop-tray'

describe('desktop-tray', () => {
  it('creates a runtime tray only on Windows', () => {
    expect(shouldCreateDesktopTray('win32')).toBe(true)
    expect(shouldCreateDesktopTray('darwin')).toBe(false)
    expect(shouldCreateDesktopTray('linux')).toBe(false)
    expect(shouldCreateDesktopTray('unknown')).toBe(false)
  })

  it('hides the window to tray only when Windows has not requested an explicit quit', () => {
    expect(shouldHideWindowToTray('win32', false)).toBe(true)
    expect(shouldHideWindowToTray('win32', true)).toBe(false)
    expect(shouldHideWindowToTray('darwin', false)).toBe(false)
    expect(shouldHideWindowToTray('linux', false)).toBe(false)
  })

  it('exposes show, hide and quit actions in the tray menu', () => {
    expect(DESKTOP_TRAY_TOOLTIP).toBe('证道')

    expect(getDesktopTrayMenuItems(true)).toEqual([
      { action: 'show', label: '显示证道', enabled: false },
      { action: 'hide', label: '隐藏到托盘', enabled: true },
      { action: 'quit', label: '退出证道', enabled: true }
    ])

    expect(getDesktopTrayMenuItems(false)).toEqual([
      { action: 'show', label: '显示证道', enabled: true },
      { action: 'hide', label: '隐藏到托盘', enabled: false },
      { action: 'quit', label: '退出证道', enabled: true }
    ])
  })
})

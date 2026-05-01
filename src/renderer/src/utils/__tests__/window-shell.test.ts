import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentTitlebarOverlayColors, syncCurrentTitlebarOverlay } from '../window-shell'

function installRendererGlobals(userAgent: string, cssVars: Record<string, string>) {
  const setTitleBarOverlay = vi.fn()

  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent },
    configurable: true
  })
  Object.defineProperty(globalThis, 'document', {
    value: { documentElement: {} },
    configurable: true
  })
  Object.defineProperty(globalThis, 'getComputedStyle', {
    value: () => ({
      getPropertyValue: (key: string) => cssVars[key] ?? ''
    }),
    configurable: true
  })
  Object.defineProperty(globalThis, 'window', {
    value: {
      api: {
        setTitleBarOverlay
      }
    },
    configurable: true
  })

  return setTitleBarOverlay
}

describe('renderer window shell helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, 'navigator')
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'getComputedStyle')
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('reads the active theme colors for the native Windows title bar overlay', () => {
    installRendererGlobals('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', {
      '--bg-secondary': '#ffffff',
      '--text-secondary': '#526173'
    })

    expect(getCurrentTitlebarOverlayColors()).toEqual({
      color: '#ffffff',
      symbolColor: '#526173'
    })
  })

  it('syncs title bar overlay colors only on Windows', () => {
    const setTitleBarOverlay = installRendererGlobals('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', {
      '--bg-secondary': '#171d25',
      '--text-secondary': '#a8b5c4'
    })

    syncCurrentTitlebarOverlay()

    expect(setTitleBarOverlay).toHaveBeenCalledWith({
      color: '#171d25',
      symbolColor: '#a8b5c4'
    })
  })

  it('does not send overlay updates on non-Windows platforms', () => {
    const setTitleBarOverlay = installRendererGlobals('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', {
      '--bg-secondary': '#ffffff',
      '--text-secondary': '#526173'
    })

    syncCurrentTitlebarOverlay()

    expect(setTitleBarOverlay).not.toHaveBeenCalled()
  })
})

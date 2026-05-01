export const APP_DISPLAY_NAME = '证道'

export type DesktopShellPlatform = 'darwin' | 'win32' | 'linux'
export type DesktopShellPlatformLike = DesktopShellPlatform | 'unknown'

export interface DesktopTitlebarSafeArea {
  leftInset: number
  rightInset: number
  overlayHeight: number
}

export interface DesktopWindowChrome {
  backgroundColor: string
  title: string
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset'
  titleBarOverlay?: false | DesktopTitlebarOverlay
  trafficLightPosition?: { x: number; y: number }
}

export interface DesktopTitlebarOverlayColors {
  color: string
  symbolColor: string
}

export interface DesktopTitlebarOverlay extends DesktopTitlebarOverlayColors {
  height: number
}

export const DESKTOP_CHROME_BACKGROUND = '#141414'
export const WINDOWS_TITLEBAR_OVERLAY_LIGHT: DesktopTitlebarOverlayColors = {
  color: '#ffffff',
  symbolColor: '#526173'
}
export const WINDOWS_TITLEBAR_OVERLAY_DARK: DesktopTitlebarOverlayColors = {
  color: '#171d25',
  symbolColor: '#a8b5c4'
}
export const WINDOWS_TITLEBAR_OVERLAY_HEIGHT = 48

export function normalizeDesktopShellPlatform(platform: string): DesktopShellPlatformLike {
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') return platform
  return 'unknown'
}

export function detectDesktopShellPlatform(userAgent: string): DesktopShellPlatformLike {
  const source = userAgent.toLowerCase()
  if (source.includes('windows')) return 'win32'
  if (source.includes('mac os') || source.includes('macintosh')) return 'darwin'
  if (source.includes('linux') || source.includes('x11')) return 'linux'
  return 'unknown'
}

export function shouldStripNativeMenu(platform: DesktopShellPlatformLike): boolean {
  return platform === 'win32' || platform === 'linux'
}

export function getTitlebarSafeArea(platform: DesktopShellPlatformLike): DesktopTitlebarSafeArea {
  switch (platform) {
    case 'darwin':
      return { leftInset: 88, rightInset: 16, overlayHeight: 48 }
    case 'win32':
      return { leftInset: 18, rightInset: 152, overlayHeight: WINDOWS_TITLEBAR_OVERLAY_HEIGHT }
    case 'linux':
      return { leftInset: 18, rightInset: 18, overlayHeight: 48 }
    default:
      return { leftInset: 18, rightInset: 18, overlayHeight: 48 }
  }
}

export function normalizeTitlebarOverlayColors(
  input: Partial<DesktopTitlebarOverlayColors> | null | undefined,
  fallback: DesktopTitlebarOverlayColors = WINDOWS_TITLEBAR_OVERLAY_LIGHT
): DesktopTitlebarOverlayColors {
  return {
    color: cleanCssColor(input?.color, fallback.color),
    symbolColor: cleanCssColor(input?.symbolColor, fallback.symbolColor)
  }
}

export function getWindowsTitlebarOverlay(
  prefersDark: boolean,
  colors?: Partial<DesktopTitlebarOverlayColors>
): DesktopTitlebarOverlay {
  const fallback = prefersDark ? WINDOWS_TITLEBAR_OVERLAY_DARK : WINDOWS_TITLEBAR_OVERLAY_LIGHT
  return {
    ...normalizeTitlebarOverlayColors(colors, fallback),
    height: WINDOWS_TITLEBAR_OVERLAY_HEIGHT
  }
}

function cleanCssColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const color = value.trim()
  if (!color || color.length > 64) return fallback
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return color
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)) {
    return color
  }
  return fallback
}

export function getDesktopWindowChrome(
  platform: DesktopShellPlatformLike,
  options: { prefersDarkTitlebar?: boolean } = {}
): DesktopWindowChrome {
  if (platform === 'darwin') {
    return {
      backgroundColor: DESKTOP_CHROME_BACKGROUND,
      title: APP_DISPLAY_NAME,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 }
    }
  }

  if (platform === 'win32') {
    return {
      backgroundColor: DESKTOP_CHROME_BACKGROUND,
      title: APP_DISPLAY_NAME,
      titleBarStyle: 'hidden',
      titleBarOverlay: getWindowsTitlebarOverlay(options.prefersDarkTitlebar ?? false)
    }
  }

  return {
    backgroundColor: DESKTOP_CHROME_BACKGROUND,
    title: APP_DISPLAY_NAME
  }
}

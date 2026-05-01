import {
  detectDesktopShellPlatform,
  getTitlebarSafeArea,
  normalizeTitlebarOverlayColors,
  type DesktopTitlebarOverlayColors,
  type DesktopShellPlatformLike
} from '../../../shared/window-shell'

export function getCurrentDesktopShellPlatform(): DesktopShellPlatformLike {
  if (typeof navigator === 'undefined') return 'unknown'
  return detectDesktopShellPlatform(navigator.userAgent)
}

export function getCurrentTitlebarSafeArea() {
  return getTitlebarSafeArea(getCurrentDesktopShellPlatform())
}

export function getCurrentTitlebarOverlayColors(): DesktopTitlebarOverlayColors {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return normalizeTitlebarOverlayColors(null)
  }

  const styles = getComputedStyle(document.documentElement)
  return normalizeTitlebarOverlayColors({
    color: styles.getPropertyValue('--bg-secondary'),
    symbolColor: styles.getPropertyValue('--text-secondary')
  })
}

export function syncCurrentTitlebarOverlay(): void {
  if (getCurrentDesktopShellPlatform() !== 'win32') return
  if (typeof window === 'undefined' || typeof window.api?.setTitleBarOverlay !== 'function') return
  void window.api.setTitleBarOverlay(getCurrentTitlebarOverlayColors())
}

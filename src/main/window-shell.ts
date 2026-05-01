import { app, BrowserWindow, nativeTheme, type BrowserWindowConstructorOptions } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  getDesktopWindowChrome,
  getWindowsTitlebarOverlay,
  normalizeDesktopShellPlatform,
  shouldStripNativeMenu,
  type DesktopTitlebarOverlayColors
} from '../shared/window-shell'

export function resolveRuntimeIconPath(fileNames: string[] = ['icon.png']): string | undefined {
  const baseDirs = [
    process.resourcesPath,
    join(process.resourcesPath, 'resources'),
    join(app.getAppPath(), 'resources'),
    join(__dirname, '../../resources'),
    join(process.cwd(), 'resources')
  ]
  const candidates = baseDirs.flatMap((baseDir) => fileNames.map((fileName) => join(baseDir, fileName)))

  return candidates.find((candidate) => existsSync(candidate))
}

export function getMainWindowShellOptions(
  platform: NodeJS.Platform
): Pick<
  BrowserWindowConstructorOptions,
  'backgroundColor' | 'title' | 'titleBarStyle' | 'titleBarOverlay' | 'trafficLightPosition' | 'icon'
> {
  const normalizedPlatform = normalizeDesktopShellPlatform(platform)
  const chrome = getDesktopWindowChrome(normalizedPlatform, {
    prefersDarkTitlebar: nativeTheme.shouldUseDarkColors
  })
  const iconPath = resolveRuntimeIconPath()

  return {
    ...chrome,
    ...(iconPath && normalizedPlatform !== 'darwin' ? { icon: iconPath } : {})
  }
}

export function getAuxiliaryWindowShellOptions(
  platform: NodeJS.Platform,
  title: string
): Pick<BrowserWindowConstructorOptions, 'title' | 'icon'> {
  const normalizedPlatform = normalizeDesktopShellPlatform(platform)
  const iconPath = resolveRuntimeIconPath()

  return {
    title,
    ...(iconPath && normalizedPlatform !== 'darwin' ? { icon: iconPath } : {})
  }
}

export function applyDesktopWindowShell(window: BrowserWindow, platform: NodeJS.Platform): void {
  const normalizedPlatform = normalizeDesktopShellPlatform(platform)
  if (!shouldStripNativeMenu(normalizedPlatform)) return

  window.removeMenu()
  window.setMenuBarVisibility(false)
  window.setAutoHideMenuBar(true)
}

export function applyWindowsTitlebarOverlay(
  window: BrowserWindow,
  platform: NodeJS.Platform,
  colors?: Partial<DesktopTitlebarOverlayColors>
): boolean {
  const normalizedPlatform = normalizeDesktopShellPlatform(platform)
  if (normalizedPlatform !== 'win32') return false

  window.setTitleBarOverlay(
    getWindowsTitlebarOverlay(nativeTheme.shouldUseDarkColors, colors)
  )
  return true
}

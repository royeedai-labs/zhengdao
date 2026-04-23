import { APP_DISPLAY_NAME, type DesktopShellPlatformLike } from './window-shell'

export type DesktopTrayAction = 'show' | 'hide' | 'quit'

export interface DesktopTrayMenuItem {
  action: DesktopTrayAction
  label: string
  enabled: boolean
}

export const DESKTOP_TRAY_TOOLTIP = APP_DISPLAY_NAME

export function shouldCreateDesktopTray(platform: DesktopShellPlatformLike): boolean {
  return platform === 'win32'
}

export function shouldHideWindowToTray(platform: DesktopShellPlatformLike, explicitQuitRequested: boolean): boolean {
  return shouldCreateDesktopTray(platform) && !explicitQuitRequested
}

export function getDesktopTrayMenuItems(isWindowVisible: boolean): DesktopTrayMenuItem[] {
  return [
    {
      action: 'show',
      label: `显示${APP_DISPLAY_NAME}`,
      enabled: !isWindowVisible
    },
    {
      action: 'hide',
      label: '隐藏到托盘',
      enabled: isWindowVisible
    },
    {
      action: 'quit',
      label: `退出${APP_DISPLAY_NAME}`,
      enabled: true
    }
  ]
}

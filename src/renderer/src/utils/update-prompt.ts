import type { UpdateSnapshot } from '../../../shared/update'

export const UPDATE_PROMPTED_VERSION_KEY = 'update_prompted_version'

export function shouldAutoOpenUpdateDialog(snapshot: UpdateSnapshot, promptedVersion: string | null): boolean {
  return snapshot.status === 'available' && Boolean(snapshot.version) && snapshot.version !== promptedVersion
}

export function buildReadyToInstallMessage(snapshot: UpdateSnapshot): string {
  return snapshot.version
    ? `新版本 ${snapshot.version} 已下载，可在“应用设置 / 关于”中立即安装`
    : '新版本已下载，可在“应用设置 / 关于”中立即安装'
}

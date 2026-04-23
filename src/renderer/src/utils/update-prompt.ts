import type { UpdateSnapshot } from '../../../shared/update'

export const UPDATE_PROMPTED_VERSION_KEY = 'update_prompted_version'

export function shouldAutoOpenUpdateDialog(snapshot: UpdateSnapshot, promptedVersion: string | null): boolean {
  return snapshot.status === 'available' && Boolean(snapshot.version) && snapshot.version !== promptedVersion
}

export function buildReadyToInstallMessage(snapshot: UpdateSnapshot): string {
  return snapshot.version
    ? `新版本 ${snapshot.version} 已下载，可在“应用设置 / 更新与关于”中立即安装`
    : '新版本已下载，可在“应用设置 / 更新与关于”中立即安装'
}

export function shouldUseManualUpdate(snapshot: UpdateSnapshot): boolean {
  return (
    Boolean(snapshot.automaticUpdateUnsupportedReason && snapshot.manualDownloadUrl) &&
    (snapshot.status === 'available' || snapshot.status === 'ready' || snapshot.status === 'error')
  )
}

export function buildManualUpdateMessage(snapshot: UpdateSnapshot): string {
  return snapshot.automaticUpdateUnsupportedReason ?? '当前平台暂不支持应用内自动安装，请手动下载安装包。'
}

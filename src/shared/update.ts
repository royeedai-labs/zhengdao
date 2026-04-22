export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'

export type UpdateRecoveryAction = 'check' | 'download' | 'install'

export interface UpdateSnapshot {
  status: UpdateStatus
  version: string | null
  downloadPercent: number
  releaseDate: string | null
  releaseNotesSummary: string | null
  errorMessage: string | null
  errorRecoveryAction: UpdateRecoveryAction | null
}

export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'download-started' }
  | { type: 'update-available'; payload?: UpdateMetadata | null }
  | { type: 'download-progress'; downloadPercent: number }
  | { type: 'update-downloaded'; payload?: UpdateMetadata | null }
  | { type: 'update-not-available' }
  | { type: 'installing' }
  | { type: 'install-failed'; errorMessage: string }
  | { type: 'error'; errorMessage: string; recoveryAction: UpdateRecoveryAction }

export interface UpdateMetadata {
  version?: string | null
  releaseDate?: string | Date | null
  releaseNotes?: unknown
}

export function createIdleUpdateSnapshot(): UpdateSnapshot {
  return {
    status: 'idle',
    version: null,
    downloadPercent: 0,
    releaseDate: null,
    releaseNotesSummary: null,
    errorMessage: null,
    errorRecoveryAction: null
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeReleaseDate(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export function summarizeReleaseNotes(releaseNotes: unknown): string | null {
  if (typeof releaseNotes === 'string') {
    const trimmed = releaseNotes.trim()
    return trimmed ? trimmed : null
  }

  if (Array.isArray(releaseNotes)) {
    const text = releaseNotes
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim()
        if (entry && typeof entry === 'object' && 'note' in entry) {
          const note = (entry as { note?: unknown }).note
          return typeof note === 'string' ? note.trim() : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
    return text || null
  }

  return null
}

function applyMetadata(snapshot: UpdateSnapshot, payload?: UpdateMetadata | null): UpdateSnapshot {
  if (!payload) return snapshot
  return {
    ...snapshot,
    version: payload.version ?? snapshot.version,
    releaseDate: normalizeReleaseDate(payload.releaseDate) ?? snapshot.releaseDate,
    releaseNotesSummary: summarizeReleaseNotes(payload.releaseNotes) ?? snapshot.releaseNotesSummary
  }
}

export function reduceUpdateSnapshot(current: UpdateSnapshot, event: UpdateEvent): UpdateSnapshot {
  switch (event.type) {
    case 'checking':
      return {
        ...current,
        status: 'checking',
        errorMessage: null,
        errorRecoveryAction: null
      }
    case 'download-started':
      return {
        ...current,
        status: 'downloading',
        downloadPercent: clampPercent(current.downloadPercent),
        errorMessage: null,
        errorRecoveryAction: null
      }
    case 'update-available':
      return applyMetadata(
        {
          ...current,
          status: 'available',
          downloadPercent: 0,
          errorMessage: null,
          errorRecoveryAction: null
        },
        event.payload
      )
    case 'download-progress':
      return {
        ...current,
        status: 'downloading',
        downloadPercent: clampPercent(event.downloadPercent),
        errorMessage: null,
        errorRecoveryAction: null
      }
    case 'update-downloaded':
      return applyMetadata(
        {
          ...current,
          status: 'ready',
          downloadPercent: 100,
          errorMessage: null,
          errorRecoveryAction: null
        },
        event.payload
      )
    case 'update-not-available':
      return createIdleUpdateSnapshot()
    case 'installing':
      return {
        ...current,
        status: 'installing',
        errorMessage: null,
        errorRecoveryAction: null
      }
    case 'install-failed':
      return {
        ...current,
        status: 'ready',
        downloadPercent: current.downloadPercent > 0 ? current.downloadPercent : 100,
        errorMessage: event.errorMessage,
        errorRecoveryAction: 'install'
      }
    case 'error':
      return {
        ...current,
        status: 'error',
        errorMessage: event.errorMessage,
        errorRecoveryAction: event.recoveryAction
      }
  }
}

export function shouldShowReadyToInstall(snapshot: UpdateSnapshot): boolean {
  return snapshot.status === 'ready' && Boolean(snapshot.version)
}

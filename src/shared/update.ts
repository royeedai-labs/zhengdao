export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'

export type UpdateRecoveryAction = 'check' | 'download' | 'install'

export interface UpdateSnapshot {
  status: UpdateStatus
  version: string | null
  downloadPercent: number
  releaseDate: string | null
  releaseNotesSummary: string | null
  automaticUpdateUnsupportedReason: string | null
  manualDownloadUrl: string | null
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
    automaticUpdateUnsupportedReason: null,
    manualDownloadUrl: null,
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

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*?>/i

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, raw: string) => {
    const key = raw.toLowerCase()
    if (key.startsWith('#x')) {
      const codePoint = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
    }
    if (key.startsWith('#')) {
      const codePoint = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
    }
    return HTML_ENTITIES[key] ?? entity
  })
}

function normalizeReleaseNoteText(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const text = HTML_TAG_PATTERN.test(trimmed)
    ? trimmed
        .replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\s*\/\s*(p|div|h[1-6]|tr|ul|ol)\s*>/gi, '\n')
        .replace(/<\s*li(?:\s[^>]*)?>/gi, '\n- ')
        .replace(/<\s*\/\s*li\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    : trimmed

  const normalized = decodeHtmlEntities(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

  return normalized || null
}

export function summarizeReleaseNotes(releaseNotes: unknown): string | null {
  if (typeof releaseNotes === 'string') {
    return normalizeReleaseNoteText(releaseNotes)
  }

  if (Array.isArray(releaseNotes)) {
    const text = releaseNotes
      .map((entry) => {
        if (typeof entry === 'string') return normalizeReleaseNoteText(entry) ?? ''
        if (entry && typeof entry === 'object' && 'note' in entry) {
          const note = (entry as { note?: unknown }).note
          return typeof note === 'string' ? (normalizeReleaseNoteText(note) ?? '') : ''
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

export function withManualUpdateFallback(
  snapshot: UpdateSnapshot,
  reason: string | null,
  manualDownloadUrl: string | null
): UpdateSnapshot {
  return {
    ...snapshot,
    automaticUpdateUnsupportedReason: reason,
    manualDownloadUrl
  }
}

export function shouldShowReadyToInstall(snapshot: UpdateSnapshot): boolean {
  return snapshot.status === 'ready' && Boolean(snapshot.version)
}

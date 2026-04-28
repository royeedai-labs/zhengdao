export type WorkspacePanelKind = 'left' | 'right'
export type RightPanelTab = 'ai'

export const RIGHT_PANEL_TABS: RightPanelTab[] = ['ai']

const PANEL_LIMITS: Record<WorkspacePanelKind, { min: number; max: number; fallback: number; viewportRatio: number }> = {
  left: { min: 232, max: 420, fallback: 296, viewportRatio: 0.34 },
  right: { min: 360, max: 640, fallback: 420, viewportRatio: 0.42 }
}

function roundFinite(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0)
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function clampWorkspacePanelWidth(
  kind: WorkspacePanelKind,
  width: number,
  viewportWidth = 1440
): number {
  const limits = PANEL_LIMITS[kind]
  const maxByViewport = Math.max(limits.min, Math.floor(roundFinite(viewportWidth) * limits.viewportRatio))
  return clamp(roundFinite(width), limits.min, Math.min(limits.max, maxByViewport))
}

export function getDefaultWorkspacePanelWidth(kind: WorkspacePanelKind, viewportWidth = 1440): number {
  return clampWorkspacePanelWidth(kind, PANEL_LIMITS[kind].fallback, viewportWidth)
}

export function resolveDefaultBottomPanelOpen(storedValue: string | null | undefined): boolean {
  if (storedValue === 'false') return false
  if (storedValue === 'true') return true
  return true
}

export function isRightPanelTab(value: string): value is RightPanelTab {
  return (RIGHT_PANEL_TABS as readonly string[]).includes(value)
}

export function chooseDefaultRightPanelTab(input: {
  storedTab?: RightPanelTab | null
  warningCount: number
  currentChapterCharacterCount: number
}): RightPanelTab {
  void input
  return 'ai'
}

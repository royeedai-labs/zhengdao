export type WorkspacePanelKind = 'left' | 'right'
export type RightPanelTab = 'foreshadow' | 'characters' | 'notes'

export const RIGHT_PANEL_TABS: RightPanelTab[] = ['foreshadow', 'characters', 'notes']

const PANEL_LIMITS: Record<WorkspacePanelKind, { min: number; max: number; fallback: number; viewportRatio: number }> = {
  left: { min: 232, max: 420, fallback: 296, viewportRatio: 0.34 },
  right: { min: 296, max: 520, fallback: 344, viewportRatio: 0.38 }
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

export function isRightPanelTab(value: string): value is RightPanelTab {
  return (RIGHT_PANEL_TABS as readonly string[]).includes(value)
}

export function chooseDefaultRightPanelTab(input: {
  storedTab?: RightPanelTab | null
  warningCount: number
  currentChapterCharacterCount: number
}): RightPanelTab {
  if (input.storedTab) return input.storedTab
  if (input.warningCount > 0) return 'foreshadow'
  if (input.currentChapterCharacterCount > 0) return 'characters'
  return 'notes'
}

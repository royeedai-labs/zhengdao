export type AiAssistantPanelRect = {
  x: number
  y: number
  width: number
  height: number
}

export type AiAssistantLauncherPosition = {
  x: number
  y: number
}

const PANEL_MARGIN = 16
const DEFAULT_PANEL_WIDTH = 420
const DEFAULT_PANEL_HEIGHT = 680
const DEFAULT_PANEL_BOTTOM_OFFSET = 112
const DEFAULT_LAUNCHER_SIZE = 48
const DEFAULT_LAUNCHER_BOTTOM_OFFSET = 176
const DEFAULT_CONTEXT_PANEL_RESERVE = 360
const MIN_PANEL_WIDTH = 320
const MIN_PANEL_HEIGHT = 320
const MAX_PANEL_WIDTH = 748

function round(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0)
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function clampAiAssistantPanelRect(
  rect: AiAssistantPanelRect,
  viewportWidth: number,
  viewportHeight: number
): AiAssistantPanelRect {
  const maxWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, round(viewportWidth) - PANEL_MARGIN * 2))
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, round(viewportHeight) - PANEL_MARGIN * 2)
  const width = clamp(round(rect.width), MIN_PANEL_WIDTH, maxWidth)
  const height = clamp(round(rect.height), MIN_PANEL_HEIGHT, maxHeight)

  return {
    x: clamp(round(rect.x), PANEL_MARGIN, round(viewportWidth) - PANEL_MARGIN - width),
    y: clamp(round(rect.y), PANEL_MARGIN, round(viewportHeight) - PANEL_MARGIN - height),
    width,
    height
  }
}

export function createDefaultAiAssistantPanelRect(
  viewportWidth: number,
  viewportHeight: number
): AiAssistantPanelRect {
  const width = Math.min(DEFAULT_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, round(viewportWidth) - PANEL_MARGIN * 2))
  const height = Math.min(DEFAULT_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, round(viewportHeight) - PANEL_MARGIN * 2))
  const preferredX = round(viewportWidth) - PANEL_MARGIN - DEFAULT_CONTEXT_PANEL_RESERVE - width
  return clampAiAssistantPanelRect(
    {
      x: preferredX,
      y: round(viewportHeight) - DEFAULT_PANEL_BOTTOM_OFFSET - height,
      width,
      height
    },
    viewportWidth,
    viewportHeight
  )
}

export function clampAiAssistantLauncherPosition(
  position: AiAssistantLauncherPosition,
  viewportWidth: number,
  viewportHeight: number
): AiAssistantLauncherPosition {
  return {
    x: clamp(
      round(position.x),
      PANEL_MARGIN,
      round(viewportWidth) - PANEL_MARGIN - DEFAULT_LAUNCHER_SIZE
    ),
    y: clamp(
      round(position.y),
      PANEL_MARGIN,
      round(viewportHeight) - PANEL_MARGIN - DEFAULT_LAUNCHER_SIZE
    )
  }
}

export function createDefaultAiAssistantLauncherPosition(
  viewportWidth: number,
  viewportHeight: number
): AiAssistantLauncherPosition {
  const preferredX = round(viewportWidth) - PANEL_MARGIN - DEFAULT_CONTEXT_PANEL_RESERVE - DEFAULT_LAUNCHER_SIZE
  return clampAiAssistantLauncherPosition(
    {
      x: preferredX,
      y: round(viewportHeight) - DEFAULT_LAUNCHER_BOTTOM_OFFSET - DEFAULT_LAUNCHER_SIZE
    },
    viewportWidth,
    viewportHeight
  )
}

export function translateAiAssistantLauncherPosition(
  position: AiAssistantLauncherPosition,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number
): AiAssistantLauncherPosition {
  return clampAiAssistantLauncherPosition(
    {
      x: position.x + deltaX,
      y: position.y + deltaY
    },
    viewportWidth,
    viewportHeight
  )
}

export function translateAiAssistantPanelRect(
  rect: AiAssistantPanelRect,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number
): AiAssistantPanelRect {
  return clampAiAssistantPanelRect(
    {
      ...rect,
      x: rect.x + deltaX,
      y: rect.y + deltaY
    },
    viewportWidth,
    viewportHeight
  )
}

export function resizeAiAssistantPanelRect(
  rect: AiAssistantPanelRect,
  deltaWidth: number,
  deltaHeight: number,
  viewportWidth: number,
  viewportHeight: number
): AiAssistantPanelRect {
  const maxWidth = Math.max(
    MIN_PANEL_WIDTH,
    Math.min(MAX_PANEL_WIDTH, round(viewportWidth) - PANEL_MARGIN - round(rect.x))
  )
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, round(viewportHeight) - PANEL_MARGIN - round(rect.y))

  return {
    x: round(rect.x),
    y: round(rect.y),
    width: clamp(round(rect.width + deltaWidth), MIN_PANEL_WIDTH, maxWidth),
    height: clamp(round(rect.height + deltaHeight), MIN_PANEL_HEIGHT, maxHeight)
  }
}

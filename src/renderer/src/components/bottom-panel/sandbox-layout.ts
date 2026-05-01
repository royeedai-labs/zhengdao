export const PLOT_CHAPTER_PX = 15
export const PLOT_SCORE_PX = 20
export const PLOT_LEFT_PADDING = 96
export const PLOT_RIGHT_PADDING = 160
export const PLOT_BASELINE_Y = 132
export const PLOT_CARD_WIDTH = 144
export const PLOT_DRAG_THRESHOLD = 6
export const PLOT_VIEW_HEIGHT = 260
export const PLOT_MIN_CHAPTER_PX = PLOT_CARD_WIDTH + 24
export const PLOT_ZOOM_MIN = 0.005
export const PLOT_ZOOM_MAX = 2.5

export function clampPlotChapter(chapter: number): number {
  return Math.max(1, Math.round(chapter))
}

export function clampPlotScore(score: number): number {
  return Math.max(-5, Math.min(5, Math.round(score)))
}

export function getAdaptiveChapterPx(chapterCount: number, viewportWidth: number): number {
  const count = Math.max(1, clampPlotChapter(chapterCount))
  const availableWidth = viewportWidth - PLOT_LEFT_PADDING - PLOT_RIGHT_PADDING
  const fittedChapterPx = count > 1 && availableWidth > 0 ? availableWidth / (count - 1) : PLOT_MIN_CHAPTER_PX
  return Math.max(PLOT_MIN_CHAPTER_PX, fittedChapterPx)
}

export function chapterToTimelineX(chapter: number, chapterPx = PLOT_CHAPTER_PX): number {
  return PLOT_LEFT_PADDING + (clampPlotChapter(chapter) - 1) * chapterPx
}

export function scoreToTimelineY(score: number): number {
  return PLOT_BASELINE_Y - clampPlotScore(score) * PLOT_SCORE_PX
}

export function getTimelineWidth(maxChapter: number, chapterPx = PLOT_CHAPTER_PX): number {
  const lastChapter = Math.max(20, clampPlotChapter(maxChapter))
  return chapterToTimelineX(lastChapter, chapterPx) + PLOT_RIGHT_PADDING
}

export function getAdaptiveTimelineWidth(chapterCount: number, chapterPx: number): number {
  const lastChapter = Math.max(1, clampPlotChapter(chapterCount))
  return chapterToTimelineX(lastChapter, chapterPx) + PLOT_RIGHT_PADDING
}

export function getPlotNodeLeft(chapter: number, chapterPx = PLOT_CHAPTER_PX): number {
  return chapterToTimelineX(chapter, chapterPx) - PLOT_CARD_WIDTH / 2
}

export function dragExceededThreshold(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > PLOT_DRAG_THRESHOLD || Math.abs(deltaY) > PLOT_DRAG_THRESHOLD
}

export function projectPlotDrag(
  startChapter: number,
  startScore: number,
  deltaX: number,
  deltaY: number,
  chapterPx = PLOT_CHAPTER_PX
) {
  return {
    chapter: clampPlotChapter(startChapter + deltaX / chapterPx),
    score: clampPlotScore(startScore - deltaY / PLOT_SCORE_PX)
  }
}

export function clampSandboxZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return Math.max(PLOT_ZOOM_MIN, Math.min(PLOT_ZOOM_MAX, zoom))
}

export function getSandboxOverviewZoom(timelineWidth: number, viewportWidth: number, viewportHeight: number): number {
  const widthScale = viewportWidth > 0 ? viewportWidth / Math.max(1, timelineWidth) : 1
  const heightScale = viewportHeight > 0 ? viewportHeight / PLOT_VIEW_HEIGHT : 1
  return clampSandboxZoom(Math.min(1, widthScale, heightScale))
}

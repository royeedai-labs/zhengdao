import { describe, expect, it } from 'vitest'
import {
  PLOT_LEFT_PADDING,
  chapterToTimelineX,
  clampSandboxZoom,
  dragExceededThreshold,
  getAdaptiveChapterPx,
  getAdaptiveTimelineWidth,
  getPlotNodeLeft,
  getSandboxOverviewZoom,
  projectPlotDrag
} from '../sandbox-layout'

describe('sandbox-layout', () => {
  it('keeps the first chapter node visible with left padding', () => {
    expect(chapterToTimelineX(1)).toBe(PLOT_LEFT_PADDING)
    expect(getPlotNodeLeft(1)).toBeGreaterThan(0)
  })

  it('maps drag delta to chapter and score changes with clamp', () => {
    expect(projectPlotDrag(3, 1, 45, -40)).toEqual({ chapter: 6, score: 3 })
    expect(projectPlotDrag(1, 4, -999, -999)).toEqual({ chapter: 1, score: 5 })
    expect(projectPlotDrag(2, -4, 0, 999)).toEqual({ chapter: 2, score: -5 })
  })

  it('separates click from drag with a movement threshold', () => {
    expect(dragExceededThreshold(2, 3)).toBe(false)
    expect(dragExceededThreshold(7, 0)).toBe(true)
    expect(dragExceededThreshold(0, -8)).toBe(true)
  })

  it('clamps sandbox zoom and computes overview scale from the viewport', () => {
    expect(clampSandboxZoom(Number.NaN)).toBe(1)
    expect(clampSandboxZoom(0.001)).toBe(0.005)
    expect(clampSandboxZoom(9)).toBe(2.5)
    expect(getSandboxOverviewZoom(2000, 1000, 300)).toBe(0.5)
    expect(getSandboxOverviewZoom(500, 1000, 500)).toBe(1)
  })

  it('spreads short books across the available sandbox width', () => {
    const chapterPx = getAdaptiveChapterPx(5, 1000)
    expect(chapterPx).toBe(186)
    expect(getPlotNodeLeft(2, chapterPx) - getPlotNodeLeft(1, chapterPx)).toBeGreaterThan(144)
    expect(getAdaptiveTimelineWidth(5, chapterPx)).toBe(1000)
  })

  it('keeps a readable minimum chapter gap when the viewport is narrow', () => {
    const chapterPx = getAdaptiveChapterPx(5, 520)
    expect(chapterPx).toBe(168)
    expect(projectPlotDrag(1, 0, chapterPx * 2, 0, chapterPx)).toEqual({ chapter: 3, score: 0 })
  })
})

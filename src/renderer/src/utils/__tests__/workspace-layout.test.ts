import { describe, expect, it } from 'vitest'
import {
  chooseDefaultRightPanelTab,
  clampWorkspacePanelWidth,
  getDefaultWorkspacePanelWidth,
  isRightPanelTab,
  resolveDefaultBottomPanelOpen
} from '../workspace-layout'

describe('workspace panel layout', () => {
  it('clamps panel widths to ergonomic bounds and viewport share', () => {
    expect(clampWorkspacePanelWidth('left', 80, 1440)).toBe(232)
    expect(clampWorkspacePanelWidth('left', 900, 1024)).toBe(348)
    expect(clampWorkspacePanelWidth('right', 900, 1440)).toBe(604)
  })

  it('provides default panel widths inside the same clamp rules', () => {
    expect(getDefaultWorkspacePanelWidth('left', 1440)).toBe(296)
    expect(getDefaultWorkspacePanelWidth('right', 1440)).toBe(420)
  })

  it('validates right panel tabs', () => {
    expect(isRightPanelTab('foreshadow')).toBe(false)
    expect(isRightPanelTab('characters')).toBe(false)
    expect(isRightPanelTab('notes')).toBe(false)
    expect(isRightPanelTab('ai')).toBe(true)
    expect(isRightPanelTab('outline')).toBe(false)
  })

  it('chooses the AI workbench regardless of old context urgency', () => {
    expect(
      chooseDefaultRightPanelTab({
        warningCount: 1,
        currentChapterCharacterCount: 4
      })
    ).toBe('ai')
    expect(
      chooseDefaultRightPanelTab({
        warningCount: 0,
        currentChapterCharacterCount: 4
      })
    ).toBe('ai')
    expect(
      chooseDefaultRightPanelTab({
        warningCount: 0,
        currentChapterCharacterCount: 0
      })
    ).toBe('ai')
  })

  it('keeps the AI workbench as the only stored tab preference', () => {
    expect(
      chooseDefaultRightPanelTab({
        storedTab: 'ai',
        warningCount: 2,
        currentChapterCharacterCount: 4
      })
    ).toBe('ai')
  })

  it('opens the bottom sandbox by default while respecting stored user preference', () => {
    expect(resolveDefaultBottomPanelOpen(null)).toBe(true)
    expect(resolveDefaultBottomPanelOpen(undefined)).toBe(true)
    expect(resolveDefaultBottomPanelOpen('')).toBe(true)
    expect(resolveDefaultBottomPanelOpen('true')).toBe(true)
    expect(resolveDefaultBottomPanelOpen('false')).toBe(false)
  })
})

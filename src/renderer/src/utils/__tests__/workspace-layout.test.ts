import { describe, expect, it } from 'vitest'
import {
  chooseDefaultRightPanelTab,
  clampWorkspacePanelWidth,
  getDefaultWorkspacePanelWidth,
  isRightPanelTab
} from '../workspace-layout'

describe('workspace panel layout', () => {
  it('clamps panel widths to ergonomic bounds and viewport share', () => {
    expect(clampWorkspacePanelWidth('left', 80, 1440)).toBe(232)
    expect(clampWorkspacePanelWidth('left', 900, 1024)).toBe(348)
    expect(clampWorkspacePanelWidth('right', 900, 1440)).toBe(520)
  })

  it('provides default panel widths inside the same clamp rules', () => {
    expect(getDefaultWorkspacePanelWidth('left', 1440)).toBe(296)
    expect(getDefaultWorkspacePanelWidth('right', 1440)).toBe(344)
  })

  it('validates right panel tabs', () => {
    expect(isRightPanelTab('foreshadow')).toBe(true)
    expect(isRightPanelTab('characters')).toBe(true)
    expect(isRightPanelTab('outline')).toBe(false)
  })

  it('chooses a context tab by urgency when no stored tab exists', () => {
    expect(
      chooseDefaultRightPanelTab({
        warningCount: 1,
        currentChapterCharacterCount: 4
      })
    ).toBe('foreshadow')
    expect(
      chooseDefaultRightPanelTab({
        warningCount: 0,
        currentChapterCharacterCount: 4
      })
    ).toBe('characters')
    expect(
      chooseDefaultRightPanelTab({
        warningCount: 0,
        currentChapterCharacterCount: 0
      })
    ).toBe('notes')
  })

  it('keeps a stored tab as a user preference', () => {
    expect(
      chooseDefaultRightPanelTab({
        storedTab: 'notes',
        warningCount: 2,
        currentChapterCharacterCount: 4
      })
    ).toBe('notes')
  })
})

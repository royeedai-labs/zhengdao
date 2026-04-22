import { describe, expect, it } from 'vitest'
import {
  clampAiAssistantPanelRect,
  createDefaultAiAssistantPanelRect,
  resizeAiAssistantPanelRect,
  translateAiAssistantPanelRect
} from '../panel-layout'

describe('createDefaultAiAssistantPanelRect', () => {
  it('creates a bottom-right panel rect within the viewport', () => {
    expect(createDefaultAiAssistantPanelRect(1440, 900)).toEqual({
      x: 1004,
      y: 108,
      width: 420,
      height: 680
    })
  })
})

describe('clampAiAssistantPanelRect', () => {
  it('keeps the panel inside the viewport and enforces min/max size', () => {
    expect(
      clampAiAssistantPanelRect(
        { x: -80, y: -20, width: 1200, height: 900 },
        980,
        720
      )
    ).toEqual({
      x: 16,
      y: 16,
      width: 748,
      height: 688
    })
  })
})

describe('translateAiAssistantPanelRect', () => {
  it('moves the panel but clamps it back into the viewport', () => {
    expect(
      translateAiAssistantPanelRect(
        { x: 600, y: 120, width: 420, height: 560 },
        500,
        400,
        1280,
        800
      )
    ).toEqual({
      x: 844,
      y: 224,
      width: 420,
      height: 560
    })
  })
})

describe('resizeAiAssistantPanelRect', () => {
  it('resizes from the bottom-right handle and preserves viewport bounds', () => {
    expect(
      resizeAiAssistantPanelRect(
        { x: 860, y: 160, width: 360, height: 520 },
        300,
        260,
        1280,
        820
      )
    ).toEqual({
      x: 860,
      y: 160,
      width: 404,
      height: 644
    })
  })
})

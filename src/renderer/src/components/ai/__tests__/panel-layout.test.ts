import { describe, expect, it } from 'vitest'
import {
  clampAiAssistantLauncherPosition,
  clampAiAssistantPanelRect,
  createDefaultAiAssistantLauncherPosition,
  createDefaultAiAssistantPanelRect,
  translateAiAssistantLauncherPosition,
  resizeAiAssistantPanelRect,
  translateAiAssistantPanelRect
} from '../panel-layout'

describe('createDefaultAiAssistantPanelRect', () => {
  it('creates a panel rect that leaves room for the right context panel', () => {
    expect(createDefaultAiAssistantPanelRect(1440, 900)).toEqual({
      x: 644,
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

describe('createDefaultAiAssistantLauncherPosition', () => {
  it('creates the collapsed launcher away from the right context panel', () => {
    expect(createDefaultAiAssistantLauncherPosition(1440, 900)).toEqual({
      x: 1016,
      y: 676
    })
  })
})

describe('clampAiAssistantLauncherPosition', () => {
  it('keeps the collapsed launcher inside the viewport', () => {
    expect(clampAiAssistantLauncherPosition({ x: 999, y: -24 }, 640, 480)).toEqual({
      x: 576,
      y: 16
    })
  })
})

describe('translateAiAssistantLauncherPosition', () => {
  it('moves the collapsed launcher but clamps it back into the viewport', () => {
    expect(
      translateAiAssistantLauncherPosition(
        { x: 560, y: 360 },
        200,
        200,
        640,
        480
      )
    ).toEqual({
      x: 576,
      y: 416
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

import { describe, expect, it } from 'vitest'
import { isThemeId, resolveThemeMode, THEME_LABELS, THEME_TOKENS } from '../themes'

describe('theme mode resolution', () => {
  it('uses system preference for the system theme mode', () => {
    expect(resolveThemeMode('system', false)).toBe('light')
    expect(resolveThemeMode('system', true)).toBe('dark')
  })

  it('keeps manual theme choices as explicit overrides', () => {
    expect(resolveThemeMode('light', true)).toBe('light')
    expect(resolveThemeMode('dark', false)).toBe('dark')
    expect(resolveThemeMode('dark-oled', false)).toBe('dark-oled')
  })

  it('recognizes the supported theme ids and labels system first', () => {
    expect(isThemeId('system')).toBe(true)
    expect(isThemeId('light')).toBe(true)
    expect(isThemeId('neon-purple')).toBe(false)
    expect(THEME_LABELS.system).toBe('跟随系统')
  })

  it('defines cold-white tokens for the light theme', () => {
    expect(THEME_TOKENS.light['--bg-primary']).toBe('#f4f7fb')
    expect(THEME_TOKENS.light['--accent-primary']).toBe('#3f6f9f')
  })
})

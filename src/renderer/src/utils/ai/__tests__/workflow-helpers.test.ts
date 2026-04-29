import { describe, expect, it } from 'vitest'
import {
  buildContextText,
  clip,
  nonEmpty,
  section
} from '../workflow/helpers'

/**
 * SPLIT-008 — boundary-lock test for shared workflow helpers.
 *
 * `nonEmpty` / `clip` / `section` / `buildContextText` were private
 * inside `assistant-workflow.ts`. The split moved them to `workflow/helpers.ts`
 * where canon-pack / context / prompt all import from. A regression
 * here would silently mis-truncate user content or drop chapter context,
 * so we pin the contract.
 */

describe('nonEmpty', () => {
  it.each([
    [undefined, false],
    [null, false],
    ['', false],
    ['   ', false],
    ['x', true],
    [' x ', true]
  ])('nonEmpty(%j) -> %s', (input, expected) => {
    expect(nonEmpty(input as string | null | undefined)).toBe(expected)
  })
})

describe('clip', () => {
  it('keeps text under the cap as-is', () => {
    expect(clip('hello', 10)).toBe('hello')
  })

  it('trims whitespace before measuring', () => {
    expect(clip('   hello   ', 10)).toBe('hello')
  })

  it('cuts long text into head + ellipsis + tail', () => {
    const long = 'a'.repeat(50) + 'b'.repeat(50)
    const out = clip(long, 30)
    expect(out).toContain('...[已裁剪]...')
    expect(out.startsWith('a')).toBe(true)
    expect(out.endsWith('b')).toBe(true)
  })

  it('respects the head:tail ratio when cutting', () => {
    const long = 'a'.repeat(50) + 'b'.repeat(50)
    const out = clip(long, 40)
    // Default ratio: head = floor(40 * 0.35) = 14 a's, tail = 26 b's.
    expect(out.indexOf('a'.repeat(14))).toBe(0)
    expect(out.endsWith('b'.repeat(26))).toBe(true)
  })
})

describe('section', () => {
  it('returns empty for empty body', () => {
    expect(section('Title', '')).toBe('')
    expect(section('Title', null)).toBe('')
    expect(section('Title', undefined)).toBe('')
    expect(section('Title', '   ')).toBe('')
  })

  it('formats as markdown H2 with trimmed body', () => {
    expect(section('Title', '  body  ')).toBe('## Title\nbody')
  })
})

describe('buildContextText', () => {
  it('joins enabled blocks with double newlines, drops empty bodies', () => {
    const out = buildContextText([
      { chip: { id: 'a', kind: 'chapter', label: 'A', enabled: true }, body: 'first' },
      { chip: { id: 'b', kind: 'chapter', label: 'B', enabled: false }, body: 'skipped' },
      { chip: { id: 'c', kind: 'chapter', label: 'C', enabled: true }, body: '   ' },
      { chip: { id: 'd', kind: 'chapter', label: 'D', enabled: true }, body: 'second' }
    ])
    expect(out).toBe('first\n\nsecond')
  })

  it('returns empty string when no blocks are enabled', () => {
    expect(
      buildContextText([
        { chip: { id: 'a', kind: 'chapter', label: 'A', enabled: false }, body: 'x' }
      ])
    ).toBe('')
  })
})

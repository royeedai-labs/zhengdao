import { describe, expect, it } from 'vitest'
import {
  buildChangelogEntry,
  bumpSemver,
  formatReleaseDate,
  parseReleaseArgs,
  prependChangelogEntry
} from './release-utils.mjs'

describe('release-utils', () => {
  it('bumps patch versions', () => {
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4')
  })

  it('bumps minor versions', () => {
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0')
  })

  it('bumps major versions', () => {
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0')
  })

  it('parses release args with summary and dry run', () => {
    expect(parseReleaseArgs(['patch', 'First public release', '--dry-run'])).toEqual({
      dryRun: true,
      explicitVersion: null,
      releaseType: 'patch',
      summary: 'First public release'
    })
  })

  it('prepends a changelog entry after the changelog header', () => {
    const entry = buildChangelogEntry({
      version: '1.0.1',
      summary: 'Patch release',
      date: formatReleaseDate(new Date('2026-04-20T00:00:00.000Z'))
    })

    const updated = prependChangelogEntry(
      '# Changelog\n\nAll notable changes.\n\n## v1.0.0 - 2026-04-20\n\n### Release\n\n- Initial release.\n',
      entry
    )

    expect(updated).toContain('## v1.0.1 - 2026-04-20')
    expect(updated).not.toMatch(/Fill in|TODO/)
    expect(updated.indexOf('## v1.0.1 - 2026-04-20')).toBeLessThan(
      updated.indexOf('## v1.0.0 - 2026-04-20')
    )
  })
})

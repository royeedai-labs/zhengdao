export function bumpSemver(version, releaseType) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`)
  }

  const [, majorString, minorString, patchString] = match
  const major = Number.parseInt(majorString, 10)
  const minor = Number.parseInt(minorString, 10)
  const patch = Number.parseInt(patchString, 10)

  switch (releaseType) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
    default:
      throw new Error(`Unsupported release type: ${releaseType}`)
  }
}

export function parseReleaseArgs(argv) {
  const args = [...argv]
  const options = {
    dryRun: false,
    explicitVersion: null,
    releaseType: null,
    summary: ''
  }

  while (args.length > 0) {
    const token = args.shift()

    if (!token) {
      continue
    }

    if (token === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (token === '--version') {
      const version = args.shift()

      if (!version) {
        throw new Error('Missing value for --version')
      }

      options.explicitVersion = version
      continue
    }

    if (!options.releaseType && ['patch', 'minor', 'major'].includes(token)) {
      options.releaseType = token
      continue
    }

    options.summary = [options.summary, token].filter(Boolean).join(' ')
  }

  if (!options.releaseType && !options.explicitVersion) {
    throw new Error('Usage: <patch|minor|major> "summary" [--dry-run] [--version x.y.z]')
  }

  return options
}

export function formatReleaseDate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function buildChangelogEntry({ version, summary, date }) {
  const releaseSummary = summary || `Release v${version}`

  return [
    `## v${version} - ${date}`,
    '',
    '### Release',
    '',
    `- ${releaseSummary}`,
    ''
  ].join('\n')
}

export function prependChangelogEntry(existingContent, entry) {
  const normalized = existingContent.trimStart()

  if (!normalized.startsWith('# Changelog')) {
    throw new Error('CHANGELOG.md must start with "# Changelog"')
  }

  if (existingContent.includes(entry.split('\n')[0])) {
    throw new Error(`Changelog entry already exists: ${entry.split('\n')[0]}`)
  }

  const headerEnd = existingContent.indexOf('\n## ')

  if (headerEnd === -1) {
    return `${existingContent.trimEnd()}\n\n${entry}\n`
  }

  const header = existingContent.slice(0, headerEnd).trimEnd()
  const body = existingContent.slice(headerEnd).trimStart()

  return `${header}\n\n${entry}\n${body}`
}

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowPath = resolve(process.cwd(), '.github/workflows/release.yml')
const workflow = readFileSync(workflowPath, 'utf8')

function extractJobCommands(jobName) {
  const start = workflow.indexOf(`  ${jobName}:`)

  if (start === -1) {
    throw new Error(`Missing workflow job: ${jobName}`)
  }

  const remainder = workflow.slice(start + 1)
  const nextJob = remainder.search(/\n  [a-zA-Z0-9_-]+:\n/)
  const jobSection = nextJob === -1 ? remainder : remainder.slice(0, nextJob)

  return [...jobSection.matchAll(/^\s+- run: (.+)$/gm)].map((match) => match[1])
}

function expectCommandBefore(commands, beforeCommand, afterCommand) {
  const beforeIndex = commands.indexOf(beforeCommand)
  const afterIndex = commands.findIndex((command) => command.startsWith(afterCommand))

  expect(beforeIndex, `Missing command: ${beforeCommand}`).toBeGreaterThanOrEqual(0)
  expect(afterIndex, `Missing command starting with: ${afterCommand}`).toBeGreaterThanOrEqual(0)
  expect(beforeIndex, `${beforeCommand} must run before ${afterCommand}`).toBeLessThan(afterIndex)
}

describe('release workflow native module ABI handling', () => {
  for (const jobName of ['build-macos', 'build-windows']) {
    it(`${jobName} restores Electron ABI before packaging`, () => {
      const commands = extractJobCommands(jobName)

      expectCommandBefore(commands, 'npm rebuild better-sqlite3', 'npm test')
      expectCommandBefore(commands, 'npm test', 'npm run build')
      expectCommandBefore(commands, 'npm run build', 'npx electron-builder install-app-deps')
      expectCommandBefore(
        commands,
        'npx electron-builder install-app-deps',
        'npx electron-builder --config electron-builder.config.ts'
      )
    })
  }
})

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const electronVersion = require('electron/package.json').version
const rebuildCli = require.resolve('@electron/rebuild/lib/cli.js')
const arch = process.argv[2] || process.arch

console.log(`Rebuilding native modules for Electron ${electronVersion} (${arch})`)

execFileSync(
  process.execPath,
  [
    rebuildCli,
    '--force',
    '--which-module',
    'better-sqlite3',
    '--version',
    electronVersion,
    '--arch',
    arch,
    '--module-dir',
    repoRoot
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit'
  }
)

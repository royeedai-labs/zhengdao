import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const electronPath = require('electron')
const betterSqlitePath = resolve(repoRoot, 'node_modules/better-sqlite3')

const smokeScript = `
const Database = require(${JSON.stringify(betterSqlitePath)});
const db = new Database(':memory:');
const row = db.prepare('select 1 as ok').get();
db.close();
if (row.ok !== 1) {
  throw new Error('better-sqlite3 smoke query failed');
}
console.log('better-sqlite3 Electron ABI smoke passed');
`

execFileSync(electronPath, ['-e', smokeScript], {
  cwd: repoRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1'
  },
  stdio: 'inherit'
})

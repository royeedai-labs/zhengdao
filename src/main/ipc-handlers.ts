import { autoBackup } from './backup/auto-backup'
import { registerAiIpc } from './ipc/register-ai-ipc'
import { handleZhengdaoAuthCallbackUrl, registerAuthIpc } from './ipc/register-auth-ipc'
import { registerBookCoverIpc } from './ipc/register-book-cover-ipc'
import { registerDatabaseIpc } from './ipc/register-database-ipc'
import { registerFsIpc } from './ipc/register-fs-ipc'
import { registerMcpIpc } from './ipc/register-mcp-ipc'
import { registerProFeatureIpc } from './ipc/register-pro-feature-ipc'
import { registerSyncIpc } from './ipc/register-sync-ipc'
import { registerTeamIpc } from './ipc/register-team-ipc'
import { registerUpdateIpc } from './ipc/register-update-ipc'
import { registerWritingIntelIpc } from './ipc/register-writing-intel-ipc'

/**
 * SPLIT-007 — IPC handler entrypoint.
 *
 * The original 793-line file mixed local-SQLite endpoints, AI streaming,
 * auth callbacks, team-collab forwarding, auto-updater, file dialogs,
 * and cloud-sync logic. After the split, each domain owns its own
 * register-* fn under `ipc/`; this file only fixes the registration
 * order (databaseIpc first so search index is ready before any later
 * module touches it).
 *
 * `handleZhengdaoAuthCallbackUrl` is re-exported so main/index.ts can
 * keep importing both symbols from `./ipc-handlers`.
 */
export function registerIpcHandlers(): void {
  registerDatabaseIpc()
  registerBookCoverIpc()
  registerAiIpc()
  registerProFeatureIpc()
  registerMcpIpc()
  registerAuthIpc()
  registerTeamIpc()
  registerWritingIntelIpc()
  registerUpdateIpc()
  registerFsIpc()
  registerSyncIpc()

  // Kick off auto-backup once everything is wired. The function reads its
  // schedule from app-state-repo, so the database handlers must already be
  // registered (they are — registerDatabaseIpc runs first above).
  autoBackup.startFromStoredConfig()
}

export { handleZhengdaoAuthCallbackUrl }

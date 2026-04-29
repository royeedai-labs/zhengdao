/**
 * SPLIT-009 — IPC channel registry shared by main / preload / renderer.
 *
 * Every IPC channel name lives here as a string-literal union so that
 *   - main process registers (`ipcMain.handle`) can be type-checked
 *   - preload (`ipcRenderer.invoke`) is anchored to the same set
 *   - renderer code that reaches `window.api.foo` is one drift away
 *     from the contract change
 *
 * `ElectronAPI` (the renderer-facing window.api shape) stays in
 * preload/index.ts because deriving it from `typeof api` is the only
 * way to keep the method signatures in lockstep with the const that
 * `contextBridge.exposeInMainWorld('api', api)` actually exposes.
 *
 * tsconfig boundaries forbid `shared/` from depending on `preload/`,
 * so we publish the channel inventory here and keep ElectronAPI
 * accessible via `import type { ElectronAPI } from '../preload/index'`
 * inside `renderer/env.d.ts` (the only place that needs it).
 */

/**
 * Channels that follow request/response semantics. Renderer calls them
 * via `ipcRenderer.invoke`; main registers them via `ipcMain.handle`.
 *
 * The list is grouped by prefix to mirror `src/main/ipc/register-*-ipc.ts`
 * — adding a handler in one of those modules MUST add a literal here too,
 * which is what makes the contract type-safe.
 */
export type IpcInvokeChannel =
  // db:* — local SQLite repos (registerDatabaseIpc)
  | 'db:getBooks'
  | 'db:createBook'
  | 'db:createBookFromAiPackage'
  | 'db:deleteBook'
  | 'db:getBookStats'
  | 'db:getConfig'
  | 'db:saveConfig'
  | 'db:getGenreTemplates'
  | 'db:createGenreTemplate'
  | 'db:updateGenreTemplate'
  | 'db:copyGenreTemplate'
  | 'db:deleteGenreTemplate'
  | 'db:getCustomShortcuts'
  | 'db:setCustomShortcut'
  | 'db:getVolumes'
  | 'db:createVolume'
  | 'db:updateVolume'
  | 'db:deleteVolume'
  | 'db:getChapters'
  | 'db:getChapter'
  | 'db:createChapter'
  | 'db:updateChapter'
  | 'db:updateChapterTitle'
  | 'db:updateChapterSummary'
  | 'db:deleteChapter'
  | 'db:getAllChaptersForBook'
  | 'db:getVolumesWithChapters'
  | 'db:getChapterTemplates'
  | 'db:createChapterTemplate'
  | 'db:deleteChapterTemplate'
  | 'db:reorderChapters'
  | 'db:reorderVolumes'
  | 'db:moveChapter'
  | 'db:searchChapters'
  | 'db:rebuildSearchIndex'
  | 'db:getTrashItems'
  | 'db:restoreItem'
  | 'db:permanentDeleteItem'
  | 'db:emptyTrash'
  | 'db:getCharacters'
  | 'db:createCharacter'
  | 'db:updateCharacter'
  | 'db:deleteCharacter'
  | 'db:getCharacterAppearances'
  | 'db:getChapterAppearances'
  | 'db:syncAppearances'
  | 'db:getBookAppearances'
  | 'db:getRelations'
  | 'db:createRelation'
  | 'db:updateRelation'
  | 'db:deleteRelation'
  | 'db:getMilestones'
  | 'db:createMilestone'
  | 'db:deleteMilestone'
  | 'db:getPlotNodes'
  | 'db:createPlotNode'
  | 'db:updatePlotNode'
  | 'db:deletePlotNode'
  | 'db:getPlotNodeCharacters'
  | 'db:setPlotNodeCharacters'
  | 'db:getCharacterPlotNodes'
  | 'db:getPlotCharacterLinksForBook'
  | 'db:getPlotlines'
  | 'db:createPlotline'
  | 'db:updatePlotline'
  | 'db:deletePlotline'
  | 'db:getForeshadowings'
  | 'db:createForeshadowing'
  | 'db:updateForeshadowingStatus'
  | 'db:deleteForeshadowing'
  | 'db:checkForeshadowings'
  | 'db:getWikiCategories'
  | 'db:getWikiEntries'
  | 'db:createWikiEntry'
  | 'db:updateWikiEntry'
  | 'db:deleteWikiEntry'
  | 'db:listCitations'
  | 'db:createCitation'
  | 'db:updateCitation'
  | 'db:deleteCitation'
  | 'db:createSnapshot'
  | 'db:getSnapshots'
  | 'db:cleanOldSnapshots'
  | 'db:getDailyStats'
  | 'db:updateDailyStats'
  | 'db:getStatsRange'
  | 'db:getAchievementStats'
  | 'db:getAchievements'
  | 'db:getUnlockedAchievementTypes'
  | 'db:unlockAchievement'
  | 'db:createSession'
  | 'db:endSession'
  | 'db:getSessionsToday'
  | 'db:getRecentChapters'
  | 'db:getNotes'
  | 'db:createNote'
  | 'db:deleteNote'
  | 'db:getAppState'
  | 'db:setAppState'
  | 'db:getAnnotations'
  | 'db:createAnnotation'
  | 'db:updateAnnotation'
  | 'db:deleteAnnotation'

  // ai:* — official + Gemini CLI bridge (registerAiIpc)
  | 'ai:getGlobalConfig'
  | 'ai:saveGlobalConfig'
  | 'ai:getSkillTemplates'
  | 'ai:updateSkillTemplate'
  | 'ai:getWorkProfile'
  | 'ai:saveWorkProfile'
  | 'ai:getSkillOverrides'
  | 'ai:upsertSkillOverride'
  | 'ai:deleteSkillOverride'
  | 'ai:getOrCreateConversation'
  | 'ai:createConversation'
  | 'ai:getConversations'
  | 'ai:updateConversationTitle'
  | 'ai:clearConversation'
  | 'ai:deleteConversation'
  | 'ai:getMessages'
  | 'ai:addMessage'
  | 'ai:getDrafts'
  | 'ai:createDraft'
  | 'ai:setDraftStatus'
  | 'ai:getResolvedGlobalConfig'
  | 'ai:getResolvedConfigForBook'
  | 'ai:getResolvedWorkspaceConfig'
  | 'ai:complete'
  | 'ai:getOfficialProfiles'
  | 'ai:executeSkill'
  | 'ai:getProviderStatus'
  | 'ai:setupGeminiCli'

  // auth:* — Zhengdao OAuth (registerAuthIpc)
  | 'auth:login'
  | 'auth:getUser'
  | 'auth:logout'
  | 'auth:getAccessToken'
  | 'auth:openUpgradePage'
  | 'auth:openAccountPage'

  // team:* — DI-06 v2 team collaboration (registerTeamIpc)
  | 'team:listMine'
  | 'team:create'
  | 'team:listMembers'
  | 'team:removeMember'
  | 'team:listInvitations'
  | 'team:createInvitation'
  | 'team:revokeInvitation'
  | 'team:acceptInvitation'

  // app:* + window:* — auto-updater, native notifications, window chrome
  | 'app:getUpdateState'
  | 'app:getAppVersion'
  | 'app:checkForUpdates'
  | 'app:downloadUpdate'
  | 'app:downloadManualInstallerUpdate'
  | 'app:installDownloadedUpdate'
  | 'app:reloadWindow'
  | 'window:notify'
  | 'window:setFullScreen'
  | 'window:isFullScreen'
  | 'window:isMaximized'
  | 'window:toggleMaximize'

  // sync:* + backup:* + data:* — cloud sync, local rotating backups, full export
  | 'sync:uploadBook'
  | 'sync:listCloudBooks'
  | 'sync:downloadBook'
  | 'backup:configure'
  | 'backup:now'
  | 'backup:list'
  | 'backup:restore'
  | 'backup:restoreFrom'
  | 'data:exportFull'
  | 'data:importFull'

  // fs:* + dialog:* + export:* — restricted-path writes + native dialogs + PDF
  | 'fs:writeFile'
  | 'dialog:showSave'
  | 'dialog:openImportFile'
  | 'dialog:openDirectory'
  | 'export:pdf';

/**
 * Channels that the renderer fires-and-forgets via `ipcRenderer.send`,
 * carrying a request body to the main process. Currently only the
 * streaming AI bridge needs this shape.
 */
export type IpcSendChannel = 'ai:streamComplete' | 'ai:cancelStream';

/**
 * Channels that the main process broadcasts back to the renderer via
 * `webContents.send` / `event.sender.send`. The renderer subscribes via
 * `ipcRenderer.on(channel, listener)`.
 */
export type IpcReceiveChannel =
  | 'auth:updated'
  | 'app:updateState'
  | 'ai:streamToken'
  | 'ai:streamComplete'
  | 'ai:streamError';

/**
 * Runtime channel inventory — useful when an IDE plugin or test wants to
 * iterate over every name we expose. Keep in lockstep with the literal
 * unions above; the type-level test in `__tests__/ipc-api.test.ts` keeps
 * them honest.
 */
export const IPC_INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'db:getBooks', 'db:createBook', 'db:createBookFromAiPackage', 'db:deleteBook', 'db:getBookStats',
  'db:getConfig', 'db:saveConfig', 'db:getGenreTemplates', 'db:createGenreTemplate',
  'db:updateGenreTemplate', 'db:copyGenreTemplate', 'db:deleteGenreTemplate',
  'db:getCustomShortcuts', 'db:setCustomShortcut',
  'db:getVolumes', 'db:createVolume', 'db:updateVolume', 'db:deleteVolume',
  'db:getChapters', 'db:getChapter', 'db:createChapter', 'db:updateChapter',
  'db:updateChapterTitle', 'db:updateChapterSummary', 'db:deleteChapter',
  'db:getAllChaptersForBook', 'db:getVolumesWithChapters',
  'db:getChapterTemplates', 'db:createChapterTemplate', 'db:deleteChapterTemplate',
  'db:reorderChapters', 'db:reorderVolumes', 'db:moveChapter',
  'db:searchChapters', 'db:rebuildSearchIndex',
  'db:getTrashItems', 'db:restoreItem', 'db:permanentDeleteItem', 'db:emptyTrash',
  'db:getCharacters', 'db:createCharacter', 'db:updateCharacter', 'db:deleteCharacter',
  'db:getCharacterAppearances', 'db:getChapterAppearances', 'db:syncAppearances',
  'db:getBookAppearances', 'db:getRelations', 'db:createRelation', 'db:updateRelation',
  'db:deleteRelation', 'db:getMilestones', 'db:createMilestone', 'db:deleteMilestone',
  'db:getPlotNodes', 'db:createPlotNode', 'db:updatePlotNode', 'db:deletePlotNode',
  'db:getPlotNodeCharacters', 'db:setPlotNodeCharacters',
  'db:getCharacterPlotNodes', 'db:getPlotCharacterLinksForBook',
  'db:getPlotlines', 'db:createPlotline', 'db:updatePlotline', 'db:deletePlotline',
  'db:getForeshadowings', 'db:createForeshadowing', 'db:updateForeshadowingStatus',
  'db:deleteForeshadowing', 'db:checkForeshadowings',
  'db:getWikiCategories', 'db:getWikiEntries', 'db:createWikiEntry',
  'db:updateWikiEntry', 'db:deleteWikiEntry',
  'db:listCitations', 'db:createCitation', 'db:updateCitation', 'db:deleteCitation',
  'db:createSnapshot', 'db:getSnapshots', 'db:cleanOldSnapshots',
  'db:getDailyStats', 'db:updateDailyStats', 'db:getStatsRange',
  'db:getAchievementStats', 'db:getAchievements', 'db:getUnlockedAchievementTypes',
  'db:unlockAchievement', 'db:createSession', 'db:endSession', 'db:getSessionsToday',
  'db:getRecentChapters',
  'db:getNotes', 'db:createNote', 'db:deleteNote',
  'db:getAppState', 'db:setAppState',
  'db:getAnnotations', 'db:createAnnotation', 'db:updateAnnotation', 'db:deleteAnnotation',
  'ai:getGlobalConfig', 'ai:saveGlobalConfig', 'ai:getSkillTemplates', 'ai:updateSkillTemplate',
  'ai:getWorkProfile', 'ai:saveWorkProfile', 'ai:getSkillOverrides',
  'ai:upsertSkillOverride', 'ai:deleteSkillOverride',
  'ai:getOrCreateConversation', 'ai:createConversation', 'ai:getConversations',
  'ai:updateConversationTitle', 'ai:clearConversation', 'ai:deleteConversation',
  'ai:getMessages', 'ai:addMessage', 'ai:getDrafts', 'ai:createDraft', 'ai:setDraftStatus',
  'ai:getResolvedGlobalConfig', 'ai:getResolvedConfigForBook', 'ai:getResolvedWorkspaceConfig',
  'ai:complete', 'ai:getOfficialProfiles', 'ai:executeSkill', 'ai:getProviderStatus',
  'ai:setupGeminiCli',
  'auth:login', 'auth:getUser', 'auth:logout', 'auth:getAccessToken',
  'auth:openUpgradePage', 'auth:openAccountPage',
  'team:listMine', 'team:create', 'team:listMembers', 'team:removeMember',
  'team:listInvitations', 'team:createInvitation', 'team:revokeInvitation',
  'team:acceptInvitation',
  'app:getUpdateState', 'app:getAppVersion', 'app:checkForUpdates', 'app:downloadUpdate',
  'app:downloadManualInstallerUpdate', 'app:installDownloadedUpdate', 'app:reloadWindow',
  'window:notify', 'window:setFullScreen', 'window:isFullScreen',
  'window:isMaximized', 'window:toggleMaximize',
  'sync:uploadBook', 'sync:listCloudBooks', 'sync:downloadBook',
  'backup:configure', 'backup:now', 'backup:list', 'backup:restore', 'backup:restoreFrom',
  'data:exportFull', 'data:importFull',
  'fs:writeFile',
  'dialog:showSave', 'dialog:openImportFile', 'dialog:openDirectory',
  'export:pdf'
] as const;

export const IPC_SEND_CHANNELS: readonly IpcSendChannel[] = [
  'ai:streamComplete',
  'ai:cancelStream'
] as const;

export const IPC_RECEIVE_CHANNELS: readonly IpcReceiveChannel[] = [
  'auth:updated',
  'app:updateState',
  'ai:streamToken',
  'ai:streamComplete',
  'ai:streamError'
] as const;

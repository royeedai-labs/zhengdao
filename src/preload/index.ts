import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ManualInstallerDownloadResult, UpdateSnapshot } from '../shared/update'
import type { AiBridgeCompleteRequest, AiOfficialProfile, AiResponse, AiStreamCallbacks } from '../shared/ai'
import type { AiBookCreationPackage, AssistantCreationBrief } from '../shared/ai-book-creation'

let aiStreamRequestSeq = 0

const api = {
  // Books
  getBooks: () => ipcRenderer.invoke('db:getBooks'),
  createBook: (data: { title: string; author: string }) => ipcRenderer.invoke('db:createBook', data),
  createBookFromAiPackage: (data: {
    brief: AssistantCreationBrief
    package: AiBookCreationPackage
    messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string; metadata?: unknown }>
  }) => ipcRenderer.invoke('db:createBookFromAiPackage', data),
  deleteBook: (id: number) => ipcRenderer.invoke('db:deleteBook', id),
  getBookStats: (bookId: number) => ipcRenderer.invoke('db:getBookStats', bookId),

  // Config
  getConfig: (bookId: number) => ipcRenderer.invoke('db:getConfig', bookId),
  saveConfig: (bookId: number, config: Record<string, unknown>) => ipcRenderer.invoke('db:saveConfig', bookId, config),
  getGenreTemplates: () => ipcRenderer.invoke('db:getGenreTemplates'),
  createGenreTemplate: (data: Record<string, unknown>) => ipcRenderer.invoke('db:createGenreTemplate', data),
  updateGenreTemplate: (id: number, updates: Record<string, unknown>) => ipcRenderer.invoke('db:updateGenreTemplate', id, updates),
  copyGenreTemplate: (id: number) => ipcRenderer.invoke('db:copyGenreTemplate', id),
  deleteGenreTemplate: (id: number) => ipcRenderer.invoke('db:deleteGenreTemplate', id),
  getCustomShortcuts: () => ipcRenderer.invoke('db:getCustomShortcuts'),
  setCustomShortcut: (action: string, keys: string) => ipcRenderer.invoke('db:setCustomShortcut', action, keys),

  // Volumes
  getVolumes: (bookId: number) => ipcRenderer.invoke('db:getVolumes', bookId),
  createVolume: (data: { book_id: number; title: string }) => ipcRenderer.invoke('db:createVolume', data),
  updateVolume: (id: number, title: string) => ipcRenderer.invoke('db:updateVolume', id, title),
  deleteVolume: (id: number) => ipcRenderer.invoke('db:deleteVolume', id),

  // Chapters
  getChapters: (volumeId: number) => ipcRenderer.invoke('db:getChapters', volumeId),
  getChapter: (id: number) => ipcRenderer.invoke('db:getChapter', id),
  createChapter: (data: { volume_id: number; title: string; content?: string; summary?: string }) =>
    ipcRenderer.invoke('db:createChapter', data),
  getChapterTemplates: (bookId: number) => ipcRenderer.invoke('db:getChapterTemplates', bookId),
  createChapterTemplate: (bookId: number, name: string, content: string) =>
    ipcRenderer.invoke('db:createChapterTemplate', bookId, name, content),
  deleteChapterTemplate: (id: number) => ipcRenderer.invoke('db:deleteChapterTemplate', id),
  updateChapter: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('db:updateChapter', id, data),
  updateChapterTitle: (id: number, title: string) => ipcRenderer.invoke('db:updateChapterTitle', id, title),
  updateChapterSummary: (id: number, summary: string) =>
    ipcRenderer.invoke('db:updateChapterSummary', id, summary),
  deleteChapter: (id: number) => ipcRenderer.invoke('db:deleteChapter', id),
  getAllChaptersForBook: (bookId: number) => ipcRenderer.invoke('db:getAllChaptersForBook', bookId),
  getVolumesWithChapters: (bookId: number) => ipcRenderer.invoke('db:getVolumesWithChapters', bookId),
  reorderChapters: (volumeId: number, chapterIds: number[]) =>
    ipcRenderer.invoke('db:reorderChapters', volumeId, chapterIds),
  reorderVolumes: (bookId: number, volumeIds: number[]) => ipcRenderer.invoke('db:reorderVolumes', bookId, volumeIds),
  moveChapter: (chapterId: number, targetVolumeId: number) => ipcRenderer.invoke('db:moveChapter', chapterId, targetVolumeId),

  searchChapters: (query: string, bookId?: number) => ipcRenderer.invoke('db:searchChapters', query, bookId),
  rebuildSearchIndex: () => ipcRenderer.invoke('db:rebuildSearchIndex'),
  getTrashItems: (bookId: number) => ipcRenderer.invoke('db:getTrashItems', bookId),
  restoreItem: (kind: 'chapter' | 'volume' | 'character' | 'foreshadowing', id: number) =>
    ipcRenderer.invoke('db:restoreItem', kind, id),
  permanentDeleteItem: (kind: 'chapter' | 'volume' | 'character' | 'foreshadowing', id: number) =>
    ipcRenderer.invoke('db:permanentDeleteItem', kind, id),
  emptyTrash: (bookId: number) => ipcRenderer.invoke('db:emptyTrash', bookId),

  // Characters
  getCharacters: (bookId: number) => ipcRenderer.invoke('db:getCharacters', bookId),
  createCharacter: (data: Record<string, unknown>) => ipcRenderer.invoke('db:createCharacter', data),
  updateCharacter: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('db:updateCharacter', id, data),
  deleteCharacter: (id: number) => ipcRenderer.invoke('db:deleteCharacter', id),
  getCharacterAppearances: (characterId: number) => ipcRenderer.invoke('db:getCharacterAppearances', characterId),
  getChapterAppearances: (chapterId: number) => ipcRenderer.invoke('db:getChapterAppearances', chapterId),
  syncAppearances: (chapterId: number, characterIds: number[]) => ipcRenderer.invoke('db:syncAppearances', chapterId, characterIds),
  getBookAppearances: (bookId: number) => ipcRenderer.invoke('db:getBookAppearances', bookId),
  getRelations: (bookId: number) => ipcRenderer.invoke('db:getRelations', bookId),
  createRelation: (
    bookId: number,
    sourceId: number,
    targetId: number,
    relationType: string,
    label: string
  ) => ipcRenderer.invoke('db:createRelation', bookId, sourceId, targetId, relationType, label),
  updateRelation: (id: number, relationType: string, label: string) =>
    ipcRenderer.invoke('db:updateRelation', id, relationType, label),
  deleteRelation: (id: number) => ipcRenderer.invoke('db:deleteRelation', id),
  getMilestones: (characterId: number) => ipcRenderer.invoke('db:getMilestones', characterId),
  createMilestone: (characterId: number, chapterNumber: number, label: string, value: string) =>
    ipcRenderer.invoke('db:createMilestone', characterId, chapterNumber, label, value),
  deleteMilestone: (id: number) => ipcRenderer.invoke('db:deleteMilestone', id),

  // Plot Nodes
  getPlotNodes: (bookId: number) => ipcRenderer.invoke('db:getPlotNodes', bookId),
  createPlotNode: (data: Record<string, unknown>) => ipcRenderer.invoke('db:createPlotNode', data),
  updatePlotNode: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('db:updatePlotNode', id, data),
  deletePlotNode: (id: number) => ipcRenderer.invoke('db:deletePlotNode', id),
  getPlotNodeCharacters: (plotNodeId: number) => ipcRenderer.invoke('db:getPlotNodeCharacters', plotNodeId),
  setPlotNodeCharacters: (plotNodeId: number, characterIds: number[]) =>
    ipcRenderer.invoke('db:setPlotNodeCharacters', plotNodeId, characterIds),
  getCharacterPlotNodes: (characterId: number) => ipcRenderer.invoke('db:getCharacterPlotNodes', characterId),
  getPlotCharacterLinksForBook: (bookId: number) => ipcRenderer.invoke('db:getPlotCharacterLinksForBook', bookId),

  getPlotlines: (bookId: number) => ipcRenderer.invoke('db:getPlotlines', bookId),
  createPlotline: (bookId: number, name: string, color: string) =>
    ipcRenderer.invoke('db:createPlotline', bookId, name, color),
  updatePlotline: (id: number, name: string, color: string) => ipcRenderer.invoke('db:updatePlotline', id, name, color),
  deletePlotline: (id: number) => ipcRenderer.invoke('db:deletePlotline', id),

  // Foreshadowings
  getForeshadowings: (bookId: number) => ipcRenderer.invoke('db:getForeshadowings', bookId),
  createForeshadowing: (data: Record<string, unknown>) => ipcRenderer.invoke('db:createForeshadowing', data),
  updateForeshadowingStatus: (id: number, status: string) => ipcRenderer.invoke('db:updateForeshadowingStatus', id, status),
  deleteForeshadowing: (id: number) => ipcRenderer.invoke('db:deleteForeshadowing', id),
  checkForeshadowings: (bookId: number, totalWords: number, currentChapter: number) =>
    ipcRenderer.invoke('db:checkForeshadowings', bookId, totalWords, currentChapter),

  // Wiki
  getWikiCategories: (bookId: number) => ipcRenderer.invoke('db:getWikiCategories', bookId),
  getWikiEntries: (bookId: number, category: string) => ipcRenderer.invoke('db:getWikiEntries', bookId, category),
  createWikiEntry: (data: Record<string, unknown>) => ipcRenderer.invoke('db:createWikiEntry', data),
  updateWikiEntry: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('db:updateWikiEntry', id, data),
  deleteWikiEntry: (id: number) => ipcRenderer.invoke('db:deleteWikiEntry', id),

  // DI-06 v2 — 团队协作 (走 official auth token 调 /v1/teams/*)
  teamListMine: () => ipcRenderer.invoke('team:listMine'),
  teamCreate: (body: { name: string; plan?: string; seatLimit?: number }) =>
    ipcRenderer.invoke('team:create', body),
  teamListMembers: (teamId: string) => ipcRenderer.invoke('team:listMembers', teamId),
  teamRemoveMember: (teamId: string, userId: string) =>
    ipcRenderer.invoke('team:removeMember', teamId, userId),
  teamListInvitations: (teamId: string) => ipcRenderer.invoke('team:listInvitations', teamId),
  teamCreateInvitation: (
    teamId: string,
    body: { email: string; role?: 'admin' | 'member'; expiresInHours?: number }
  ) => ipcRenderer.invoke('team:createInvitation', teamId, body),
  teamRevokeInvitation: (teamId: string, invitationId: string) =>
    ipcRenderer.invoke('team:revokeInvitation', teamId, invitationId),
  teamAcceptInvitation: (invitationToken: string) =>
    ipcRenderer.invoke('team:acceptInvitation', invitationToken),

  // DI-02 v1 — 学术引文 (academic 题材专用)
  listCitations: (bookId: number) => ipcRenderer.invoke('db:listCitations', bookId),
  createCitation: (bookId: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:createCitation', bookId, data),
  updateCitation: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:updateCitation', id, data),
  deleteCitation: (id: number) => ipcRenderer.invoke('db:deleteCitation', id),

  // Snapshots
  createSnapshot: (data: { chapter_id: number; content: string; word_count: number }) =>
    ipcRenderer.invoke('db:createSnapshot', data),
  getSnapshots: (chapterId: number) => ipcRenderer.invoke('db:getSnapshots', chapterId),
  cleanOldSnapshots: () => ipcRenderer.invoke('db:cleanOldSnapshots'),

  // Daily Stats
  getDailyStats: (bookId: number, date: string) => ipcRenderer.invoke('db:getDailyStats', bookId, date),
  updateDailyStats: (bookId: number, date: string, wordCount: number) =>
    ipcRenderer.invoke('db:updateDailyStats', bookId, date, wordCount),
  getStatsRange: (bookId: number, fromDate: string, toDate: string) =>
    ipcRenderer.invoke('db:getStatsRange', bookId, fromDate, toDate),
  getAchievementStats: (bookId: number) => ipcRenderer.invoke('db:getAchievementStats', bookId),
  getAchievements: (bookId: number) => ipcRenderer.invoke('db:getAchievements', bookId),
  getUnlockedAchievementTypes: (bookId: number) => ipcRenderer.invoke('db:getUnlockedAchievementTypes', bookId),
  unlockAchievement: (bookId: number, type: string, label: string) =>
    ipcRenderer.invoke('db:unlockAchievement', bookId, type, label),

  createSession: (bookId: number) => ipcRenderer.invoke('db:createSession', bookId),
  endSession: (sessionId: number, wordCount: number) => ipcRenderer.invoke('db:endSession', sessionId, wordCount),
  getSessionsToday: (bookId: number) => ipcRenderer.invoke('db:getSessionsToday', bookId),

  getRecentChapters: (bookId: number, limit: number) => ipcRenderer.invoke('db:getRecentChapters', bookId, limit),

  notify: (title: string, body: string) => ipcRenderer.invoke('window:notify', title, body),

  // Notes
  getNotes: (bookId: number) => ipcRenderer.invoke('db:getNotes', bookId),
  createNote: (data: { book_id: number; content: string }) => ipcRenderer.invoke('db:createNote', data),
  deleteNote: (id: number) => ipcRenderer.invoke('db:deleteNote', id),

  // App State
  getAppState: (key: string) => ipcRenderer.invoke('db:getAppState', key),
  setAppState: (key: string, value: string) => ipcRenderer.invoke('db:setAppState', key, value),

  getAnnotations: (chapterId: number) => ipcRenderer.invoke('db:getAnnotations', chapterId),
  createAnnotation: (chapterId: number, textAnchor: string, content: string) =>
    ipcRenderer.invoke('db:createAnnotation', chapterId, textAnchor, content),
  updateAnnotation: (id: number, content: string) => ipcRenderer.invoke('db:updateAnnotation', id, content),
  deleteAnnotation: (id: number) => ipcRenderer.invoke('db:deleteAnnotation', id),

  authLogin: () => ipcRenderer.invoke('auth:login'),
  authGetUser: () => ipcRenderer.invoke('auth:getUser'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authGetAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
  authOpenUpgradePage: () => ipcRenderer.invoke('auth:openUpgradePage'),
  authOpenAccountPage: () => ipcRenderer.invoke('auth:openAccountPage'),
  onAuthUpdated: (handler: (user: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, user: unknown) => handler(user)
    ipcRenderer.on('auth:updated', listener)
    return () => {
      ipcRenderer.removeListener('auth:updated', listener)
    }
  },

  aiComplete: (request: AiBridgeCompleteRequest) =>
    ipcRenderer.invoke('ai:complete', request) as Promise<AiResponse>,
  aiStreamComplete: (request: AiBridgeCompleteRequest, callbacks: AiStreamCallbacks) => {
    const requestId = `ai-stream-${Date.now()}-${aiStreamRequestSeq += 1}`
    const cleanup = () => {
      ipcRenderer.removeListener('ai:streamToken', handleToken)
      ipcRenderer.removeListener('ai:streamComplete', handleComplete)
      ipcRenderer.removeListener('ai:streamError', handleError)
    }
    const handleToken = (_event: unknown, incomingId: string, token: string) => {
      if (incomingId === requestId) callbacks.onToken(token)
    }
    const handleComplete = (_event: unknown, incomingId: string, content: string) => {
      if (incomingId !== requestId) return
      cleanup()
      callbacks.onComplete(content)
    }
    const handleError = (_event: unknown, incomingId: string, error: string) => {
      if (incomingId !== requestId) return
      cleanup()
      callbacks.onError(error)
    }

    ipcRenderer.on('ai:streamToken', handleToken)
    ipcRenderer.on('ai:streamComplete', handleComplete)
    ipcRenderer.on('ai:streamError', handleError)
    ipcRenderer.send('ai:streamComplete', requestId, request)
    return {
      requestId,
      cleanup
    }
  },
  aiCancelStream: (requestId: string) => ipcRenderer.send('ai:cancelStream', requestId),
  aiGetOfficialProfiles: () => ipcRenderer.invoke('ai:getOfficialProfiles') as Promise<AiOfficialProfile[]>,
  aiExecuteSkill: (
    skillId: string,
    input: Record<string, unknown>,
    options?: { modelHint?: 'fast' | 'balanced' | 'heavy' }
  ) =>
    ipcRenderer.invoke('ai:executeSkill', skillId, input, options) as Promise<{
      runId?: string
      output?: unknown
      modelUsed?: string
      usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
        costUsd: number
      }
      error?: string
      code?: string
      genre?: string
      plans?: { monthly: string; yearly: string }
    }>,
  aiGetProviderStatus: (
    provider: string,
    options?: {
      probe?: boolean
      config?: {
        api_key?: string
        api_endpoint?: string
        model?: string
      }
    }
  ) =>
    ipcRenderer.invoke('ai:getProviderStatus', provider, options),
  aiSetupGeminiCli: () => ipcRenderer.invoke('ai:setupGeminiCli'),
  aiGetGlobalConfig: () => ipcRenderer.invoke('ai:getGlobalConfig'),
  aiSaveGlobalConfig: (data: Record<string, unknown>) => ipcRenderer.invoke('ai:saveGlobalConfig', data),
  aiGetSkillTemplates: () => ipcRenderer.invoke('ai:getSkillTemplates'),
  aiUpdateSkillTemplate: (key: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('ai:updateSkillTemplate', key, updates),
  aiGetWorkProfile: (bookId: number) => ipcRenderer.invoke('ai:getWorkProfile', bookId),
  aiSaveWorkProfile: (bookId: number, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('ai:saveWorkProfile', bookId, updates),
  aiGetSkillOverrides: (bookId: number) => ipcRenderer.invoke('ai:getSkillOverrides', bookId),
  aiUpsertSkillOverride: (bookId: number, skillKey: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('ai:upsertSkillOverride', bookId, skillKey, updates),
  aiDeleteSkillOverride: (bookId: number, skillKey: string) =>
    ipcRenderer.invoke('ai:deleteSkillOverride', bookId, skillKey),
  aiGetOrCreateConversation: (bookId: number) => ipcRenderer.invoke('ai:getOrCreateConversation', bookId),
  aiCreateConversation: (bookId: number) => ipcRenderer.invoke('ai:createConversation', bookId),
  aiGetConversations: (bookId: number) => ipcRenderer.invoke('ai:getConversations', bookId),
  aiUpdateConversationTitle: (conversationId: number, title: string) =>
    ipcRenderer.invoke('ai:updateConversationTitle', conversationId, title),
  aiClearConversation: (conversationId: number) => ipcRenderer.invoke('ai:clearConversation', conversationId),
  aiDeleteConversation: (conversationId: number) => ipcRenderer.invoke('ai:deleteConversation', conversationId),
  aiGetMessages: (conversationId: number) => ipcRenderer.invoke('ai:getMessages', conversationId),
  aiAddMessage: (
    conversationId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: unknown
  ) => ipcRenderer.invoke('ai:addMessage', conversationId, role, content, metadata),
  aiGetDrafts: (bookId: number, status?: 'pending' | 'applied' | 'dismissed' | 'all', conversationId?: number | null) =>
    ipcRenderer.invoke('ai:getDrafts', bookId, status, conversationId),
  aiCreateDraft: (data: Record<string, unknown>) => ipcRenderer.invoke('ai:createDraft', data),
  aiSetDraftStatus: (id: number, status: 'pending' | 'applied' | 'dismissed') =>
    ipcRenderer.invoke('ai:setDraftStatus', id, status),
  aiGetResolvedGlobalConfig: () => ipcRenderer.invoke('ai:getResolvedGlobalConfig'),
  aiGetResolvedConfigForBook: (bookId: number) => ipcRenderer.invoke('ai:getResolvedConfigForBook', bookId),
  aiGetResolvedWorkspaceConfig: () => ipcRenderer.invoke('ai:getResolvedWorkspaceConfig'),

  syncUploadBook: (bookId: number) => ipcRenderer.invoke('sync:uploadBook', bookId),
  syncListCloudBooks: () => ipcRenderer.invoke('sync:listCloudBooks'),
  syncDownloadBook: (fileId: string) => ipcRenderer.invoke('sync:downloadBook', fileId),

  // Window controls
  setFullScreen: (flag: boolean) => ipcRenderer.invoke('window:setFullScreen', flag),
  isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize') as Promise<boolean>,

  // Export
  showSaveDialog: (options: Record<string, unknown>) => ipcRenderer.invoke('dialog:showSave', options),
  writeFile: (path: string, data: Uint8Array | string) => ipcRenderer.invoke('fs:writeFile', path, data),
  exportPdf: (html: string, savePath: string) => ipcRenderer.invoke('export:pdf', html, savePath),

  openImportFile: () => ipcRenderer.invoke('dialog:openImportFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  backupConfigure: (backupDir: string, intervalHours: number, maxFiles: number) =>
    ipcRenderer.invoke('backup:configure', backupDir, intervalHours, maxFiles),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  backupList: () => ipcRenderer.invoke('backup:list'),
  backupRestore: () => ipcRenderer.invoke('backup:restore'),
  backupRestoreFrom: (absolutePath: string) => ipcRenderer.invoke('backup:restoreFrom', absolutePath),

  dataExportFull: () => ipcRenderer.invoke('data:exportFull'),
  dataImportFull: () => ipcRenderer.invoke('data:importFull'),

  getAppVersion: () => ipcRenderer.invoke('app:getAppVersion') as Promise<string>,
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates') as Promise<UpdateSnapshot>,
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate') as Promise<UpdateSnapshot>,
  downloadManualInstallerUpdate: () =>
    ipcRenderer.invoke('app:downloadManualInstallerUpdate') as Promise<ManualInstallerDownloadResult>,
  getUpdateState: () => ipcRenderer.invoke('app:getUpdateState') as Promise<UpdateSnapshot>,
  onUpdateState: (listener: (snapshot: UpdateSnapshot) => void) => {
    const wrapped = (_event: unknown, snapshot: UpdateSnapshot) => listener(snapshot)
    ipcRenderer.on('app:updateState', wrapped)
    return () => {
      ipcRenderer.removeListener('app:updateState', wrapped)
    }
  },
  installDownloadedUpdate: () => ipcRenderer.invoke('app:installDownloadedUpdate'),
  reloadWindow: () => ipcRenderer.invoke('app:reloadWindow')
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)

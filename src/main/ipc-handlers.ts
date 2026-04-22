import { ipcMain, dialog, BrowserWindow, app, Notification } from 'electron'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync, chmodSync } from 'fs'
import { resolve, normalize, join } from 'path'
import { spawn } from 'child_process'
import * as bookRepo from './database/book-repo'
import * as chapterRepo from './database/chapter-repo'
import * as characterRepo from './database/character-repo'
import * as relationRepo from './database/relation-repo'
import * as milestoneRepo from './database/milestone-repo'
import * as plotRepo from './database/plot-repo'
import * as plotlineRepo from './database/plotline-repo'
import * as foreshadowRepo from './database/foreshadow-repo'
import * as wikiRepo from './database/wiki-repo'
import * as snapshotRepo from './database/snapshot-repo'
import * as configRepo from './database/config-repo'
import * as aiAssistantRepo from './database/ai-assistant-repo'
import * as statsRepo from './database/stats-repo'
import * as sessionRepo from './database/session-repo'
import * as achievementRepo from './database/achievement-repo'
import * as notesRepo from './database/notes-repo'
import * as appStateRepo from './database/app-state-repo'
import * as annotationRepo from './database/annotation-repo'
import { SearchRepo } from './database/search-repo'
import * as trashRepo from './database/trash-repo'
import * as templateRepo from './database/template-repo'
import * as shortcutRepo from './database/shortcut-repo'
import { GoogleAuth } from './auth/google-auth'
import { DriveSync } from './sync/drive-sync'
import { backupDatabaseFile, replaceDatabaseFromFile } from './database/connection'
import { autoBackup } from './backup/auto-backup'
import { readDocxPlainText } from './utils/read-docx-text'
import { getUpdateState, installDownloadedUpdate } from './updater/service'
import {
  buildGeminiCliSetupScript,
  createGeminiCliService,
  ensureGeminiCliWorkspace,
  getBundledGeminiCliEntry,
  resolveGeminiCliRuntime,
  type AiBridgeCompleteRequest
} from './ai/gemini-cli-service'

const googleAuth = new GoogleAuth()
const driveSync = new DriveSync(googleAuth)
const searchRepo = new SearchRepo()
let geminiCliService: ReturnType<typeof createGeminiCliService> | null = null

function getGeminiCliService(): ReturnType<typeof createGeminiCliService> {
  if (!geminiCliService) {
    geminiCliService = createGeminiCliService({
      ensureWorkspace: async () => ensureGeminiCliWorkspace(app.getPath('userData'))
    })
  }
  return geminiCliService
}

function launchGeminiCliSetup(): { ok: boolean; error?: string } {
  const cliEntry = getBundledGeminiCliEntry()
  if (!existsSync(cliEntry)) {
    return { ok: false, error: '未找到 Gemini CLI 运行文件，请重新安装应用后再试。' }
  }
  const workspace = ensureGeminiCliWorkspace(app.getPath('userData'))
  const runtime = resolveGeminiCliRuntime(process.env, process.execPath)

  if (process.platform === 'win32') {
    const scriptPath = join(workspace, 'gemini-login.cmd')
    writeFileSync(
      scriptPath,
      [
        '@echo off',
        `cd /d "${workspace}"`,
        'set NODE_OPTIONS=',
        'set ELECTRON_RUN_AS_NODE=1',
        `"${runtime}" "${cliEntry}"`,
        'echo.',
        'echo Gemini CLI 登录流程结束后可关闭此窗口。',
        'pause'
      ].join('\r\n')
    )
    const child = spawn('cmd.exe', ['/c', 'start', 'Gemini CLI Login', scriptPath], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { ok: true }
  }

  const scriptPath = join(workspace, 'gemini-login.sh')
  writeFileSync(scriptPath, buildGeminiCliSetupScript(runtime, cliEntry, workspace))
  chmodSync(scriptPath, 0o755)
  const args = process.platform === 'darwin' ? ['-a', 'Terminal', scriptPath] : [scriptPath]
  const command = process.platform === 'darwin' ? 'open' : 'x-terminal-emulator'
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {
    spawn(scriptPath, { detached: true, stdio: 'ignore' }).unref()
  })
  child.unref()
  return { ok: true }
}

export function registerIpcHandlers(): void {
  // Books
  ipcMain.handle('db:getBooks', () => bookRepo.getBooks())
  ipcMain.handle('db:createBook', (_, data) => bookRepo.createBook(data))
  ipcMain.handle('db:deleteBook', (_, id) => bookRepo.deleteBook(id))
  ipcMain.handle('db:getBookStats', (_, bookId) => bookRepo.getBookStats(bookId))

  // Config
  ipcMain.handle('db:getConfig', (_, bookId) => configRepo.getConfig(bookId))
  ipcMain.handle('db:saveConfig', (_, bookId, config) => configRepo.saveConfig(bookId, config))
  ipcMain.handle('db:getCustomShortcuts', () => shortcutRepo.getAllCustomShortcuts())
  ipcMain.handle('db:setCustomShortcut', (_, action: string, keys: string) => {
    shortcutRepo.upsertCustomShortcut(action, keys)
  })

  ipcMain.handle('ai:getAccounts', () => aiAssistantRepo.getAiAccounts())
  ipcMain.handle('ai:saveAccount', (_, data) => aiAssistantRepo.saveAiAccount(data))
  ipcMain.handle('ai:deleteAccount', (_, id: number) => aiAssistantRepo.deleteAiAccount(id))
  ipcMain.handle('ai:getSkillTemplates', () => aiAssistantRepo.getAiSkillTemplates())
  ipcMain.handle('ai:updateSkillTemplate', (_, key: string, updates: Record<string, unknown>) =>
    aiAssistantRepo.updateAiSkillTemplate(key, updates)
  )
  ipcMain.handle('ai:getWorkProfile', (_, bookId: number) => aiAssistantRepo.getAiWorkProfile(bookId))
  ipcMain.handle('ai:saveWorkProfile', (_, bookId: number, updates: Record<string, unknown>) =>
    aiAssistantRepo.saveAiWorkProfile(bookId, updates)
  )
  ipcMain.handle('ai:getSkillOverrides', (_, bookId: number) => aiAssistantRepo.getAiSkillOverrides(bookId))
  ipcMain.handle('ai:upsertSkillOverride', (_, bookId: number, skillKey: string, updates: Record<string, unknown>) =>
    aiAssistantRepo.upsertAiSkillOverride(bookId, skillKey, updates)
  )
  ipcMain.handle('ai:deleteSkillOverride', (_, bookId: number, skillKey: string) =>
    aiAssistantRepo.deleteAiSkillOverride(bookId, skillKey)
  )
  ipcMain.handle('ai:getOrCreateConversation', (_, bookId: number) =>
    aiAssistantRepo.getOrCreateAiConversation(bookId)
  )
  ipcMain.handle('ai:createConversation', (_, bookId: number) =>
    aiAssistantRepo.createAiConversation(bookId)
  )
  ipcMain.handle('ai:getConversations', (_, bookId: number) =>
    aiAssistantRepo.getAiConversations(bookId)
  )
  ipcMain.handle('ai:clearConversation', (_, conversationId: number) =>
    aiAssistantRepo.clearAiConversation(conversationId)
  )
  ipcMain.handle('ai:deleteConversation', (_, conversationId: number) =>
    aiAssistantRepo.deleteAiConversation(conversationId)
  )
  ipcMain.handle('ai:getMessages', (_, conversationId: number) => aiAssistantRepo.getAiMessages(conversationId))
  ipcMain.handle(
    'ai:addMessage',
    (_, conversationId: number, role: 'user' | 'assistant' | 'system', content: string, metadata?: unknown) =>
      aiAssistantRepo.addAiMessage(conversationId, role, content, metadata)
  )
  ipcMain.handle('ai:getDrafts', (_, bookId: number, status?: aiAssistantRepo.AiDraftStatus | 'all', conversationId?: number | null) =>
    aiAssistantRepo.getAiDrafts(bookId, status || 'pending', conversationId)
  )
  ipcMain.handle('ai:createDraft', (_, data) => aiAssistantRepo.createAiDraft(data))
  ipcMain.handle('ai:setDraftStatus', (_, id: number, status: aiAssistantRepo.AiDraftStatus) =>
    aiAssistantRepo.setAiDraftStatus(id, status)
  )
  ipcMain.handle('ai:getResolvedConfigForBook', (_, bookId: number) =>
    aiAssistantRepo.getResolvedAiConfigForBook(bookId)
  )
  ipcMain.on('ai:streamComplete', (event, requestId: string, request: AiBridgeCompleteRequest) => {
    if (request.provider !== 'gemini_cli') {
      event.sender.send('ai:streamError', requestId, '主进程暂只处理 Gemini CLI Provider')
      return
    }

    void getGeminiCliService().stream(request, {
      onToken: (token) => event.sender.send('ai:streamToken', requestId, token),
      onComplete: (content) => event.sender.send('ai:streamComplete', requestId, content),
      onError: (error) => event.sender.send('ai:streamError', requestId, error)
    })
  })

  // Volumes
  ipcMain.handle('db:getVolumes', (_, bookId) => chapterRepo.getVolumes(bookId))
  ipcMain.handle('db:createVolume', (_, data) => chapterRepo.createVolume(data))
  ipcMain.handle('db:updateVolume', (_, id, title) => chapterRepo.updateVolume(id, title))
  ipcMain.handle('db:deleteVolume', (_, id) => chapterRepo.deleteVolume(id))

  // Chapters
  ipcMain.handle('db:getChapters', (_, volumeId) => chapterRepo.getChapters(volumeId))
  ipcMain.handle('db:getChapter', (_, id) => chapterRepo.getChapter(id))
  ipcMain.handle('db:createChapter', (_, data) => chapterRepo.createChapter(data))
  ipcMain.handle('db:updateChapter', (_, id, data) => chapterRepo.updateChapter(id, data))
  ipcMain.handle('db:updateChapterTitle', (_, id, title) => chapterRepo.updateChapterTitle(id, title))
  ipcMain.handle('db:updateChapterSummary', (_, id: number, summary: string) => {
    chapterRepo.updateChapterSummary(id, summary)
  })
  ipcMain.handle('db:deleteChapter', (_, id) => chapterRepo.deleteChapter(id))
  ipcMain.handle('db:getAllChaptersForBook', (_, bookId) => chapterRepo.getAllChaptersForBook(bookId))
  ipcMain.handle('db:getVolumesWithChapters', (_, bookId) => chapterRepo.getVolumesWithChapters(bookId))
  ipcMain.handle('db:getChapterTemplates', (_, bookId: number) => templateRepo.getTemplates(bookId))
  ipcMain.handle('db:createChapterTemplate', (_, bookId: number, name: string, content: string) =>
    templateRepo.createTemplate(bookId, name, content)
  )
  ipcMain.handle('db:deleteChapterTemplate', (_, id: number) => {
    templateRepo.deleteTemplate(id)
  })
  ipcMain.handle('db:reorderChapters', (_, volumeId: number, chapterIds: number[]) => {
    chapterRepo.reorderChapters(volumeId, chapterIds)
  })
  ipcMain.handle('db:reorderVolumes', (_, bookId: number, volumeIds: number[]) => {
    chapterRepo.reorderVolumes(bookId, volumeIds)
  })
  ipcMain.handle('db:moveChapter', (_, chapterId: number, targetVolumeId: number) => {
    chapterRepo.moveChapter(chapterId, targetVolumeId)
  })

  ipcMain.handle('db:searchChapters', (_, query: string, bookId?: number) => {
    return searchRepo.searchChapters(query, bookId)
  })
  ipcMain.handle('db:rebuildSearchIndex', () => {
    searchRepo.rebuildIndex()
  })

  ipcMain.handle('db:getTrashItems', (_, bookId: number) => trashRepo.getTrashItems(bookId))
  ipcMain.handle('db:restoreItem', (_, kind: trashRepo.TrashEntityKind, id: number) => {
    trashRepo.restoreItem(kind, id)
  })
  ipcMain.handle('db:permanentDeleteItem', (_, kind: trashRepo.TrashEntityKind, id: number) => {
    trashRepo.permanentDeleteItem(kind, id)
  })
  ipcMain.handle('db:emptyTrash', (_, bookId: number) => {
    trashRepo.emptyTrash(bookId)
  })

  // Characters
  ipcMain.handle('db:getCharacters', (_, bookId) => characterRepo.getCharacters(bookId))
  ipcMain.handle('db:createCharacter', (_, data) => characterRepo.createCharacter(data))
  ipcMain.handle('db:updateCharacter', (_, id, data) => characterRepo.updateCharacter(id, data))
  ipcMain.handle('db:deleteCharacter', (_, id) => characterRepo.deleteCharacter(id))
  ipcMain.handle('db:getCharacterAppearances', (_, charId) => characterRepo.getCharacterAppearances(charId))
  ipcMain.handle('db:getChapterAppearances', (_, chapterId) => characterRepo.getChapterAppearances(chapterId))
  ipcMain.handle('db:syncAppearances', (_, chapterId, charIds) => characterRepo.syncAppearances(chapterId, charIds))
  ipcMain.handle('db:getBookAppearances', (_, bookId: number) => characterRepo.getBookAppearances(bookId))
  ipcMain.handle('db:getRelations', (_, bookId: number) => relationRepo.getRelations(bookId))
  ipcMain.handle(
    'db:createRelation',
    (_, bookId: number, sourceId: number, targetId: number, relationType: string, label: string) =>
      relationRepo.createRelation(bookId, sourceId, targetId, relationType, label)
  )
  ipcMain.handle('db:updateRelation', (_, id: number, relationType: string, label: string) =>
    relationRepo.updateRelation(id, relationType, label)
  )
  ipcMain.handle('db:deleteRelation', (_, id: number) => relationRepo.deleteRelation(id))
  ipcMain.handle('db:getMilestones', (_, characterId: number) => milestoneRepo.getMilestones(characterId))
  ipcMain.handle(
    'db:createMilestone',
    (_, characterId: number, chapterNumber: number, label: string, value: string) =>
      milestoneRepo.createMilestone(characterId, chapterNumber, label, value)
  )
  ipcMain.handle('db:deleteMilestone', (_, id: number) => milestoneRepo.deleteMilestone(id))

  // Plot Nodes
  ipcMain.handle('db:getPlotNodes', (_, bookId) => plotRepo.getPlotNodes(bookId))
  ipcMain.handle('db:createPlotNode', (_, data) => plotRepo.createPlotNode(data))
  ipcMain.handle('db:updatePlotNode', (_, id, data) => plotRepo.updatePlotNode(id, data))
  ipcMain.handle('db:deletePlotNode', (_, id) => plotRepo.deletePlotNode(id))
  ipcMain.handle('db:getPlotNodeCharacters', (_, plotNodeId: number) => plotRepo.getPlotNodeCharacters(plotNodeId))
  ipcMain.handle('db:setPlotNodeCharacters', (_, plotNodeId: number, characterIds: number[]) =>
    plotRepo.setPlotNodeCharacters(plotNodeId, characterIds)
  )
  ipcMain.handle('db:getCharacterPlotNodes', (_, characterId: number) => plotRepo.getCharacterPlotNodes(characterId))
  ipcMain.handle('db:getPlotCharacterLinksForBook', (_, bookId: number) =>
    plotRepo.getPlotCharacterLinksForBook(bookId)
  )

  ipcMain.handle('db:getPlotlines', (_, bookId: number) => plotlineRepo.getPlotlines(bookId))
  ipcMain.handle('db:createPlotline', (_, bookId: number, name: string, color: string) =>
    plotlineRepo.createPlotline(bookId, name, color)
  )
  ipcMain.handle('db:updatePlotline', (_, id: number, name: string, color: string) =>
    plotlineRepo.updatePlotline(id, name, color)
  )
  ipcMain.handle('db:deletePlotline', (_, id: number) => plotlineRepo.deletePlotline(id))

  // Foreshadowings
  ipcMain.handle('db:getForeshadowings', (_, bookId) => foreshadowRepo.getForeshadowings(bookId))
  ipcMain.handle('db:createForeshadowing', (_, data) => foreshadowRepo.createForeshadowing(data))
  ipcMain.handle('db:updateForeshadowingStatus', (_, id, status) => foreshadowRepo.updateForeshadowingStatus(id, status))
  ipcMain.handle('db:deleteForeshadowing', (_, id) => foreshadowRepo.deleteForeshadowing(id))
  ipcMain.handle('db:checkForeshadowings', (_, bookId, totalWords, currentChapter) =>
    foreshadowRepo.checkForeshadowings(bookId, totalWords, currentChapter)
  )

  // Wiki
  ipcMain.handle('db:getWikiCategories', (_, bookId) => wikiRepo.getWikiCategories(bookId))
  ipcMain.handle('db:getWikiEntries', (_, bookId, category) => wikiRepo.getWikiEntries(bookId, category))
  ipcMain.handle('db:createWikiEntry', (_, data) => wikiRepo.createWikiEntry(data))
  ipcMain.handle('db:updateWikiEntry', (_, id, data) => wikiRepo.updateWikiEntry(id, data))
  ipcMain.handle('db:deleteWikiEntry', (_, id) => wikiRepo.deleteWikiEntry(id))

  // Snapshots
  ipcMain.handle('db:createSnapshot', (_, data) => snapshotRepo.createSnapshot(data))
  ipcMain.handle('db:getSnapshots', (_, chapterId) => snapshotRepo.getSnapshots(chapterId))
  ipcMain.handle('db:cleanOldSnapshots', () => snapshotRepo.cleanOldSnapshots())

  // Daily Stats
  ipcMain.handle('db:getDailyStats', (_, bookId, date) => statsRepo.getDailyStats(bookId, date))
  ipcMain.handle('db:updateDailyStats', (_, bookId, date, wordCount) =>
    statsRepo.updateDailyStats(bookId, date, wordCount)
  )
  ipcMain.handle('db:getStatsRange', (_, bookId: number, fromDate: string, toDate: string) =>
    statsRepo.getStatsRange(bookId, fromDate, toDate)
  )
  ipcMain.handle('db:getAchievementStats', (_, bookId: number) => statsRepo.getAchievementStats(bookId))
  ipcMain.handle('db:getAchievements', (_, bookId: number) => achievementRepo.getAchievements(bookId))
  ipcMain.handle('db:getUnlockedAchievementTypes', (_, bookId: number) =>
    achievementRepo.getUnlockedAchievementTypes(bookId)
  )
  ipcMain.handle('db:unlockAchievement', (_, bookId: number, type: string, label: string) =>
    achievementRepo.unlockAchievement(bookId, type, label)
  )

  ipcMain.handle('db:createSession', (_, bookId: number) => sessionRepo.createSession(bookId))
  ipcMain.handle('db:endSession', (_, sessionId: number, wordCount: number) =>
    sessionRepo.endSession(sessionId, wordCount)
  )
  ipcMain.handle('db:getSessionsToday', (_, bookId: number) => sessionRepo.getSessionsToday(bookId))

  ipcMain.handle('db:getRecentChapters', (_, bookId: number, limit: number) =>
    chapterRepo.getRecentChaptersForBook(bookId, limit)
  )

  // Notes
  ipcMain.handle('db:getNotes', (_, bookId) => notesRepo.getNotes(bookId))
  ipcMain.handle('db:createNote', (_, data) => notesRepo.createNote(data))
  ipcMain.handle('db:deleteNote', (_, id) => notesRepo.deleteNote(id))

  // App State
  ipcMain.handle('db:getAppState', (_, key) => appStateRepo.getAppState(key))
  ipcMain.handle('db:setAppState', (_, key, value) => appStateRepo.setAppState(key, value))

  ipcMain.handle('db:getAnnotations', (_, chapterId: number) => annotationRepo.getAnnotations(chapterId))
  ipcMain.handle(
    'db:createAnnotation',
    (_, chapterId: number, textAnchor: string, content: string) =>
      annotationRepo.createAnnotation(chapterId, textAnchor, content)
  )
  ipcMain.handle('db:updateAnnotation', (_, id: number, content: string) =>
    annotationRepo.updateAnnotation(id, content)
  )
  ipcMain.handle('db:deleteAnnotation', (_, id: number) => annotationRepo.deleteAnnotation(id))

  ipcMain.handle('auth:login', async (_, clientId: string, clientSecret: string) => {
    return googleAuth.login(clientId, clientSecret)
  })
  ipcMain.handle('auth:getUser', async () => googleAuth.getUser())
  ipcMain.handle('auth:logout', async () => {
    await googleAuth.logout()
  })
  ipcMain.handle('auth:getAccessToken', async () => googleAuth.getAccessToken())

  ipcMain.handle('ai:complete', async (_, request: AiBridgeCompleteRequest) => {
    if (request.provider !== 'gemini_cli') {
      return { content: '', error: '主进程暂只处理 Gemini CLI Provider' }
    }
    return getGeminiCliService().complete(request)
  })
  ipcMain.handle('ai:getProviderStatus', async (_, provider: string, options?: { probe?: boolean }) => {
    if (provider === 'gemini_cli') return getGeminiCliService().getStatus(Boolean(options?.probe))
    return {
      provider,
      available: true,
      needsSetup: false,
      message: '当前 Provider 由项目设置直接配置。'
    }
  })
  ipcMain.handle('ai:setupGeminiCli', async () => launchGeminiCliSetup())

  ipcMain.handle('sync:uploadBook', async (_, bookId: number) => {
    await driveSync.syncBook(bookId)
  })
  ipcMain.handle('sync:listCloudBooks', async () => driveSync.listCloudBooks())
  ipcMain.handle('sync:downloadBook', async (_, fileId: string) => driveSync.downloadBook(fileId))

  // Window controls
  ipcMain.handle('window:notify', (_, title: string, body: string) => {
    if (!Notification.isSupported()) return false
    const n = new Notification({ title, body })
    n.show()
    return true
  })

  ipcMain.handle('window:setFullScreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setFullScreen(flag)
  })
  ipcMain.handle('window:isFullScreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isFullScreen() : false
  })

  // Dialog
  ipcMain.handle('dialog:showSave', async (_, options) => {
    const result = await dialog.showSaveDialog(options)
    return result
  })

  // File write — restricted to user-selected paths or userData directory
  ipcMain.handle('fs:writeFile', (_, filePath: string, data: string | Buffer) => {
    const resolved = resolve(normalize(filePath))
    const userDataDir = app.getPath('userData')
    const tempDir = app.getPath('temp')
    const homeDir = app.getPath('home')

    const isUnderAllowed =
      resolved.startsWith(userDataDir) ||
      resolved.startsWith(tempDir) ||
      resolved.startsWith(resolve(homeDir, 'Desktop')) ||
      resolved.startsWith(resolve(homeDir, 'Documents')) ||
      resolved.startsWith(resolve(homeDir, 'Downloads'))

    if (!isUnderAllowed) {
      throw new Error(`Write denied: path "${resolved}" is outside allowed directories`)
    }

    writeFileSync(resolved, data)
  })

  function assertAllowedWritePath(filePath: string): string {
    const resolved = resolve(normalize(filePath))
    const userDataDir = app.getPath('userData')
    const tempDir = app.getPath('temp')
    const homeDir = app.getPath('home')
    const allowed =
      resolved.startsWith(userDataDir) ||
      resolved.startsWith(tempDir) ||
      resolved.startsWith(resolve(homeDir, 'Desktop')) ||
      resolved.startsWith(resolve(homeDir, 'Documents')) ||
      resolved.startsWith(resolve(homeDir, 'Downloads'))
    if (!allowed) {
      throw new Error(`Write denied: path "${resolved}" is outside allowed directories`)
    }
    return resolved
  }

  ipcMain.handle('export:pdf', async (_, html: string, savePath: string) => {
    const resolved = assertAllowedWritePath(savePath)
    const win = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await new Promise<void>((res, rej) => {
        win.webContents.once('did-fail-load', (_e, code, desc) =>
          rej(new Error(desc || `load failed (${code})`))
        )
        win.webContents.once('did-finish-load', () => res())
      })
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'custom', top: 48, bottom: 48, left: 48, right: 48 }
      })
      writeFileSync(resolved, pdf)
    } finally {
      win.destroy()
    }
  })

  ipcMain.handle(
    'dialog:openImportFile',
    async (): Promise<{ path: string; content: string; kind: 'txt' | 'docx' } | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: '文稿', extensions: ['txt', 'docx'] },
          { name: '纯文本', extensions: ['txt'] },
          { name: 'Word', extensions: ['docx'] }
        ]
      })
      if (result.canceled || !result.filePaths[0]) return null
      const filePath = result.filePaths[0]
      const lower = filePath.toLowerCase()
      if (lower.endsWith('.docx')) {
        const content = await readDocxPlainText(filePath)
        return { path: filePath, content, kind: 'docx' }
      }
      const content = readFileSync(filePath, 'utf-8')
      return { path: filePath, content, kind: 'txt' }
    }
  )

  ipcMain.handle('dialog:openDirectory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'backup:configure',
    (_, backupDir: string, intervalHours: number, maxFiles: number) => {
      const dir = backupDir.trim() || join(app.getPath('userData'), 'backups')
      appStateRepo.setAppState('backup_directory', dir)
      appStateRepo.setAppState('backup_interval_hours', String(intervalHours))
      appStateRepo.setAppState('backup_max_files', String(maxFiles))
      const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000
      autoBackup.start(dir, intervalMs, Math.max(1, maxFiles))
    }
  )

  ipcMain.handle('backup:now', async () => {
    const dir =
      appStateRepo.getAppState('backup_directory') || autoBackup.getDefaultBackupDir()
    const max = Number(appStateRepo.getAppState('backup_max_files') || '10')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await autoBackup.performBackup(dir, max)
  })

  ipcMain.handle('backup:list', () => {
    const dir =
      appStateRepo.getAppState('backup_directory') || autoBackup.getDefaultBackupDir()
    if (!existsSync(dir)) return []
    const files = readdirSync(dir).filter((f) => f.startsWith('zhengdao-backup-') && f.endsWith('.db'))
    const rows = files
      .map((name) => {
        const full = join(dir, name)
        try {
          const st = statSync(full)
          return {
            name,
            path: full,
            mtime: st.mtimeMs,
            size: st.size
          }
        } catch {
          return null
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    rows.sort((a, b) => b.mtime - a.mtime)
    return rows
  })

  function restoreBackupFromPath(src: string): { ok: boolean; error?: string } {
    const magic = readFileSync(src).subarray(0, 15).toString('utf8')
    if (magic !== 'SQLite format 3') return { ok: false, error: '不是有效的 SQLite 数据库文件' }
    replaceDatabaseFromFile(src)
    searchRepo.rebuildIndex()
    return { ok: true }
  }

  ipcMain.handle('backup:restore', async () => {
    const pick = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite 备份', extensions: ['db'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { canceled: true as const }
    const r = restoreBackupFromPath(pick.filePaths[0])
    if (!r.ok) return { canceled: false as const, ok: false as const, error: r.error }
    return { canceled: false as const, ok: true as const }
  })

  ipcMain.handle('backup:restoreFrom', (_, filePath: string) => restoreBackupFromPath(resolve(normalize(filePath))))

  ipcMain.handle('data:exportFull', async () => {
    const save = await dialog.showSaveDialog({
      defaultPath: 'zhengdao-export.db',
      filters: [{ name: 'SQLite 数据库', extensions: ['db'] }]
    })
    if (save.canceled || !save.filePath) return { canceled: true as const }
    const resolved = assertAllowedWritePath(save.filePath)
    await backupDatabaseFile(resolved)
    return { canceled: false as const, path: resolved }
  })

  ipcMain.handle('data:importFull', async () => {
    const pick = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '证道数据库', extensions: ['db'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { canceled: true as const }
    const src = pick.filePaths[0]
    const buf = readFileSync(src).subarray(0, 15)
    const magic = buf.toString('utf8')
    if (magic !== 'SQLite format 3') {
      return { canceled: false as const, ok: false as const, error: '不是有效的 SQLite 数据库文件' }
    }
    replaceDatabaseFromFile(src)
    searchRepo.rebuildIndex()
    return { canceled: false as const, ok: true as const }
  })

  ipcMain.handle('app:getUpdateState', () => getUpdateState())
  ipcMain.handle('app:installDownloadedUpdate', async () => {
    await installDownloadedUpdate()
  })

  ipcMain.handle('app:reloadWindow', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.reload()
  })

  autoBackup.startFromStoredConfig()
}

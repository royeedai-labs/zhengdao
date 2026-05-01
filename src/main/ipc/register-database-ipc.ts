import { ipcMain } from 'electron'
import * as bookRepo from '../database/book-repo'
import * as chapterRepo from '../database/chapter-repo'
import * as characterRepo from '../database/character-repo'
import * as relationRepo from '../database/relation-repo'
import * as milestoneRepo from '../database/milestone-repo'
import * as plotRepo from '../database/plot-repo'
import * as plotlineRepo from '../database/plotline-repo'
import * as foreshadowRepo from '../database/foreshadow-repo'
import * as wikiRepo from '../database/wiki-repo'
import * as citationRepo from '../database/citation-repo'
import * as snapshotRepo from '../database/snapshot-repo'
import * as configRepo from '../database/config-repo'
import * as aiBookCreationRepo from '../database/ai-book-creation-repo'
import * as statsRepo from '../database/stats-repo'
import * as sessionRepo from '../database/session-repo'
import * as achievementRepo from '../database/achievement-repo'
import * as notesRepo from '../database/notes-repo'
import * as genreTemplateRepo from '../database/genre-template-repo'
import * as appStateRepo from '../database/app-state-repo'
import * as annotationRepo from '../database/annotation-repo'
import * as trashRepo from '../database/trash-repo'
import * as templateRepo from '../database/template-repo'
import * as shortcutRepo from '../database/shortcut-repo'
import * as canonEventRepo from '../database/canon-event-repo'
import * as canonOrgRepo from '../database/canon-organization-repo'
import * as canonCharOrgRepo from '../database/canon-character-org-repo'
import { searchRepo } from './state'

/**
 * SPLIT-007 — db:* IPC handlers.
 *
 * 100 read/write endpoints over the local SQLite repos. Comment headers
 * group handlers by repository so a future `db:*` addition lands next to
 * its peers instead of the bottom of the file.
 */
export function registerDatabaseIpc(): void {
  // Books
  ipcMain.handle('db:getBooks', () => bookRepo.getBooks())
  ipcMain.handle('db:createBook', (_, data) => bookRepo.createBook(data))
  ipcMain.handle('db:createBookFromAiPackage', (_, data) =>
    aiBookCreationRepo.createBookFromAiPackage(data)
  )
  ipcMain.handle('db:deleteBook', (_, id) => bookRepo.deleteBook(id))
  ipcMain.handle('db:getBookStats', (_, bookId) => bookRepo.getBookStats(bookId))

  // Config + genre templates + custom shortcuts
  ipcMain.handle('db:getConfig', (_, bookId) => configRepo.getConfig(bookId))
  ipcMain.handle('db:saveConfig', (_, bookId, config) => configRepo.saveConfig(bookId, config))
  ipcMain.handle('db:getGenreTemplates', () => genreTemplateRepo.getGenreTemplates())
  ipcMain.handle('db:createGenreTemplate', (_, data) => genreTemplateRepo.createGenreTemplate(data))
  ipcMain.handle('db:updateGenreTemplate', (_, id: number, updates) =>
    genreTemplateRepo.updateGenreTemplate(id, updates)
  )
  ipcMain.handle('db:copyGenreTemplate', (_, id: number) => genreTemplateRepo.copyGenreTemplate(id))
  ipcMain.handle('db:deleteGenreTemplate', (_, id: number) => genreTemplateRepo.deleteGenreTemplate(id))
  ipcMain.handle('db:getCustomShortcuts', () => shortcutRepo.getAllCustomShortcuts())
  ipcMain.handle('db:setCustomShortcut', (_, action: string, keys: string) => {
    shortcutRepo.upsertCustomShortcut(action, keys)
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
  ipcMain.handle('db:getVolumesWithChapterMeta', (_, bookId) => chapterRepo.getVolumesWithChapterMeta(bookId))
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

  // Search
  ipcMain.handle('db:searchChapters', (_, query: string, bookId?: number) => {
    return searchRepo.searchChapters(query, bookId)
  })
  ipcMain.handle('db:rebuildSearchIndex', () => {
    searchRepo.rebuildIndex()
  })

  // Trash
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

  // Characters + relations + milestones
  ipcMain.handle('db:getCharacters', (_, bookId) => characterRepo.getCharacters(bookId))
  ipcMain.handle('db:createCharacter', (_, data) => characterRepo.createCharacter(data))
  ipcMain.handle('db:updateCharacter', (_, id, data) => characterRepo.updateCharacter(id, data))
  ipcMain.handle('db:deleteCharacter', (_, id) => characterRepo.deleteCharacter(id))
  ipcMain.handle('db:getCharacterAppearances', (_, charId) =>
    characterRepo.getCharacterAppearances(charId)
  )
  ipcMain.handle('db:getChapterAppearances', (_, chapterId) =>
    characterRepo.getChapterAppearances(chapterId)
  )
  ipcMain.handle('db:syncAppearances', (_, chapterId, charIds) =>
    characterRepo.syncAppearances(chapterId, charIds)
  )
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

  // Plot Nodes + plotlines
  ipcMain.handle('db:getPlotNodes', (_, bookId) => plotRepo.getPlotNodes(bookId))
  ipcMain.handle('db:createPlotNode', (_, data) => plotRepo.createPlotNode(data))
  ipcMain.handle('db:updatePlotNode', (_, id, data) => plotRepo.updatePlotNode(id, data))
  ipcMain.handle('db:deletePlotNode', (_, id) => plotRepo.deletePlotNode(id))
  ipcMain.handle('db:getPlotNodeCharacters', (_, plotNodeId: number) =>
    plotRepo.getPlotNodeCharacters(plotNodeId)
  )
  ipcMain.handle('db:setPlotNodeCharacters', (_, plotNodeId: number, characterIds: number[]) =>
    plotRepo.setPlotNodeCharacters(plotNodeId, characterIds)
  )
  ipcMain.handle('db:getCharacterPlotNodes', (_, characterId: number) =>
    plotRepo.getCharacterPlotNodes(characterId)
  )
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
  ipcMain.handle('db:updateForeshadowingStatus', (_, id, status) =>
    foreshadowRepo.updateForeshadowingStatus(id, status)
  )
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

  // DI-02 v1 — 学术引文管理 (academic 题材专用)
  ipcMain.handle('db:listCitations', (_, bookId: number) => citationRepo.listCitations(bookId))
  ipcMain.handle('db:createCitation', (_, bookId: number, data: Record<string, unknown>) =>
    citationRepo.createCitation(bookId, data)
  )
  ipcMain.handle('db:updateCitation', (_, id: number, data: Record<string, unknown>) =>
    citationRepo.updateCitation(id, data)
  )
  ipcMain.handle('db:deleteCitation', (_, id: number) => citationRepo.deleteCitation(id))

  // Snapshots
  ipcMain.handle('db:createSnapshot', (_, data) => snapshotRepo.createSnapshot(data))
  ipcMain.handle('db:getSnapshots', (_, chapterId) => snapshotRepo.getSnapshots(chapterId))
  ipcMain.handle('db:cleanOldSnapshots', () => snapshotRepo.cleanOldSnapshots())

  // Daily Stats + sessions + achievements
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

  // Annotations
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

  // DI-07 v3.2 — Canon Pack v3 events / organizations / character-orgs.
  // Read paths feed AiSettingsModal editors (T4) + CG-A3 visual views.
  ipcMain.handle('db:getCanonEvents', (_, bookId: number) => canonEventRepo.listByBookId(bookId))
  ipcMain.handle('db:getCanonEvent', (_, id: number) => canonEventRepo.getById(id))
  ipcMain.handle('db:createCanonEvent', (_, input: canonEventRepo.CanonEventInput) =>
    canonEventRepo.createEvent(input)
  )
  ipcMain.handle(
    'db:updateCanonEvent',
    (_, id: number, patch: canonEventRepo.CanonEventPatch) => canonEventRepo.updateEvent(id, patch)
  )
  ipcMain.handle('db:deleteCanonEvent', (_, id: number) => canonEventRepo.deleteEvent(id))

  ipcMain.handle('db:getCanonOrgs', (_, bookId: number) => canonOrgRepo.listByBookId(bookId))
  ipcMain.handle('db:getCanonOrg', (_, id: number) => canonOrgRepo.getById(id))
  ipcMain.handle('db:getCanonOrgTree', (_, bookId: number) => canonOrgRepo.getTree(bookId))
  ipcMain.handle('db:createCanonOrg', (_, input: canonOrgRepo.CanonOrganizationInput) =>
    canonOrgRepo.createOrganization(input)
  )
  ipcMain.handle(
    'db:updateCanonOrg',
    (_, id: number, patch: canonOrgRepo.CanonOrganizationPatch) =>
      canonOrgRepo.updateOrganization(id, patch)
  )
  ipcMain.handle('db:deleteCanonOrg', (_, id: number) => canonOrgRepo.deleteOrganization(id))

  ipcMain.handle('db:getCanonMembershipsByCharacter', (_, characterId: number) =>
    canonCharOrgRepo.listByCharacter(characterId)
  )
  ipcMain.handle('db:getCanonMembershipsByOrg', (_, orgId: number) =>
    canonCharOrgRepo.listByOrg(orgId)
  )
  ipcMain.handle(
    'db:linkCharacterOrg',
    (_, input: canonCharOrgRepo.CharacterOrgMembershipInput) => canonCharOrgRepo.link(input)
  )
  ipcMain.handle('db:unlinkCharacterOrg', (_, id: number) => canonCharOrgRepo.unlink(id))
  ipcMain.handle(
    'db:unlinkCharacterOrgPair',
    (_, characterId: number, orgId: number) => canonCharOrgRepo.unlinkByPair(characterId, orgId)
  )
}

import { ipcMain } from 'electron'
import * as aiAssistantRepo from '../database/ai-assistant-repo'
import * as storyBibleRepo from '../database/story-bible-repo'
import { completeOfficialAi, getOfficialAiProfiles, streamOfficialAi } from '../ai/official-ai-service'
import { executeOfficialSkill, submitOfficialSkillFeedback } from '../ai/skill-execute-service'
import { getProviderStatus as probeProviderStatus } from '../ai/provider-status'
import type { AiBridgeCompleteRequest } from '../../shared/ai'
import type { SkillFeedbackPayload } from '../../shared/skill-feedback'
import type { CaptureStoryFactsInput, StoryFactProposalStatus } from '../../shared/story-bible'
import { activeGeminiStreamSessions, getGeminiCliService, hasProUser, zhengdaoAuth } from './state'
import { launchGeminiCliSetup } from './gemini-cli-setup'

/**
 * SPLIT-007 — ai:* IPC handlers.
 *
 * Two flavours:
 *   - request/response over `ipcMain.handle`
 *   - streaming over `ipcMain.on('ai:streamComplete' | 'ai:cancelStream')`
 *     (these stay `on` not `handle` because the stream emits multiple
 *     events back to the renderer, not a single Promise resolution).
 */
export function registerAiIpc(): void {
  // ai-assistant local repo (config / skill templates / work profile / drafts)
  ipcMain.handle('ai:getGlobalConfig', () => aiAssistantRepo.getGlobalAiConfig())
  ipcMain.handle('ai:saveGlobalConfig', (_, data: aiAssistantRepo.SaveGlobalAiConfigInput) =>
    aiAssistantRepo.saveGlobalAiConfig(data)
  )
  ipcMain.handle('ai:getSkillTemplates', () => aiAssistantRepo.getAiSkillTemplates())
  ipcMain.handle('ai:updateSkillTemplate', (_, key: string, updates: Record<string, unknown>) =>
    aiAssistantRepo.updateAiSkillTemplate(key, updates)
  )
  ipcMain.handle('ai:getWorkProfile', (_, bookId: number) => aiAssistantRepo.getAiWorkProfile(bookId))
  ipcMain.handle('ai:saveWorkProfile', (_, bookId: number, updates: Record<string, unknown>) =>
    aiAssistantRepo.saveAiWorkProfile(bookId, updates)
  )
  ipcMain.handle('ai:getSkillOverrides', (_, bookId: number) =>
    aiAssistantRepo.getAiSkillOverrides(bookId)
  )
  ipcMain.handle(
    'ai:upsertSkillOverride',
    (_, bookId: number, skillKey: string, updates: Record<string, unknown>) =>
      aiAssistantRepo.upsertAiSkillOverride(bookId, skillKey, updates)
  )
  ipcMain.handle('ai:deleteSkillOverride', (_, bookId: number, skillKey: string) =>
    aiAssistantRepo.deleteAiSkillOverride(bookId, skillKey)
  )

  // Conversations + messages + drafts
  ipcMain.handle('ai:getOrCreateConversation', (_, bookId: number) =>
    aiAssistantRepo.getOrCreateAiConversation(bookId)
  )
  ipcMain.handle('ai:createConversation', (_, bookId: number) =>
    aiAssistantRepo.createAiConversation(bookId)
  )
  ipcMain.handle('ai:getConversations', (_, bookId: number) =>
    aiAssistantRepo.getAiConversations(bookId)
  )
  ipcMain.handle('ai:updateConversationTitle', (_, conversationId: number, title: string) =>
    aiAssistantRepo.updateAiConversationTitle(conversationId, title)
  )
  ipcMain.handle('ai:clearConversation', (_, conversationId: number) =>
    aiAssistantRepo.clearAiConversation(conversationId)
  )
  ipcMain.handle('ai:deleteConversation', (_, conversationId: number) =>
    aiAssistantRepo.deleteAiConversation(conversationId)
  )
  ipcMain.handle('ai:getMessages', (_, conversationId: number) =>
    aiAssistantRepo.getAiMessages(conversationId)
  )
  ipcMain.handle(
    'ai:addMessage',
    (
      _,
      conversationId: number,
      role: 'user' | 'assistant' | 'system',
      content: string,
      metadata?: unknown
    ) => aiAssistantRepo.addAiMessage(conversationId, role, content, metadata)
  )
  ipcMain.handle(
    'ai:getDrafts',
    (
      _,
      bookId: number,
      status?: aiAssistantRepo.AiDraftStatus | 'all',
      conversationId?: number | null
    ) => aiAssistantRepo.getAiDrafts(bookId, status || 'pending', conversationId)
  )
  ipcMain.handle('ai:createDraft', (_, data) => aiAssistantRepo.createAiDraft(data))
  ipcMain.handle('ai:setDraftStatus', (_, id: number, status: aiAssistantRepo.AiDraftStatus) =>
    aiAssistantRepo.setAiDraftStatus(id, status)
  )

  // Story Bible fact proposals + compact generation context.
  ipcMain.handle('ai:getStoryBible', (_, bookId: number) => storyBibleRepo.buildStoryBible(bookId))
  ipcMain.handle(
    'ai:listStoryFactProposals',
    (_, bookId: number, status?: StoryFactProposalStatus | 'all') =>
      storyBibleRepo.listStoryFactProposals(bookId, status || 'pending')
  )
  ipcMain.handle('ai:captureStoryFacts', (_, input: CaptureStoryFactsInput) =>
    storyBibleRepo.captureStoryFacts(input)
  )
  ipcMain.handle('ai:acceptStoryFactProposals', (_, ids: number[]) =>
    storyBibleRepo.acceptStoryFactProposals(ids)
  )
  ipcMain.handle('ai:rejectStoryFactProposals', (_, ids: number[]) =>
    storyBibleRepo.rejectStoryFactProposals(ids)
  )

  // Resolved-config view (resolves global + work profile + overrides)
  ipcMain.handle('ai:getResolvedGlobalConfig', () => aiAssistantRepo.getResolvedGlobalAiConfig())
  ipcMain.handle('ai:getResolvedConfigForBook', (_, bookId: number) =>
    aiAssistantRepo.getResolvedAiConfigForBook(bookId)
  )
  ipcMain.handle('ai:getResolvedWorkspaceConfig', () => aiAssistantRepo.getResolvedGlobalAiConfig())

  // Streaming completion (provider-aware: zhengdao_official | gemini_cli)
  ipcMain.on(
    'ai:streamComplete',
    (event, requestId: string, request: AiBridgeCompleteRequest) => {
      if (request.provider === 'zhengdao_official') {
        void (async () => {
          const session = streamOfficialAi(request, await zhengdaoAuth.getAccessToken(), {
            onToken: (token) => event.sender.send('ai:streamToken', requestId, token),
            onComplete: (content) => {
              activeGeminiStreamSessions.delete(requestId)
              event.sender.send('ai:streamComplete', requestId, content)
            },
            onError: (error) => {
              activeGeminiStreamSessions.delete(requestId)
              event.sender.send('ai:streamError', requestId, error)
            }
          })
          activeGeminiStreamSessions.set(requestId, { cancel: session.cancel })
          void session.done.finally(() => {
            activeGeminiStreamSessions.delete(requestId)
          })
        })()
        return
      }
      if (request.provider !== 'gemini_cli') {
        event.sender.send('ai:streamError', requestId, '主进程暂只处理 Gemini CLI Provider')
        return
      }

      const session = getGeminiCliService().stream(request, {
        onToken: (token) => event.sender.send('ai:streamToken', requestId, token),
        onComplete: (content) => {
          activeGeminiStreamSessions.delete(requestId)
          event.sender.send('ai:streamComplete', requestId, content)
        },
        onError: (error) => {
          activeGeminiStreamSessions.delete(requestId)
          event.sender.send('ai:streamError', requestId, error)
        }
      })
      activeGeminiStreamSessions.set(requestId, { cancel: session.cancel })
      void session.done.finally(() => {
        activeGeminiStreamSessions.delete(requestId)
      })
    }
  )
  ipcMain.on('ai:cancelStream', (_event, requestId: string) => {
    activeGeminiStreamSessions.get(requestId)?.cancel()
  })

  // Non-streaming completion
  ipcMain.handle('ai:complete', async (_, request: AiBridgeCompleteRequest) => {
    if (request.provider === 'zhengdao_official') {
      return completeOfficialAi(request, await zhengdaoAuth.getAccessToken())
    }
    if (request.provider !== 'gemini_cli') {
      return { content: '', error: '主进程暂只处理 Gemini CLI Provider' }
    }
    return getGeminiCliService().complete(request)
  })

  // Official-AI profile listing (gated by Pro tier)
  ipcMain.handle('ai:getOfficialProfiles', async () => {
    const user = await zhengdaoAuth.getUser()
    if (!hasProUser(user)) return []
    return getOfficialAiProfiles(await zhengdaoAuth.getAccessToken())
  })

  // DI-01 v2 / DI-04 v2: backend Skill execution. Token is injected in main
  // process; renderer only passes (skillId, input, options?).
  ipcMain.handle(
    'ai:executeSkill',
    async (
      _,
      skillId: string,
      input: Record<string, unknown>,
      options?: { modelHint?: 'fast' | 'balanced' | 'heavy' }
    ) => {
      const token = await zhengdaoAuth.getAccessToken()
      return executeOfficialSkill(skillId, input, token, {
        modelHint: options?.modelHint
      })
    }
  )
  ipcMain.handle('ai:submitSkillFeedback', async (_, payload: SkillFeedbackPayload) =>
    submitOfficialSkillFeedback(payload, await zhengdaoAuth.getAccessToken())
  )

  // Provider liveness probe + bundled gemini-cli login launcher
  ipcMain.handle(
    'ai:getProviderStatus',
    async (
      _,
      provider: string,
      options?: {
        probe?: boolean
        config?: {
          api_key?: string
          api_endpoint?: string
          model?: string
        }
      }
    ) => {
      if (provider === 'gemini_cli') return getGeminiCliService().getStatus(Boolean(options?.probe))
      return probeProviderStatus(
        {
          provider,
          apiKey: options?.config?.api_key || '',
          apiEndpoint: options?.config?.api_endpoint || '',
          model: options?.config?.model || ''
        },
        Boolean(options?.probe)
      )
    }
  )
  ipcMain.handle('ai:setupGeminiCli', async () => launchGeminiCliSetup())
}

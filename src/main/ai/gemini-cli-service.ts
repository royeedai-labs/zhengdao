import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { spawn as spawnProcess } from 'child_process'
import type { AssistantPresentationMetadata } from '../../shared/assistant-presentation'

export interface AiBridgeCompleteRequest {
  provider: string
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
}

export interface AiResponse {
  content: string
  error?: string
  metadata?: AssistantPresentationMetadata
}

export interface AiStreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullText: string, metadata?: AssistantPresentationMetadata) => void
  onError: (error: string) => void
}

export interface AiStreamSession {
  cancel: () => void
  done: Promise<void>
}

type SpawnChildLike = {
  stdin: { write: (chunk: string) => unknown; end: () => unknown }
  stdout: { on: (event: string, callback: (...args: any[]) => unknown) => unknown }
  stderr: { on: (event: string, callback: (...args: any[]) => unknown) => unknown }
  on: (event: string, callback: (...args: any[]) => unknown) => unknown
  kill: () => unknown
}

type SpawnLike = (
  command: string,
  args: string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    stdio: 'pipe'
  }
) => SpawnChildLike

export interface GeminiCliStatus {
  provider: 'gemini_cli'
  available: boolean
  needsSetup: boolean
  message: string
}

interface GeminiCliServiceDeps {
  spawn?: SpawnLike
  ensureWorkspace?: () => Promise<string>
  getCliEntry?: () => string
  runtime?: string
  timeoutMs?: number
  globalGeminiDir?: string
}

const DEFAULT_TIMEOUT_MS = 90_000
export const DEFAULT_GEMINI_CLI_MODEL = 'gemini-3-pro-preview'
const EMPTY_GEMINI_CLI_STREAM_RESPONSE_ERROR = 'Gemini CLI 返回了空响应，请重试或检查当前模型输出。'
export const GEMINI_CLI_GOOGLE_AUTH_TYPE = 'oauth-personal'
const GOOGLE_ACCOUNTS_FILE = 'google_accounts.json'
const GOOGLE_OAUTH_CREDS_FILE = 'oauth_creds.json'

type GeminiCliWorkspaceSettings = {
  privacy?: { usageStatisticsEnabled?: boolean }
  tools?: { core?: string[] }
  security?: {
    auth?: {
      selectedType?: string
    }
  }
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function getGlobalGeminiDir(): string {
  return join(homedir(), '.gemini')
}

function readWorkspaceSettings(workspace: string): GeminiCliWorkspaceSettings {
  const path = join(workspace, '.gemini', 'settings.json')
  if (!existsSync(path)) return {}
  return parseJson<GeminiCliWorkspaceSettings>(readFileSync(path, 'utf-8'), {})
}

function buildWorkspaceSettings(existing: GeminiCliWorkspaceSettings = {}): GeminiCliWorkspaceSettings {
  return {
    ...existing,
    privacy: {
      ...existing.privacy,
      usageStatisticsEnabled: false
    },
    tools: {
      ...existing.tools,
      core: []
    },
    security: {
      ...existing.security,
      auth: {
        ...existing.security?.auth,
        selectedType: GEMINI_CLI_GOOGLE_AUTH_TYPE
      }
    }
  }
}

function readGoogleAccount(globalGeminiDir: string): string | null {
  const path = join(globalGeminiDir, GOOGLE_ACCOUNTS_FILE)
  if (!existsSync(path)) return null
  const payload = parseJson<{ active?: string | null }>(readFileSync(path, 'utf-8'), {})
  return payload.active?.trim() || null
}

export function buildGeminiCliProcessEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...baseEnv }
  delete env.NODE_OPTIONS
  env.ELECTRON_RUN_AS_NODE = '1'
  return env
}

export function resolveGeminiCliRuntime(
  baseEnv: NodeJS.ProcessEnv = process.env,
  fallbackRuntime = process.execPath
): string {
  const runtimeFromEnv = baseEnv.NODE?.trim() || baseEnv.npm_node_execpath?.trim()
  return runtimeFromEnv || fallbackRuntime
}

function normalizeCliError(message: string): string {
  const lower = message.toLowerCase()
  if (/auth|login|logged|oauth|credential/.test(lower)) {
    return 'Gemini CLI 尚未完成 Google 登录，请先在应用设置 / AI 与模型中启动 Gemini CLI 登录。'
  }
  if (/403|permission_denied|permission denied|forbidden/.test(lower)) {
    return 'Gemini CLI 请求被拒绝，可能是账号权限、地区或额度限制。请检查 Google 登录账号与 Gemini 权益。'
  }
  if (/quota|rate limit|resource_exhausted|429/.test(lower)) {
    return 'Gemini CLI 请求达到额度或频率限制，请稍后重试或检查当前账号额度。'
  }
  return `Gemini CLI 请求失败：${message}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractGeminiCliContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(extractGeminiCliContentPartText).join('')
  if (isRecord(content) && Array.isArray(content.parts)) {
    return extractGeminiCliContentText(content.parts)
  }
  return ''
}

function extractGeminiCliContentPartText(part: unknown): string {
  if (typeof part === 'string') return part
  if (!isRecord(part)) return ''

  const type = typeof part.type === 'string' ? part.type : ''
  if (type && type !== 'text') return ''
  if (typeof part.text === 'string') return part.text
  if (Array.isArray(part.parts)) return extractGeminiCliContentText(part.parts)
  if ('content' in part) return extractGeminiCliContentText(part.content)
  return ''
}

function isAssistantStreamRole(role: unknown): boolean {
  return role === undefined || role === null || role === '' || role === 'assistant' || role === 'model'
}

function resolveGeminiCliRequestModel(model: string): string {
  return model.trim() || DEFAULT_GEMINI_CLI_MODEL
}

export function parseGeminiCliJsonOutput(raw: string): AiResponse {
  try {
    const data = JSON.parse(raw) as {
      response?: unknown
      error?: { type?: string; message?: string; code?: number }
    }
    if (typeof data.response === 'string') {
      return { content: data.response }
    }
    if (data.error) {
      return { content: '', error: normalizeCliError(data.error.message || data.error.type || 'unknown error') }
    }
    return { content: '', error: 'Gemini CLI 返回了空响应。' }
  } catch {
    return {
      content: '',
      error: 'Gemini CLI 返回了无法解析的响应。请确认已完成登录并重试。'
    }
  }
}

export function parseGeminiCliStreamJsonLine(line: string): { token?: string; done?: boolean; error?: string } {
  const trimmed = line.trim()
  if (!trimmed) return {}

  try {
    const event = JSON.parse(trimmed) as {
      type?: string
      role?: string
      content?: unknown
      status?: string
      error?: { type?: string; message?: string }
    }

    if (event.type === 'message' && isAssistantStreamRole(event.role)) {
      const token = extractGeminiCliContentText(event.content)
      if (token) return { token }
    }

    if (event.type === 'result') {
      if (event.status === 'error') {
        return {
          done: true,
          error: normalizeCliError(event.error?.message || event.error?.type || 'unknown error')
        }
      }
      return { done: true }
    }

    if (event.type === 'error') {
      return { error: normalizeCliError(event.error?.message || event.error?.type || 'unknown error') }
    }

    return {}
  } catch {
    return {}
  }
}

function buildPrompt(request: AiBridgeCompleteRequest): string {
  return [
    '请严格按系统要求完成写作辅助任务，只输出最终结果。',
    '',
    '系统要求：',
    request.systemPrompt,
    '',
    '用户内容：',
    request.userPrompt
  ].join('\n')
}

export function getBundledGeminiCliEntry(): string {
  const relative = join('node_modules', '@google', 'gemini-cli', 'bundle', 'gemini.js')
  const packaged = join(process.resourcesPath || '', 'app.asar.unpacked', relative)
  if (process.resourcesPath && existsSync(packaged)) return packaged
  return join(process.cwd(), relative)
}

export function ensureGeminiCliWorkspace(userDataPath: string): string {
  const workspace = join(userDataPath, 'gemini-cli')
  const geminiDir = join(workspace, '.gemini')
  mkdirSync(geminiDir, { recursive: true })
  const existingSettings = readWorkspaceSettings(workspace)
  writeFileSync(
    join(geminiDir, 'settings.json'),
    JSON.stringify(buildWorkspaceSettings(existingSettings), null, 2)
  )
  return workspace
}

export function createGeminiCliService(deps: GeminiCliServiceDeps = {}) {
  const spawn = deps.spawn || spawnProcess
  const getCliEntry = deps.getCliEntry || getBundledGeminiCliEntry
  const runtime = deps.runtime || resolveGeminiCliRuntime(process.env, process.execPath)
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const globalGeminiDir = deps.globalGeminiDir || getGlobalGeminiDir()

  async function complete(request: AiBridgeCompleteRequest): Promise<AiResponse> {
    const cliEntry = getCliEntry()
    if (!deps.getCliEntry && !existsSync(cliEntry)) {
      return {
        content: '',
        error: 'Gemini CLI 尚未打包或未安装，请重新安装应用后再试。'
      }
    }
    if (!deps.ensureWorkspace) {
      return {
        content: '',
        error: 'Gemini CLI 工作目录尚未初始化。'
      }
    }

    const cwd = await deps.ensureWorkspace()
    const args = [cliEntry, '--output-format', 'json']
    args.push('--model', resolveGeminiCliRequestModel(request.model || ''))

    return new Promise<AiResponse>((resolve) => {
      let settled = false
      let stdout = ''
      let stderr = ''
      const child = spawn(runtime, args, {
        cwd,
        env: buildGeminiCliProcessEnv(process.env),
        stdio: 'pipe'
      })

      const finish = (result: AiResponse) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      }

      const timer = setTimeout(() => {
        child.kill()
        finish({ content: '', error: 'Gemini CLI 请求超时，请稍后重试。' })
      }, timeoutMs)

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', (error) => {
        finish({ content: '', error: normalizeCliError(error.message) })
      })
      child.on('close', (code) => {
        if (settled) return
        const trimmedStdout = stdout.trim()
        if (trimmedStdout) {
          const parsed = parseGeminiCliJsonOutput(trimmedStdout)
          if (!parsed.error || code === 0) {
            finish(parsed)
            return
          }
        }
        finish({ content: '', error: normalizeCliError(stderr.trim() || `exit ${code}`) })
      })

      child.stdin.write(buildPrompt(request))
      child.stdin.end()
    })
  }

  function stream(request: AiBridgeCompleteRequest, callbacks: AiStreamCallbacks): AiStreamSession {
    const cliEntry = getCliEntry()
    if (!deps.getCliEntry && !existsSync(cliEntry)) {
      callbacks.onError('Gemini CLI 尚未打包或未安装，请重新安装应用后再试。')
      return { cancel: () => void 0, done: Promise.resolve() }
    }
    if (!deps.ensureWorkspace) {
      callbacks.onError('Gemini CLI 工作目录尚未初始化。')
      return { cancel: () => void 0, done: Promise.resolve() }
    }

    let cancel = () => void 0
    const done = deps.ensureWorkspace().then((cwd) => {
      const args = [cliEntry, '--output-format', 'stream-json']
      args.push('--model', resolveGeminiCliRequestModel(request.model || ''))

      return new Promise<void>((resolve) => {
        let settled = false
        let cancelled = false
        let stdoutLineBuffer = ''
        let stderr = ''
        let fullText = ''
        const child = spawn(runtime, args, {
          cwd,
          env: buildGeminiCliProcessEnv(process.env),
          stdio: 'pipe'
        })

        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve()
        }

        const complete = () => {
          if (settled) return
          callbacks.onComplete(fullText)
          finish()
        }

        const fail = (error: string) => {
          if (settled) return
          callbacks.onError(error)
          finish()
        }

        const handleLine = (line: string) => {
          const parsed = parseGeminiCliStreamJsonLine(line)
          if (parsed.error) {
            fail(parsed.error)
            return
          }
          if (parsed.token) {
            fullText += parsed.token
            callbacks.onToken(parsed.token)
          }
        }

        cancel = () => {
          if (settled || cancelled) return
          cancelled = true
          child.kill()
        }

        const timer = setTimeout(() => {
          child.kill()
          fail('Gemini CLI 请求超时，请稍后重试。')
        }, timeoutMs)

        child.stdout.on('data', (chunk) => {
          stdoutLineBuffer += chunk.toString()
          const lines = stdoutLineBuffer.split(/\r?\n/)
          stdoutLineBuffer = lines.pop() || ''
          for (const line of lines) handleLine(line)
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString()
        })
        child.on('error', (error) => {
          if (cancelled) {
            complete()
            return
          }
          fail(normalizeCliError(error.message))
        })
        child.on('close', (code) => {
          if (settled) return
          if (stdoutLineBuffer.trim()) handleLine(stdoutLineBuffer)
          if (settled) return
          if (cancelled) {
            complete()
            return
          }
          if (code === 0 && fullText.trim()) {
            complete()
            return
          }
          if (code === 0) {
            fail(stderr.trim() ? normalizeCliError(stderr.trim()) : EMPTY_GEMINI_CLI_STREAM_RESPONSE_ERROR)
            return
          }
          fail(normalizeCliError(stderr.trim() || `exit ${code}`))
        })

        child.stdin.write(buildPrompt(request))
        child.stdin.end()
      })
    })

    return { cancel: () => cancel(), done }
  }

  async function getStatus(probe = false): Promise<GeminiCliStatus> {
    const exists = existsSync(getCliEntry())
    if (!exists) {
      return {
        provider: 'gemini_cli',
        available: false,
        needsSetup: true,
        message: '未找到 Gemini CLI 运行文件。'
      }
    }

    if (!deps.ensureWorkspace) {
      return {
        provider: 'gemini_cli',
        available: true,
        needsSetup: true,
        message: 'Gemini CLI 工作目录尚未初始化。'
      }
    }

    const workspace = await deps.ensureWorkspace()
    const settings = readWorkspaceSettings(workspace)
    const selectedType = settings.security?.auth?.selectedType || ''
    if (selectedType !== GEMINI_CLI_GOOGLE_AUTH_TYPE) {
      return {
        provider: 'gemini_cli',
        available: true,
        needsSetup: true,
        message: 'Gemini CLI 工作区尚未初始化 Google 登录方式。点击“启动登录”继续。'
      }
    }

    const activeAccount = readGoogleAccount(globalGeminiDir)
    const hasOauthCredentials = existsSync(join(globalGeminiDir, GOOGLE_OAUTH_CREDS_FILE))
    if (!hasOauthCredentials) {
      return {
        provider: 'gemini_cli',
        available: true,
        needsSetup: true,
        message: '未检测到本机 Gemini CLI Google 凭据。点击“启动登录”完成授权。'
      }
    }

    if (!probe) {
      return {
        provider: 'gemini_cli',
        available: true,
        needsSetup: false,
        message: activeAccount ? `已检测到本机 Gemini CLI 登录：${activeAccount}` : '已检测到本机 Gemini CLI 登录凭据。'
      }
    }

    const probeResult = await complete({
      provider: 'gemini_cli',
      model: DEFAULT_GEMINI_CLI_MODEL,
      systemPrompt: '你是系统连通性检测助手。只回答 ok。',
      userPrompt: '请只回答 ok。',
      maxTokens: 8,
      temperature: 0
    })
    if (probeResult.error) {
      return {
        provider: 'gemini_cli',
        available: true,
        needsSetup: probeResult.error.includes('尚未完成 Google 登录'),
        message: probeResult.error
      }
    }
    return {
      provider: 'gemini_cli',
      available: true,
      needsSetup: false,
      message: activeAccount ? `Gemini CLI 已登录并可用：${activeAccount}` : 'Gemini CLI 已登录并可用。'
    }
  }

  return { complete, stream, getStatus }
}

export function buildGeminiCliSetupScript(runtime: string, cliEntry: string, workspace: string): string {
  return [
    'cd "' + workspace.replace(/"/g, '\\"') + '"',
    'unset NODE_OPTIONS',
    'ELECTRON_RUN_AS_NODE=1 "' + runtime.replace(/"/g, '\\"') + '" "' + cliEntry.replace(/"/g, '\\"') + '"',
    'status=$?',
    'echo',
    'if [ "$status" -eq 0 ]; then',
    '  echo "Gemini CLI 登录流程结束后可关闭此窗口。"',
    'else',
    '  echo "Gemini CLI 已退出，窗口保留以便查看输出。"',
    'fi',
    'exec "${SHELL:-/bin/zsh}" -l'
  ].join('\n')
}

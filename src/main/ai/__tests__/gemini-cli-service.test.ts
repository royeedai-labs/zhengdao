import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildGeminiCliProcessEnv,
  buildGeminiCliSetupScript,
  createGeminiCliService,
  DEFAULT_GEMINI_CLI_MODEL,
  ensureGeminiCliWorkspace,
  GEMINI_CLI_GOOGLE_AUTH_TYPE,
  resolveGeminiCliRuntime,
  parseGeminiCliJsonOutput,
  parseGeminiCliStreamJsonLine
} from '../gemini-cli-service'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('Gemini CLI service', () => {
  it('parses headless JSON response output', () => {
    expect(parseGeminiCliJsonOutput('{"response":"生成内容","stats":{}}')).toEqual({
      content: '生成内容'
    })
  })

  it('normalizes auth and quota errors from JSON output', () => {
    expect(
      parseGeminiCliJsonOutput('{"error":{"type":"AuthError","message":"not logged in"}}')
    ).toEqual({
      content: '',
      error: 'Gemini CLI 尚未完成 Google 登录，请先在项目设置中启动 Gemini CLI 登录。'
    })

    expect(
      parseGeminiCliJsonOutput('{"error":{"type":"ApiError","message":"403 PERMISSION_DENIED"}}')
    ).toEqual({
      content: '',
      error: 'Gemini CLI 请求被拒绝，可能是账号权限、地区或额度限制。请检查 Google 登录账号与 Gemini 权益。'
    })
  })

  it('returns a stable error for non-JSON output', () => {
    expect(parseGeminiCliJsonOutput('plain terminal output')).toEqual({
      content: '',
      error: 'Gemini CLI 返回了无法解析的响应。请确认已完成登录并重试。'
    })
  })

  it('runs Gemini CLI in an app-owned workspace without yolo mode', async () => {
    const previousNodeOptions = process.env.NODE_OPTIONS
    process.env.NODE_OPTIONS = '--max-external-pointer-table-size=268435456'
    const spawn = vi.fn((_command: string, _args: string[], _options: { cwd: string; env: NodeJS.ProcessEnv }) => ({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn((_event, cb) => cb(Buffer.from('{"response":"ok"}'))) },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0)
      }),
      kill: vi.fn()
    }))
    const ensureWorkspace = vi.fn(async () => '/tmp/zhengdao-gemini-cli')
    const service = createGeminiCliService({
      spawn,
      ensureWorkspace,
      getCliEntry: () => '/Applications/zhengdao/resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js'
    })

    const result = await service.complete({
      provider: 'gemini_cli',
      model: 'gemini-2.5-flash',
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 500,
      temperature: 0.8
    })

    expect(result).toEqual({ content: 'ok' })
    expect(spawn).toHaveBeenCalledTimes(1)
    const [, args, options] = spawn.mock.calls[0]
    expect(args).toContain('/Applications/zhengdao/resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js')
    expect(args).toContain('--output-format')
    expect(args).toContain('json')
    expect(args).not.toContain('--yolo')
    expect(options.cwd).toBe('/tmp/zhengdao-gemini-cli')
    expect(options.env.NODE_OPTIONS).toBeUndefined()
    expect(options.env.ELECTRON_RUN_AS_NODE).toBe('1')
    process.env.NODE_OPTIONS = previousNodeOptions
  })

  it('defaults blank Gemini CLI model requests to Gemini 3 Pro', async () => {
    const spawn = vi.fn((_command: string, _args: string[], _options: unknown) => ({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn((_event, cb) => cb(Buffer.from('{"response":"ok"}'))) },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0)
      }),
      kill: vi.fn()
    }))
    const service = createGeminiCliService({
      spawn,
      ensureWorkspace: async () => '/tmp/zhengdao-gemini-cli',
      getCliEntry: () => '/Applications/zhengdao/resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js'
    })

    await service.complete({
      provider: 'gemini_cli',
      model: '',
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 500,
      temperature: 0.8
    })

    const args = spawn.mock.calls[0]?.[1] || []
    expect(DEFAULT_GEMINI_CLI_MODEL).toBe('gemini-3-pro-preview')
    expect(args).toContain('--model')
    expect(args).toContain(DEFAULT_GEMINI_CLI_MODEL)
  })

  it('removes NODE_OPTIONS from Gemini CLI launch env', () => {
    expect(
      buildGeminiCliProcessEnv({
        PATH: '/usr/bin',
        NODE_OPTIONS: '--max-external-pointer-table-size=268435456'
      })
    ).toEqual({
      PATH: '/usr/bin',
      ELECTRON_RUN_AS_NODE: '1'
    })
  })

  it('prefers the Node runtime from environment over the Electron binary', () => {
    expect(
      resolveGeminiCliRuntime(
        {
          NODE: '/Users/dai/.nvm/versions/node/v20.19.5/bin/node',
          npm_node_execpath: '/Users/dai/.nvm/versions/node/v18.20.0/bin/node'
        },
        '/Applications/zhengdao/Electron'
      )
    ).toBe('/Users/dai/.nvm/versions/node/v20.19.5/bin/node')

    expect(
      resolveGeminiCliRuntime(
        {
          npm_node_execpath: '/Users/dai/.nvm/versions/node/v20.19.5/bin/node'
        },
        '/Applications/zhengdao/Electron'
      )
    ).toBe('/Users/dai/.nvm/versions/node/v20.19.5/bin/node')

    expect(resolveGeminiCliRuntime({}, '/Applications/zhengdao/Electron')).toBe(
      '/Applications/zhengdao/Electron'
    )
  })

  it('writes setup scripts that clear NODE_OPTIONS before launching Gemini CLI', () => {
    const script = buildGeminiCliSetupScript(
      '/Applications/zhengdao/Electron',
      '/Applications/zhengdao/gemini.js',
      '/tmp/zhengdao-gemini'
    )

    expect(script).toContain('unset NODE_OPTIONS')
    expect(script).toContain('ELECTRON_RUN_AS_NODE=1 "/Applications/zhengdao/Electron" "/Applications/zhengdao/gemini.js"')
  })

  it('initializes the app-owned Gemini workspace with Google login auth type', () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'zhengdao-gemini-userdata-'))
    tempDirs.push(userDataPath)

    const workspace = ensureGeminiCliWorkspace(userDataPath)
    const settings = JSON.parse(readFileSync(join(workspace, '.gemini', 'settings.json'), 'utf-8')) as {
      security?: { auth?: { selectedType?: string } }
    }

    expect(settings.security?.auth?.selectedType).toBe(GEMINI_CLI_GOOGLE_AUTH_TYPE)
  })

  it('reports an existing Google login from the global Gemini cache', async () => {
    const root = mkdtempSync(join(tmpdir(), 'zhengdao-gemini-status-'))
    tempDirs.push(root)
    const userDataPath = join(root, 'userdata')
    const globalGeminiDir = join(root, 'global-gemini')
    const cliEntry = join(root, 'gemini.js')

    const workspace = ensureGeminiCliWorkspace(userDataPath)
    mkdirSync(globalGeminiDir, { recursive: true })
    writeFileSync(cliEntry, '')
    writeFileSync(join(globalGeminiDir, 'oauth_creds.json'), '{"token":"ok"}', { encoding: 'utf-8', flag: 'w' })
    writeFileSync(join(globalGeminiDir, 'google_accounts.json'), '{"active":"writer@example.com","old":[]}', {
      encoding: 'utf-8',
      flag: 'w'
    })

    const service = createGeminiCliService({
      ensureWorkspace: async () => workspace,
      getCliEntry: () => cliEntry,
      globalGeminiDir
    })

    await expect(service.getStatus()).resolves.toMatchObject({
      provider: 'gemini_cli',
      available: true,
      needsSetup: false
    })
  })

  it('uses the resolved Node runtime for Gemini CLI completion when available', async () => {
    const previousNode = process.env.NODE
    process.env.NODE = '/Users/dai/.nvm/versions/node/v20.19.5/bin/node'
    const spawn = vi.fn((_command: string, _args: string[], _options: unknown) => ({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn((_event, cb) => cb(Buffer.from('{"response":"ok"}'))) },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0)
      }),
      kill: vi.fn()
    }))
    const service = createGeminiCliService({
      spawn,
      ensureWorkspace: async () => '/tmp/zhengdao-gemini-cli',
      getCliEntry: () => '/Applications/zhengdao/resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js'
    })

    await service.complete({
      provider: 'gemini_cli',
      model: 'gemini-2.5-flash',
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 500,
      temperature: 0.8
    })

    expect(spawn.mock.calls[0]?.[0]).toBe('/Users/dai/.nvm/versions/node/v20.19.5/bin/node')
    process.env.NODE = previousNode
  })

  it('parses Gemini CLI stream-json assistant deltas and terminal errors', () => {
    expect(
      parseGeminiCliStreamJsonLine(
        '{"type":"message","role":"assistant","content":"第一段","delta":true}'
      )
    ).toEqual({ token: '第一段' })

    expect(
      parseGeminiCliStreamJsonLine(
        '{"type":"result","status":"error","error":{"type":"AuthError","message":"not logged in"}}'
      )
    ).toEqual({
      done: true,
      error: 'Gemini CLI 尚未完成 Google 登录，请先在项目设置中启动 Gemini CLI 登录。'
    })

    expect(parseGeminiCliStreamJsonLine('')).toEqual({})
  })

  it('parses Gemini CLI stream-json content parts without requiring an assistant role', () => {
    expect(
      parseGeminiCliStreamJsonLine(
        '{"type":"message","content":[{"type":"text","text":"第一段"},{"type":"text","text":"第二段"}]}'
      )
    ).toEqual({ token: '第一段第二段' })
  })

  it('streams Gemini CLI tokens through callbacks', async () => {
    const spawn = vi.fn((_command: string, _args: string[], _options: unknown) => ({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from('{"type":"message","role":"assistant","content":"第一","delta":true}\n'))
            cb(Buffer.from('{"type":"message","role":"assistant","content":"第二","delta":true}\n'))
          }
        })
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0)
      }),
      kill: vi.fn()
    }))
    const tokens: string[] = []
    let completed = ''
    const service = createGeminiCliService({
      spawn,
      ensureWorkspace: async () => '/tmp/zhengdao-gemini-cli',
      getCliEntry: () => '/Applications/zhengdao/resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js'
    })

    await service.stream(
      {
        provider: 'gemini_cli',
        model: 'gemini-2.5-flash',
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 500,
        temperature: 0.8
      },
      {
        onToken: (token) => tokens.push(token),
        onComplete: (content) => {
          completed = content
        },
        onError: (error) => {
          throw new Error(error)
        }
      }
    )

    expect(spawn.mock.calls[0]?.[1]).toContain('stream-json')
    expect(tokens).toEqual(['第一', '第二'])
    expect(completed).toBe('第一第二')
  })

  it('reports an explicit error when stream-json exits successfully without usable text', async () => {
    const spawn = vi.fn((_command: string, _args: string[], _options: unknown) => ({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from('{"type":"message","content":[{"type":"thought","text":"internal"}]}\n'))
          }
        })
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0)
      }),
      kill: vi.fn()
    }))
    let completed = ''
    let streamError = ''
    const service = createGeminiCliService({
      spawn,
      ensureWorkspace: async () => '/tmp/zhengdao-gemini-cli',
      getCliEntry: () => '/Applications/zhengdao/resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js'
    })

    await service.stream(
      {
        provider: 'gemini_cli',
        model: 'gemini-2.5-flash',
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 500,
        temperature: 0.8
      },
      {
        onToken: () => {
          throw new Error('unexpected token')
        },
        onComplete: (content) => {
          completed = content
        },
        onError: (error) => {
          streamError = error
        }
      }
    )

    expect(completed).toBe('')
    expect(streamError).toBe('Gemini CLI 返回了空响应，请重试或检查当前模型输出。')
  })
})

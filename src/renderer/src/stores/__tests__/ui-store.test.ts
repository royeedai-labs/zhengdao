import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/themes', () => ({
  isThemeId: (value: string) => ['system', 'light', 'dark'].includes(value),
  resolveThemeMode: () => 'dark'
}))

vi.mock('@/utils/workspace-layout', async () => {
  const actual = await import('../../utils/workspace-layout')
  return actual
})

vi.mock('@/components/ai/panel-layout', () => ({
  clampAiAssistantLauncherPosition: (position: unknown) => position,
  clampAiAssistantPanelRect: (rect: unknown) => rect,
  createDefaultAiAssistantLauncherPosition: () => ({ x: 16, y: 16 }),
  createDefaultAiAssistantPanelRect: () => ({ x: 16, y: 16, width: 420, height: 680 })
}))

function createLocalStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    key(index: number) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, String(value))
    }
  }
}

function installLocalStorage(initial?: Record<string, string>) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createLocalStorage(initial),
    configurable: true
  })
}

describe('ui store bottom panel state', () => {
  beforeEach(() => {
    vi.resetModules()
    installLocalStorage()
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage')
  })

  it('opens the bottom sandbox by default when no user preference exists', async () => {
    const { useUIStore } = await import('../ui-store')

    expect(useUIStore.getState().bottomPanelOpen).toBe(true)
  })

  it('respects a stored collapsed bottom sandbox preference', async () => {
    vi.resetModules()
    installLocalStorage({ 'write-bottom-panel-open': 'false' })

    const { useUIStore } = await import('../ui-store')

    expect(useUIStore.getState().bottomPanelOpen).toBe(false)
  })

  it('persists explicit and toggled bottom sandbox state', async () => {
    const { useUIStore } = await import('../ui-store')

    useUIStore.getState().setBottomPanelOpen(false)
    expect(useUIStore.getState().bottomPanelOpen).toBe(false)
    expect(localStorage.getItem('write-bottom-panel-open')).toBe('false')

    useUIStore.getState().toggleBottomPanel()
    expect(useUIStore.getState().bottomPanelOpen).toBe(true)
    expect(localStorage.getItem('write-bottom-panel-open')).toBe('true')
  })

  it('opens the right sidebar AI tab without forcing an assistant type', async () => {
    const { useUIStore } = await import('../ui-store')

    useUIStore.getState().openAiAssistant({ input: '从当前光标自然续写。', autoSend: true })

    expect(useUIStore.getState().rightPanelOpen).toBe(true)
    expect(useUIStore.getState().rightPanelTab).toBe('ai')
    expect(useUIStore.getState().aiAssistantOpen).toBe(true)
    expect(useUIStore.getState().aiAssistantCommand).toMatchObject({
      input: '从当前光标自然续写。',
      autoSend: true
    })
    expect(localStorage.getItem('write-right-panel-tab')).toBe('ai')

    const commandId = useUIStore.getState().aiAssistantCommand!.id
    useUIStore.getState().consumeAiAssistantCommand(commandId)
    expect(useUIStore.getState().aiAssistantCommand).toBeNull()
  })

  it('falls back old right sidebar context tabs to the AI workbench', async () => {
    vi.resetModules()
    installLocalStorage({ 'write-right-panel-tab': 'foreshadow' })

    const { useUIStore } = await import('../ui-store')

    expect(useUIStore.getState().rightPanelTab).toBe('ai')
  })

  it('keeps AI chapter drafts as explicit not-yet-written workspace state', async () => {
    const { useUIStore } = await import('../ui-store')

    useUIStore.getState().setAiChapterDraft({
      id: 31,
      title: '第二章 风雪归人',
      content: '他推开门，风雪倒灌进来。',
      summary: '',
      volumeId: null,
      volumeTitle: '第一卷 潜龙在渊',
      conversationId: 2,
      retryInput: '重新写第二章。'
    })
    useUIStore.getState().updateAiChapterDraft({ title: '第二章 风雪夜归人', volumeId: 8, volumeTitle: '' })

    expect(useUIStore.getState().aiChapterDraft).toMatchObject({
      id: 31,
      title: '第二章 风雪夜归人',
      volumeId: 8,
      volumeTitle: ''
    })

    useUIStore.getState().clearAiChapterDraft(99)
    expect(useUIStore.getState().aiChapterDraft?.id).toBe(31)
    useUIStore.getState().clearAiChapterDraft(31)
    expect(useUIStore.getState().aiChapterDraft).toBeNull()
  })
})

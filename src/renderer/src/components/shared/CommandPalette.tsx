import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  BookOpen,
  Bot,
  Coffee,
  Download,
  FileUp,
  FilePlus,
  HelpCircle,
  Layers,
  Leaf,
  Maximize2,
  Moon,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Users,
  UserPlus,
  Waves
} from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useUIStore } from '@/stores/ui-store'

function formatModShortcut(letter: 'E') {
  if (typeof navigator === 'undefined') return `Ctrl+${letter}`
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  return isMac ? `⌘${letter}` : `Ctrl+${letter}`
}

function formatBottomPanelShortcut() {
  if (typeof navigator === 'undefined') return 'Ctrl+`'
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  return isMac ? '⌃`' : 'Ctrl+`'
}

export interface Command {
  id: string
  label: string
  category: string
  shortcut?: string
  icon: ComponentType<{ size?: number }>
  requiresBook?: boolean
  action: () => void
}

const CATEGORY_ORDER = ['导航', '编辑', 'AI', '视图', '主题']

function fuzzyMatch(query: string, label: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const lower = label.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

function useCommands(): Command[] {
  const openModal = useUIStore((s) => s.openModal)
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel)
  const setBlackRoomMode = useUIStore((s) => s.setBlackRoomMode)
  const setTheme = useUIStore((s) => s.setTheme)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)

  return useMemo(
    () => [
      {
        id: 'nav-characters',
        label: '打开角色总库',
        category: '导航',
        icon: Users,
        requiresBook: true,
        action: () => openModal('fullCharacters')
      },
      {
        id: 'nav-wiki',
        label: '打开设定维基',
        category: '导航',
        icon: BookOpen,
        requiresBook: true,
        action: () => openModal('settings')
      },
      {
        id: 'nav-project-settings',
        label: '打开项目设置',
        category: '导航',
        icon: SlidersHorizontal,
        requiresBook: true,
        action: () => openModal('projectSettings')
      },
      {
        id: 'nav-export',
        label: '打开导出面板',
        category: '导航',
        shortcut: formatModShortcut('E'),
        icon: Download,
        requiresBook: true,
        action: () => openModal('export')
      },
      {
        id: 'nav-import',
        label: '外部导入章节',
        category: '导航',
        icon: FileUp,
        requiresBook: true,
        action: () => openModal('import')
      },
      {
        id: 'nav-help',
        label: '打开使用帮助',
        category: '导航',
        shortcut: 'F1',
        icon: HelpCircle,
        action: () => openModal('help')
      },
      {
        id: 'edit-volume',
        label: '新建卷',
        category: '编辑',
        icon: Layers,
        requiresBook: true,
        action: () => openModal('newVolume')
      },
      {
        id: 'edit-chapter',
        label: '新建章节',
        category: '编辑',
        icon: FilePlus,
        requiresBook: true,
        action: () => openModal('newChapter')
      },
      {
        id: 'edit-character',
        label: '新建角色',
        category: '编辑',
        icon: UserPlus,
        requiresBook: true,
        action: () => openModal('character', { isNew: true })
      },
      {
        id: 'ai-assistant',
        label: '打开 AI 创作助手',
        category: 'AI',
        icon: Bot,
        requiresBook: true,
        action: () => openAiAssistant()
      },
      {
        id: 'ai-settings',
        label: 'AI 能力与作品配置',
        category: 'AI',
        icon: SlidersHorizontal,
        requiresBook: true,
        action: () => openModal('aiSettings')
      },
      {
        id: 'view-left',
        label: '切换左侧面板',
        category: '视图',
        icon: PanelLeft,
        requiresBook: true,
        action: () => toggleLeftPanel()
      },
      {
        id: 'view-right',
        label: '切换右侧面板',
        category: '视图',
        icon: PanelRight,
        requiresBook: true,
        action: () => toggleRightPanel()
      },
      {
        id: 'view-bottom',
        label: '切换底部沙盘',
        category: '视图',
        shortcut: formatBottomPanelShortcut(),
        icon: PanelBottom,
        requiresBook: true,
        action: () => toggleBottomPanel()
      },
      {
        id: 'view-blackroom',
        label: '进入小黑屋',
        category: '视图',
        shortcut: 'F11',
        icon: Maximize2,
        requiresBook: true,
        action: () => {
          setBlackRoomMode(true)
          window.api.setFullScreen(true)
        }
      },
      {
        id: 'theme-dark',
        label: '暗色默认',
        category: '主题',
        icon: Moon,
        action: () => setTheme('dark')
      },
      {
        id: 'theme-green',
        label: '墨绿夜',
        category: '主题',
        icon: Leaf,
        action: () => setTheme('dark-green')
      },
      {
        id: 'theme-blue',
        label: '深蓝夜',
        category: '主题',
        icon: Waves,
        action: () => setTheme('dark-blue')
      },
      {
        id: 'theme-warm',
        label: '暖灰',
        category: '主题',
        icon: Coffee,
        action: () => setTheme('dark-warm')
      },
      {
        id: 'theme-oled',
        label: '纯黑OLED',
        category: '主题',
        icon: Smartphone,
        action: () => setTheme('dark-oled')
      },
      {
        id: 'theme-light',
        label: '亮色模式',
        category: '主题',
        icon: Sun,
        action: () => setTheme('light')
      }
    ],
    [
      openModal,
      openAiAssistant,
      setBlackRoomMode,
      setTheme,
      toggleBottomPanel,
      toggleLeftPanel,
      toggleRightPanel
    ]
  )
}

export default function CommandPalette() {
  const closeModal = useUIStore((s) => s.closeModal)
  const currentBookId = useBookStore((s) => s.currentBookId)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const allCommands = useCommands()

  const filtered = useMemo(() => {
    return allCommands.filter(
      (c) =>
        fuzzyMatch(query, c.label) && (c.requiresBook ? currentBookId != null : true)
    )
  }, [allCommands, currentBookId, query])

  const indexById = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((c, i) => m.set(c.id, i))
    return m
  }, [filtered])

  const selectedIndex =
    filtered.length === 0 ? 0 : Math.min(cursor, filtered.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeModal()
      }
    }
    document.addEventListener('keydown', onDocKey, true)
    return () => document.removeEventListener('keydown', onDocKey, true)
  }, [closeModal])

  const execute = useCallback(
    (cmd: Command) => {
      cmd.action()
      if (useUIStore.getState().activeModal === 'commandPalette') {
        closeModal()
      }
    },
    [closeModal]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (filtered.length === 0) return
        setCursor((c) => {
          const cur = Math.min(c, filtered.length - 1)
          return (cur + 1) % filtered.length
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (filtered.length === 0) return
        setCursor((c) => {
          const cur = Math.min(c, filtered.length - 1)
          return (cur - 1 + filtered.length) % filtered.length
        })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[selectedIndex]
        if (cmd) execute(cmd)
      }
    },
    [execute, filtered, selectedIndex]
  )

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-palette-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div
      className="fixed inset-0 z-[200] flex justify-center items-start pt-14 px-4 pb-8 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-2xl overflow-hidden flex flex-col max-h-[min(480px,calc(100vh-7rem))]"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-primary)] shrink-0">
          <Search size={18} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="输入命令或搜索…"
            className="flex-1 bg-transparent border-0 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-0"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-[10px] text-[var(--text-muted)] shrink-0 hidden sm:inline">Esc 关闭</span>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto py-2 min-h-0">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">无匹配命令</div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const items = filtered.filter((c) => c.category === category)
              if (items.length === 0) return null
              return (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {category}
                  </div>
                  {items.map((cmd) => {
                    const index = indexById.get(cmd.id) ?? 0
                    const selected = index === selectedIndex
                    const Icon = cmd.icon
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        data-palette-index={index}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => execute(cmd)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-900/35 text-emerald-100 ring-1 ring-emerald-500/40 ring-inset'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        <Icon size={16} className="shrink-0 text-[var(--text-secondary)]" />
                        <span className="flex-1 truncate">{cmd.label}</span>
                        {cmd.shortcut ? (
                          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">
                            {cmd.shortcut}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

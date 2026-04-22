export interface ShortcutAction {
  id: string
  label: string
  defaultKeys: string
  category: string
}

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'save', label: '手动保存', defaultKeys: 'Ctrl+S', category: '编辑' },
  { id: 'find', label: '查找替换', defaultKeys: 'Ctrl+F', category: '编辑' },
  { id: 'export', label: '导出', defaultKeys: 'Ctrl+E', category: '文件' },
  { id: 'commandPalette', label: '命令面板', defaultKeys: 'Ctrl+K', category: '导航' },
  { id: 'globalSearch', label: '全局搜索', defaultKeys: 'Ctrl+Shift+F', category: '导航' },
  { id: 'blackRoom', label: '小黑屋模式', defaultKeys: 'F11', category: '视图' },
  { id: 'bottomPanel', label: '底部沙盘', defaultKeys: 'Ctrl+`', category: '视图' },
  { id: 'splitView', label: '分屏编辑', defaultKeys: 'Ctrl+\\', category: '视图' },
  { id: 'help', label: '使用帮助', defaultKeys: 'F1', category: '其他' }
]

export function defaultChordForAction(id: string): string {
  return SHORTCUT_ACTIONS.find((a) => a.id === id)?.defaultKeys ?? ''
}

export function matchesShortcutChord(e: KeyboardEvent, chord: string): boolean {
  const raw = chord?.trim()
  if (!raw) return false

  const tokens = raw.split('+').map((t) => t.trim())
  let wantMod = false
  let wantShift = false
  let wantAlt = false
  const keyTokens: string[] = []

  for (const tok of tokens) {
    const t = tok.toLowerCase()
    if (t === 'ctrl' || t === 'control' || t === 'cmd' || t === 'meta' || t === '⌘') wantMod = true
    else if (t === 'shift') wantShift = true
    else if (t === 'alt' || t === 'option') wantAlt = true
    else keyTokens.push(tok)
  }

  const mod = e.metaKey || e.ctrlKey
  if (wantMod !== mod) return false
  if (wantShift !== e.shiftKey) return false
  if (wantAlt !== e.altKey) return false

  const spec = keyTokens.join('+').toLowerCase()
  if (!spec) return false

  return keyMatches(e, spec)
}

function keyMatches(e: KeyboardEvent, specLower: string): boolean {
  if (specLower === '`' || specLower === 'backquote') {
    return e.key === '`' || e.code === 'Backquote'
  }
  if (specLower === '\\' || specLower === 'backslash') {
    return e.key === '\\' || e.code === 'Backslash' || e.code === 'IntlBackslash'
  }
  if (specLower === 'escape' || specLower === 'esc') {
    return e.key === 'Escape'
  }
  if (/^f\d+$/.test(specLower)) {
    return e.key.toLowerCase() === specLower
  }
  if (specLower.length === 1) {
    return e.key.toLowerCase() === specLower
  }
  return e.key.toLowerCase() === specLower
}

export function chordFromKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  const k = e.key
  if (k === '`' || e.code === 'Backquote') {
    parts.push('`')
    return parts.join('+')
  }
  if (k === '\\' || e.code === 'Backslash' || e.code === 'IntlBackslash') {
    parts.push('\\')
    return parts.join('+')
  }
  if (k === 'Escape') {
    parts.push('Escape')
    return parts.join('+')
  }
  if (/^F\d+$/.test(k)) {
    parts.push(k)
    return parts.join('+')
  }
  if (k.length === 1) {
    parts.push(k.toUpperCase())
    return parts.join('+')
  }
  parts.push(k)
  return parts.join('+')
}

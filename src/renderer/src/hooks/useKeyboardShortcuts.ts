import { useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useShortcutStore } from '@/stores/shortcut-store'
import { matchesShortcutChord } from '@/utils/shortcuts'

export function useKeyboardShortcuts() {
  const openModal = useUIStore((s) => s.openModal)
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel)
  const blackRoomMode = useUIStore((s) => s.blackRoomMode)
  const setBlackRoomMode = useUIStore((s) => s.setBlackRoomMode)
  const toggleBlackRoomTextColor = useUIStore((s) => s.toggleBlackRoomTextColor)
  const toggleSplitView = useUIStore((s) => s.toggleSplitView)

  const overrides = useShortcutStore((s) => s.overrides)

  useEffect(() => {
    const getChord = useShortcutStore.getState().getChord

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (matchesShortcutChord(e, getChord('commandPalette'))) {
        e.preventDefault()
        openModal('commandPalette')
        return
      }

      if (matchesShortcutChord(e, getChord('globalSearch'))) {
        e.preventDefault()
        openModal('globalSearch')
        return
      }

      if (matchesShortcutChord(e, getChord('blackRoom'))) {
        e.preventDefault()
        setBlackRoomMode(true)
        window.api.setFullScreen(true)
        return
      }

      if (e.key === 'Escape' && blackRoomMode) {
        e.preventDefault()
        setBlackRoomMode(false)
        window.api.setFullScreen(false)
        return
      }

      if (matchesShortcutChord(e, getChord('export'))) {
        e.preventDefault()
        openModal('export')
        return
      }

      if (matchesShortcutChord(e, getChord('bottomPanel'))) {
        e.preventDefault()
        toggleBottomPanel()
        return
      }

      if (mod && e.key.toLowerCase() === 't' && blackRoomMode) {
        e.preventDefault()
        toggleBlackRoomTextColor()
        return
      }

      if (matchesShortcutChord(e, getChord('splitView'))) {
        e.preventDefault()
        toggleSplitView()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    overrides,
    blackRoomMode,
    openModal,
    toggleBottomPanel,
    setBlackRoomMode,
    toggleBlackRoomTextColor,
    toggleSplitView
  ])
}

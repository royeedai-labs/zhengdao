import { useEffect } from 'react'
import { useBookStore } from '@/stores/book-store'
import { useUIStore } from '@/stores/ui-store'
import { useShortcutStore } from '@/stores/shortcut-store'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import BookshelfPage from '@/components/bookshelf/BookshelfPage'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import ToastContainer from '@/components/shared/ToastContainer'
import UpdateBootstrap from '@/components/shared/UpdateBootstrap'
import ModalManager from '@/components/modals/ModalManager'
import { useSettingsStore } from '@/stores/settings-store'
import { resolveThemeMode } from '@/utils/themes'
import { syncCurrentTitlebarOverlay } from '@/utils/window-shell'
import { APP_DISPLAY_NAME } from '../../shared/window-shell'

export default function App(): JSX.Element {
  const currentBookId = useBookStore((s) => s.currentBookId)
  const theme = useUIStore((s) => s.theme)

  useKeyboardShortcuts()

  useEffect(() => {
    void useShortcutStore.getState().load()
  }, [])

  useEffect(() => {
    void useSettingsStore.getState().loadSettings()
  }, [])

  useEffect(() => {
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved = resolveThemeMode(theme, prefersDark)
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.themeMode = theme
    document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
    syncCurrentTitlebarOverlay()
  }, [theme])

  useEffect(() => {
    document.title = APP_DISPLAY_NAME
  }, [])

  return (
    <>
      <UpdateBootstrap />
      {currentBookId ? <WorkspaceLayout /> : <BookshelfPage />}
      <ModalManager />
      <ToastContainer />
    </>
  )
}

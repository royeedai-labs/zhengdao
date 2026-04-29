import { useEffect, useRef } from 'react'
import { Bot } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useUIStore } from '@/stores/ui-store'
import { translateAiAssistantLauncherPosition } from './panel-layout'
import { AiAssistantPanel } from './AiAssistantDock'

/**
 * SPLIT-006 phase 6 — AiAssistantDock launcher (the floating round button
 * + drag-to-reposition affordance) extracted to its own file so the
 * AiAssistantDock entry stays under the 500-LOC budget.
 *
 * Two render branches:
 *   - bookId === null:  render only when aiAssistantOpen — show the
 *                       BookshelfCreationAssistantPanel surface inside a
 *                       full-height side panel.
 *   - bookId set:       render the draggable launcher button. Hidden
 *                       while the right panel is open (we let that
 *                       slot show the in-place dock).
 *
 * The cleanup dance (handleLauncherDragStart) is preserved 1:1 from
 * the pre-split version: the global mousemove + mouseup listeners are
 * registered only during a drag and torn down via the local cleanup
 * function. interactionCleanupRef guards the unmount path so a drag
 * in flight cannot leak listeners.
 */
export default function AiAssistantDockLauncher(): JSX.Element | null {
  const bookId = useBookStore((s) => s.currentBookId)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const aiAssistantOpen = useUIStore((s) => s.aiAssistantOpen)
  const aiAssistantLauncherPosition = useUIStore((s) => s.aiAssistantLauncherPosition)
  const setAiAssistantLauncherPosition = useUIStore((s) => s.setAiAssistantLauncherPosition)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)
  const launcherPositionRef = useRef(aiAssistantLauncherPosition)
  const launcherClickSuppressedRef = useRef(false)
  const interactionCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    launcherPositionRef.current = aiAssistantLauncherPosition
  }, [aiAssistantLauncherPosition])

  useEffect(() => {
    const handleWindowResize = () => {
      setAiAssistantLauncherPosition(launcherPositionRef.current)
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [setAiAssistantLauncherPosition])

  useEffect(() => {
    return () => {
      interactionCleanupRef.current?.()
    }
  }, [])

  if (!bookId) {
    if (!aiAssistantOpen) return null
    return (
      <div className="fixed bottom-0 right-0 top-12 z-40 w-[min(920px,calc(100vw-24px))] border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <AiAssistantPanel />
      </div>
    )
  }

  if (rightPanelOpen) return null

  const handleLauncherDragStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startPosition = launcherPositionRef.current
    const previousUserSelect = document.body.style.userSelect
    let moved = false

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        moved = true
      }
      setAiAssistantLauncherPosition(
        translateAiAssistantLauncherPosition(
          startPosition,
          deltaX,
          deltaY,
          window.innerWidth,
          window.innerHeight
        )
      )
    }

    const cleanup = () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', cleanup)
      interactionCleanupRef.current = null
      if (moved) {
        launcherClickSuppressedRef.current = true
        window.setTimeout(() => {
          launcherClickSuppressedRef.current = false
        }, 0)
      }
    }

    interactionCleanupRef.current?.()
    interactionCleanupRef.current = cleanup
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', cleanup)
  }

  return (
    <button
      type="button"
      onMouseDown={handleLauncherDragStart}
      onClick={(event) => {
        if (launcherClickSuppressedRef.current) {
          event.preventDefault()
          launcherClickSuppressedRef.current = false
          return
        }
        openAiAssistant()
      }}
      className="fixed z-40 flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-xl shadow-[0_10px_24px_rgba(63,111,159,0.22)] transition hover:bg-[var(--accent-secondary)] active:cursor-grabbing"
      style={{
        left: aiAssistantLauncherPosition.x,
        top: aiAssistantLauncherPosition.y,
        touchAction: 'none'
      }}
      title="拖动或打开 AI 创作助手"
      aria-label="拖动或打开 AI 创作助手"
    >
      <Bot size={22} />
    </button>
  )
}

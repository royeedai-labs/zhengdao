import { useEffect, useRef } from 'react'
import { BellRing } from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { usePlotStore } from '@/stores/plot-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useConfigStore } from '@/stores/config-store'
import { useUIStore } from '@/stores/ui-store'
import { useSnapshot } from '@/hooks/useSnapshot'
import { useCrashRecovery } from '@/hooks/useCrashRecovery'
import { useAchievementCheck } from '@/hooks/useAchievements'
import TopBar from './TopBar'
import OutlineTree from '@/components/sidebar-left/OutlineTree'
import EditorArea from '@/components/editor/EditorArea'
import SplitEditor from '@/components/editor/SplitEditor'
import RightPanel from '@/components/sidebar-right/RightPanel'
import BottomPanel from '@/components/bottom-panel/BottomPanel'
import BlackRoomMode from '@/components/editor/BlackRoomMode'
import AiAssistantDock from '@/components/ai/AiAssistantDock'
import DailyWorkbench from '@/components/workbench/DailyWorkbench'
import OnboardingTour, {
  completeOnboardingStorage,
  isOnboardingDone
} from '@/components/shared/OnboardingTour'
import { decideWorkspaceEntry } from '@/utils/workspace-entry'

export default function WorkspaceLayout() {
  const bookId = useBookStore((s) => s.currentBookId)!
  const onboardingTourSignal = useUIStore((s) => s.onboardingTourSignal)
  const triggerOnboardingTour = useUIStore((s) => s.triggerOnboardingTour)
  const checkAchievements = useAchievementCheck()

  useEffect(() => {
    void checkAchievements(bookId)
  }, [bookId, checkAchievements])

  useEffect(() => {
    try {
      const decision = decideWorkspaceEntry({
        onboardingDone: isOnboardingDone(),
        pendingOnboarding: sessionStorage.getItem('write_pending_onboarding') === '1'
      })

      if (decision.markOnboardingDone) {
        completeOnboardingStorage()
      }
      if (decision.clearPendingOnboarding) {
        sessionStorage.removeItem('write_pending_onboarding')
      }
      if (decision.showOnboarding) {
        triggerOnboardingTour()
      }
    } catch {
      void 0
    }
  }, [bookId, triggerOnboardingTour])

  const { leftPanelOpen, rightPanelOpen, blackRoomMode, splitView, openModal } = useUIStore()
  const leftPanelWidth = useUIStore((s) => s.leftPanelWidth)
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
  const setLeftPanelWidth = useUIStore((s) => s.setLeftPanelWidth)
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth)
  const warningCount = useForeshadowStore((s) => s.getWarningCount())
  const loadVolumes = useChapterStore((s) => s.loadVolumes)
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)
  const loadPlotNodes = usePlotStore((s) => s.loadPlotNodes)
  const loadPlotlines = usePlotStore((s) => s.loadPlotlines)
  const loadForeshadowings = useForeshadowStore((s) => s.loadForeshadowings)
  const loadConfig = useConfigStore((s) => s.loadConfig)

  useSnapshot()
  useCrashRecovery()

  const leftResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const rightResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const left = leftResizeRef.current
      if (left) {
        setLeftPanelWidth(left.startWidth + event.clientX - left.startX)
      }

      const right = rightResizeRef.current
      if (right) {
        setRightPanelWidth(right.startWidth + right.startX - event.clientX)
      }
    }

    const handleUp = () => {
      if (!leftResizeRef.current && !rightResizeRef.current) return
      leftResizeRef.current = null
      rightResizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [setLeftPanelWidth, setRightPanelWidth])

  useEffect(() => {
    loadVolumes(bookId)
    loadCharacters(bookId)
    loadPlotNodes(bookId)
    loadPlotlines(bookId)
    loadForeshadowings(bookId)
    loadConfig(bookId)
  }, [bookId, loadCharacters, loadConfig, loadForeshadowings, loadPlotNodes, loadPlotlines, loadVolumes])

  if (blackRoomMode) {
    return (
      <>
        <BlackRoomMode />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden relative bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans select-none">
      <TopBar />
      <DailyWorkbench />
      <div className="flex flex-1 overflow-hidden relative z-10 min-h-0">
        <div
          className={`sidebar-left border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col shrink-0 transition-[width] duration-300 ease-in-out relative ${
            leftPanelOpen ? '' : 'w-0 border-r-0 overflow-hidden'
          }`}
          style={leftPanelOpen ? { width: leftPanelWidth } : undefined}
        >
          {leftPanelOpen && <OutlineTree />}
          {leftPanelOpen && (
            <button
              type="button"
              aria-label="调整左侧栏宽度"
              title="拖拽调整左侧栏宽度"
              onMouseDown={(event) => {
                leftResizeRef.current = { startX: event.clientX, startWidth: leftPanelWidth }
                document.body.style.cursor = 'ew-resize'
                document.body.style.userSelect = 'none'
              }}
              className="absolute right-[-3px] top-0 z-20 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-[var(--accent-surface)]"
            />
          )}
        </div>
        {splitView ? (
            <div className="editor-area flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
            <div className="flex-1 flex flex-col min-h-0 min-w-0 border-r border-[var(--border-primary)]">
              <EditorArea />
            </div>
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <SplitEditor />
            </div>
          </div>
        ) : (
          <div className="editor-area flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative">
            <EditorArea />
          </div>
        )}
        <div
          className={`sidebar-right border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col shrink-0 shadow-xl z-10 transition-[width] duration-300 ease-in-out relative ${
            rightPanelOpen ? '' : 'w-0 border-l-0 overflow-hidden'
          }`}
          style={rightPanelOpen ? { width: rightPanelWidth } : undefined}
        >
          {rightPanelOpen && (
            <button
              type="button"
              aria-label="调整右侧栏宽度"
              title="拖拽调整右侧栏宽度"
              onMouseDown={(event) => {
                rightResizeRef.current = { startX: event.clientX, startWidth: rightPanelWidth }
                document.body.style.cursor = 'ew-resize'
                document.body.style.userSelect = 'none'
              }}
              className="absolute left-[-3px] top-0 z-20 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-[var(--accent-surface)]"
            />
          )}
          {rightPanelOpen && <RightPanel />}
        </div>
      </div>
      <BottomPanel />
      <AiAssistantDock />
      {warningCount > 0 && !rightPanelOpen && (
        <button
          onClick={() => openModal('foreshadowBoard')}
          aria-label="打开伏笔看板查看催债中的伏笔"
          className="fixed bottom-16 right-4 z-40 flex items-center gap-1.5 px-3 py-2 bg-[var(--danger-primary)] hover:brightness-105 text-[var(--text-inverse)] text-xs font-bold rounded-full shadow-lg animate-pulse transition no-drag"
          title="有伏笔催债！点击打开伏笔看板"
        >
          <BellRing size={14} />
          <span>{warningCount} 坑待填</span>
        </button>
      )}
      <OnboardingTour signal={onboardingTourSignal} />
    </div>
  )
}

import { useEffect } from 'react'
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

  const { leftPanelOpen, rightPanelOpen, blackRoomMode, toggleRightPanel, splitView } = useUIStore()
  const warningCount = useForeshadowStore((s) => s.getWarningCount())
  const loadVolumes = useChapterStore((s) => s.loadVolumes)
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)
  const loadPlotNodes = usePlotStore((s) => s.loadPlotNodes)
  const loadPlotlines = usePlotStore((s) => s.loadPlotlines)
  const loadForeshadowings = useForeshadowStore((s) => s.loadForeshadowings)
  const loadConfig = useConfigStore((s) => s.loadConfig)

  useSnapshot()
  useCrashRecovery()

  useEffect(() => {
    loadVolumes(bookId)
    loadCharacters(bookId)
    loadPlotNodes(bookId)
    loadPlotlines(bookId)
    loadForeshadowings(bookId)
    loadConfig(bookId)
  }, [bookId])

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
      <div className="flex flex-1 overflow-hidden relative z-10 min-h-0">
        <div
          className={`sidebar-left border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
            leftPanelOpen ? 'w-64' : 'w-0 border-r-0 overflow-hidden'
          }`}
        >
          {leftPanelOpen && <OutlineTree />}
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
          className={`sidebar-right border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col shrink-0 shadow-2xl z-10 transition-all duration-300 ease-in-out ${
            rightPanelOpen ? 'w-72' : 'w-0 border-l-0 overflow-hidden'
          }`}
        >
          {rightPanelOpen && <RightPanel />}
        </div>
      </div>
      <BottomPanel />
      <AiAssistantDock />
      {warningCount > 0 && !rightPanelOpen && (
        <button
          onClick={() => toggleRightPanel()}
          aria-label="打开辅助面板查看催债中的伏笔"
          className="fixed bottom-16 right-4 z-40 flex items-center gap-1.5 px-3 py-2 bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse transition no-drag"
          title="有伏笔催债！点击打开辅助面板查看"
        >
          <BellRing size={14} />
          <span>{warningCount} 坑待填</span>
        </button>
      )}
      <OnboardingTour signal={onboardingTourSignal} />
    </div>
  )
}

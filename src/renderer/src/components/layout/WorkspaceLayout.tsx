import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing } from 'lucide-react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'
import { useBookStore } from '@/stores/book-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { usePlotStore } from '@/stores/plot-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useConfigStore } from '@/stores/config-store'
import { useUIStore } from '@/stores/ui-store'
import { useToastStore } from '@/stores/toast-store'
import { useSnapshot } from '@/hooks/useSnapshot'
import { useCrashRecovery } from '@/hooks/useCrashRecovery'
import { useAchievementCheck } from '@/hooks/useAchievements'
import TopBar from './TopBar'
import OutlineTree from '@/components/sidebar-left/OutlineTree'
import EditorArea from '@/components/editor/EditorArea'
import SplitEditor from '@/components/editor/SplitEditor'
import RightPanel from '@/components/sidebar-right/RightPanel'
import TerminalArea from '@/components/terminal/TerminalArea'
import BlackRoomMode from '@/components/editor/BlackRoomMode'
import AiAssistantDock from '@/components/ai/AiAssistantDock'
import DailyWorkbench from '@/components/workbench/DailyWorkbench'
import OnboardingTour, { completeOnboardingStorage, isOnboardingDone } from '@/components/shared/OnboardingTour'
import { decideWorkspaceEntry } from '@/utils/workspace-entry'
import { shouldUseCompactWorkspaceLayout } from '@/utils/workspace-layout'

function WorkspaceResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const horizontal = direction === 'horizontal'
  return (
    <Separator
      className={`group relative shrink-0 bg-[var(--bg-secondary)] transition hover:bg-[var(--accent-surface)] ${
        horizontal
          ? 'w-1.5 cursor-col-resize border-x border-[var(--border-primary)]'
          : 'h-1.5 cursor-row-resize border-y border-[var(--border-primary)]'
      }`}
    >
      <span
        className={`absolute rounded-full bg-[var(--border-secondary)] transition group-hover:bg-[var(--accent-secondary)] ${
          horizontal
            ? 'left-1/2 top-1/2 h-12 w-px -translate-x-1/2 -translate-y-1/2'
            : 'left-1/2 top-1/2 h-px w-12 -translate-x-1/2 -translate-y-1/2'
        }`}
      />
    </Separator>
  )
}

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

  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen)
  const blackRoomMode = useUIStore((s) => s.blackRoomMode)
  const splitView = useUIStore((s) => s.splitView)
  const openModal = useUIStore((s) => s.openModal)
  const workspaceLayoutPresetId = useUIStore((s) => s.workspaceLayoutPresetId)
  const workspaceLayoutPanelSizes = useUIStore((s) => s.workspaceLayoutPanelSizes)
  const workspaceLayoutMigrated = useUIStore((s) => s.workspaceLayoutMigrated)
  const setWorkspaceLayoutPanelSizes = useUIStore((s) => s.setWorkspaceLayoutPanelSizes)
  const markWorkspaceLayoutMigrated = useUIStore((s) => s.markWorkspaceLayoutMigrated)
  const addToast = useToastStore((s) => s.addToast)
  const warningCount = useForeshadowStore((s) => s.getWarningCount())
  const loadVolumes = useChapterStore((s) => s.loadVolumes)
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)
  const loadPlotNodes = usePlotStore((s) => s.loadPlotNodes)
  const loadPlotlines = usePlotStore((s) => s.loadPlotlines)
  const loadForeshadowings = useForeshadowStore((s) => s.loadForeshadowings)
  const loadConfig = useConfigStore((s) => s.loadConfig)

  useSnapshot()
  useCrashRecovery()

  const [compactWorkspace, setCompactWorkspace] = useState(() =>
    shouldUseCompactWorkspaceLayout(typeof window === 'undefined' ? 1440 : window.innerWidth)
  )

  useEffect(() => {
    const handleResize = () => setCompactWorkspace(shouldUseCompactWorkspaceLayout(window.innerWidth))
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (workspaceLayoutMigrated) return
    markWorkspaceLayoutMigrated()
    addToast('info', '4 区 IDE 布局已启用，可在顶部布局菜单切换预设。', 5000)
  }, [addToast, markWorkspaceLayoutMigrated, workspaceLayoutMigrated])

  useEffect(() => {
    loadVolumes(bookId)
    loadCharacters(bookId)
    loadPlotNodes(bookId)
    loadPlotlines(bookId)
    loadForeshadowings(bookId)
    loadConfig(bookId)
  }, [bookId, loadCharacters, loadConfig, loadForeshadowings, loadPlotNodes, loadPlotlines, loadVolumes])

  const effectiveLeftPanelOpen = leftPanelOpen && !compactWorkspace
  const effectiveRightPanelOpen = rightPanelOpen && !compactWorkspace

  const horizontalKey = useMemo(
    () =>
      [
        'workspace-ide',
        workspaceLayoutPresetId,
        effectiveLeftPanelOpen ? 'left' : 'no-left',
        effectiveRightPanelOpen ? 'right' : 'no-right',
        bottomPanelOpen ? 'terminal' : 'no-terminal',
        compactWorkspace ? 'compact' : 'wide'
      ].join(':'),
    [bottomPanelOpen, compactWorkspace, effectiveLeftPanelOpen, effectiveRightPanelOpen, workspaceLayoutPresetId]
  )

  const centerDefaultSize = Math.max(
    36,
    100 -
      (effectiveLeftPanelOpen ? workspaceLayoutPanelSizes.left : 0) -
      (effectiveRightPanelOpen ? workspaceLayoutPanelSizes.right : 0)
  )
  const editorDefaultSize = Math.max(40, 100 - (bottomPanelOpen ? workspaceLayoutPanelSizes.terminal : 0))

  const horizontalDefaultLayout = useMemo(() => {
    const layout: Layout = {
      'workspace-center': centerDefaultSize
    }
    if (effectiveLeftPanelOpen) layout['workspace-left'] = workspaceLayoutPanelSizes.left
    if (effectiveRightPanelOpen) layout['workspace-right'] = workspaceLayoutPanelSizes.right
    return layout
  }, [
    centerDefaultSize,
    effectiveLeftPanelOpen,
    effectiveRightPanelOpen,
    workspaceLayoutPanelSizes.left,
    workspaceLayoutPanelSizes.right
  ])

  const verticalDefaultLayout = useMemo<Layout>(
    () => ({
      'workspace-editor': editorDefaultSize,
      'workspace-terminal': workspaceLayoutPanelSizes.terminal
    }),
    [editorDefaultSize, workspaceLayoutPanelSizes.terminal]
  )

  const handleHorizontalLayout = useCallback(
    (layout: Layout) => {
      const nextSizes: { left?: number; right?: number } = {}
      if (effectiveLeftPanelOpen) {
        nextSizes.left = layout['workspace-left']
      }
      if (effectiveRightPanelOpen) {
        nextSizes.right = layout['workspace-right']
      }
      if (nextSizes.left != null || nextSizes.right != null) {
        setWorkspaceLayoutPanelSizes(nextSizes)
      }
    },
    [effectiveLeftPanelOpen, effectiveRightPanelOpen, setWorkspaceLayoutPanelSizes]
  )

  const handleVerticalLayout = useCallback(
    (layout: Layout) => {
      if (!bottomPanelOpen) return
      const terminal = layout['workspace-terminal']
      if (typeof terminal === 'number') setWorkspaceLayoutPanelSizes({ terminal })
    },
    [bottomPanelOpen, setWorkspaceLayoutPanelSizes]
  )

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
      <Group
        key={horizontalKey}
        orientation="horizontal"
        defaultLayout={horizontalDefaultLayout}
        onLayoutChanged={handleHorizontalLayout}
        className="relative z-10 min-h-0 flex-1 overflow-hidden"
      >
        {effectiveLeftPanelOpen && (
          <>
            <Panel
              id="workspace-left"
              defaultSize={`${workspaceLayoutPanelSizes.left}%`}
              minSize="12%"
              maxSize="28%"
              className="min-h-0 min-w-0"
            >
              <div className="sidebar-left flex h-full min-h-0 flex-col border-r border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <OutlineTree />
              </div>
            </Panel>
            <WorkspaceResizeHandle direction="horizontal" />
          </>
        )}

        <Panel id="workspace-center" defaultSize={`${centerDefaultSize}%`} minSize="36%" className="min-h-0 min-w-0">
          {bottomPanelOpen ? (
            <Group
              orientation="vertical"
              defaultLayout={verticalDefaultLayout}
              onLayoutChanged={handleVerticalLayout}
              className="h-full min-h-0 min-w-0"
            >
              <Panel
                id="workspace-editor"
                defaultSize={`${editorDefaultSize}%`}
                minSize="40%"
                className="min-h-0 min-w-0"
              >
                {splitView ? (
                  <div className="editor-area flex h-full min-h-0 min-w-0 overflow-hidden relative">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[var(--border-primary)]">
                      <EditorArea />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <SplitEditor />
                    </div>
                  </div>
                ) : (
                  <div className="editor-area flex h-full min-h-0 min-w-0 flex-col overflow-hidden relative">
                    <EditorArea />
                  </div>
                )}
              </Panel>
              <WorkspaceResizeHandle direction="vertical" />
              <Panel
                id="workspace-terminal"
                defaultSize={`${workspaceLayoutPanelSizes.terminal}%`}
                minSize="18%"
                maxSize="44%"
                className="min-h-0 min-w-0"
              >
                <TerminalArea />
              </Panel>
            </Group>
          ) : splitView ? (
            <div className="editor-area flex h-full min-h-0 min-w-0 overflow-hidden relative">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[var(--border-primary)]">
                <EditorArea />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <SplitEditor />
              </div>
            </div>
          ) : (
            <div className="editor-area flex h-full min-h-0 min-w-0 flex-col overflow-hidden relative">
              <EditorArea />
            </div>
          )}
        </Panel>

        {effectiveRightPanelOpen && (
          <>
            <WorkspaceResizeHandle direction="horizontal" />
            <Panel
              id="workspace-right"
              defaultSize={`${workspaceLayoutPanelSizes.right}%`}
              minSize="18%"
              maxSize="36%"
              className="min-h-0 min-w-0"
            >
              <div className="sidebar-right flex h-full min-h-0 flex-col border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-xl">
                <RightPanel />
              </div>
            </Panel>
          </>
        )}
      </Group>
      <AiAssistantDock />
      {warningCount > 0 && !effectiveRightPanelOpen && (
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

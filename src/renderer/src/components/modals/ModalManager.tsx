import { lazy, Suspense } from 'react'
import { useUIStore } from '@/stores/ui-store'
import type { ModalType } from '@/types'

const CharacterEditModal = lazy(() => import('./CharacterEditModal'))
const FullCharactersModal = lazy(() => import('./FullCharactersModal'))
const FullSettingsModal = lazy(() => import('./FullSettingsModal'))
const PlotNodeModal = lazy(() => import('./PlotNodeModal'))
const NewVolumeModal = lazy(() => import('./NewVolumeModal'))
const NewChapterModal = lazy(() => import('./NewChapterModal'))
const ForeshadowModal = lazy(() => import('./ForeshadowModal'))
const ForeshadowBoardModal = lazy(() => import('./ForeshadowBoardModal'))
const QuickNotesModal = lazy(() => import('./QuickNotesModal'))
const ProjectSettingsModal = lazy(() => import('./ProjectSettingsModal'))
const SnapshotModal = lazy(() => import('./SnapshotModal'))
const ExportModal = lazy(() => import('./ExportModal'))
const ConfirmModal = lazy(() => import('./ConfirmModal'))
const LoginModal = lazy(() => import('./LoginModal'))
const NewBookWizard = lazy(() => import('@/components/bookshelf/NewBookWizard'))
const CommandPalette = lazy(() => import('@/components/shared/CommandPalette'))
const StyleAnalysisModal = lazy(() => import('./StyleAnalysisModal'))
const GlobalSearchModal = lazy(() => import('./GlobalSearchModal'))
const TrashModal = lazy(() => import('./TrashModal'))
const CharacterCompareModal = lazy(() => import('./CharacterCompareModal'))
const StatsModal = lazy(() => import('./StatsModal'))
const TextAnalysisModal = lazy(() => import('./TextAnalysisModal'))
const BookOverviewModal = lazy(() => import('./BookOverviewModal'))
const ConsistencyCheckModal = lazy(() => import('./ConsistencyCheckModal'))
const AiSettingsModal = lazy(() => import('./AiSettingsModal'))
const AppSettingsModal = lazy(() => import('./AppSettingsModal'))
const ChapterReviewModal = lazy(() => import('./ChapterReviewModal'))
const PublishCheckModal = lazy(() => import('./PublishCheckModal'))
const AuthorGrowthModal = lazy(() => import('./AuthorGrowthModal'))
const FormatTemplateModal = lazy(() => import('./FormatTemplateModal'))
const DialogueRewriteModal = lazy(() => import('./DialogueRewriteModal'))
const WorldConsistencyModal = lazy(() => import('./WorldConsistencyModal'))
const CitationsManagerModal = lazy(() => import('./CitationsManagerModal'))
const CitationPickerModal = lazy(() => import('./CitationPickerModal'))
const ReferencesBuildModal = lazy(() => import('./ReferencesBuildModal'))
const TeamManagementModal = lazy(() => import('./TeamManagementModal'))
const CanonPackModal = lazy(() => import('./CanonPackModal'))
const DirectorPanelModal = lazy(() => import('./DirectorPanelModal'))
const McpSettingsModal = lazy(() => import('./McpSettingsModal'))
const VisualStudioModal = lazy(() => import('./VisualStudioModal'))
const WritingIntelModal = lazy(() => import('./WritingIntelModal'))
const MarketScanDeconstructModal = lazy(() => import('./MarketScanDeconstructModal'))

function renderModal(type: ModalType) {
  switch (type) {
    case 'character': return <CharacterEditModal />
    case 'fullCharacters': return <FullCharactersModal />
    case 'settings': return <FullSettingsModal />
    case 'plotNode': return <PlotNodeModal />
    case 'newVolume': return <NewVolumeModal />
    case 'newChapter': return <NewChapterModal />
    case 'foreshadow': return <ForeshadowModal />
    case 'foreshadowBoard': return <ForeshadowBoardModal />
    case 'quickNotes': return <QuickNotesModal />
    case 'projectSettings': return <ProjectSettingsModal />
    case 'snapshot': return <SnapshotModal />
    case 'export': return <ExportModal />
    case 'confirm': return <ConfirmModal />
    case 'login': return <LoginModal />
    case 'newBook': return <NewBookWizard />
    case 'commandPalette': return <CommandPalette />
    case 'styleAnalysis': return <StyleAnalysisModal />
    case 'globalSearch': return <GlobalSearchModal />
    case 'trash': return <TrashModal />
    case 'characterCompare': return <CharacterCompareModal />
    case 'stats': return <StatsModal />
    case 'textAnalysis': return <TextAnalysisModal />
    case 'bookOverview': return <BookOverviewModal />
    case 'consistencyCheck': return <ConsistencyCheckModal />
    case 'aiSettings': return <AiSettingsModal />
    case 'appSettings': return <AppSettingsModal />
    case 'chapterReview': return <ChapterReviewModal />
    case 'publishCheck': return <PublishCheckModal />
    case 'authorGrowth': return <AuthorGrowthModal />
    case 'formatTemplate': return <FormatTemplateModal />
    case 'dialogueRewrite': return <DialogueRewriteModal />
    case 'worldConsistency': return <WorldConsistencyModal />
    case 'citationsManager': return <CitationsManagerModal />
    case 'citationPicker': return <CitationPickerModal />
    case 'referencesBuild': return <ReferencesBuildModal />
    case 'teamManagement': return <TeamManagementModal />
    case 'canonPack': return <CanonPackModal />
    case 'directorPanel': return <DirectorPanelModal />
    case 'visualStudio': return <VisualStudioModal />
    case 'mcpSettings': return <McpSettingsModal />
    case 'writingIntel': return <WritingIntelModal />
    case 'marketScanDeconstruct': return <MarketScanDeconstructModal />
    default: return null
  }
}

export default function ModalManager() {
  const activeModal = useUIStore((s) => s.activeModal)
  const modalStack = useUIStore((s) => s.modalStack)

  return (
    <Suspense fallback={null}>
      {modalStack.map((entry, i) => (
        <div key={`stack-${i}-${entry.type}`} className="pointer-events-none">
          {renderModal(entry.type)}
        </div>
      ))}
      {activeModal && renderModal(activeModal)}
    </Suspense>
  )
}

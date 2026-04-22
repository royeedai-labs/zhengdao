import { useUIStore } from '@/stores/ui-store'
import type { ModalType } from '@/types'
import CharacterEditModal from './CharacterEditModal'
import FullCharactersModal from './FullCharactersModal'
import FullSettingsModal from './FullSettingsModal'
import PlotNodeModal from './PlotNodeModal'
import NewVolumeModal from './NewVolumeModal'
import NewChapterModal from './NewChapterModal'
import ForeshadowModal from './ForeshadowModal'
import ProjectSettingsModal from './ProjectSettingsModal'
import SnapshotModal from './SnapshotModal'
import ExportModal from './ExportModal'
import ConfirmModal from './ConfirmModal'
import HelpModal from './HelpModal'
import NewBookWizard from '@/components/bookshelf/NewBookWizard'
import CommandPalette from '@/components/shared/CommandPalette'
import StyleAnalysisModal from './StyleAnalysisModal'
import LoginModal from './LoginModal'
import GlobalSearchModal from './GlobalSearchModal'
import TrashModal from './TrashModal'
import CharacterCompareModal from './CharacterCompareModal'
import StatsModal from './StatsModal'
import TextAnalysisModal from './TextAnalysisModal'
import BookOverviewModal from './BookOverviewModal'
import ConsistencyCheckModal from './ConsistencyCheckModal'
import AiSettingsModal from './AiSettingsModal'
import AppSettingsModal from './AppSettingsModal'

function renderModal(type: ModalType) {
  switch (type) {
    case 'character': return <CharacterEditModal />
    case 'fullCharacters': return <FullCharactersModal />
    case 'settings': return <FullSettingsModal />
    case 'plotNode': return <PlotNodeModal />
    case 'newVolume': return <NewVolumeModal />
    case 'newChapter': return <NewChapterModal />
    case 'foreshadow': return <ForeshadowModal />
    case 'projectSettings': return <ProjectSettingsModal />
    case 'snapshot': return <SnapshotModal />
    case 'export': return <ExportModal />
    case 'confirm': return <ConfirmModal />
    case 'help': return <HelpModal />
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
    default: return null
  }
}

export default function ModalManager() {
  const activeModal = useUIStore((s) => s.activeModal)
  const modalStack = useUIStore((s) => s.modalStack)

  return (
    <>
      {modalStack.map((entry, i) => (
        <div key={`stack-${i}-${entry.type}`} className="pointer-events-none">
          {renderModal(entry.type)}
        </div>
      ))}
      {activeModal && renderModal(activeModal)}
    </>
  )
}

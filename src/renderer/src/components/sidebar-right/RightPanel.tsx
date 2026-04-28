import { AiAssistantPanel } from '@/components/ai/AiAssistantDock'

export default function RightPanel() {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden" aria-label="AI 创作工作台">
      <AiAssistantPanel />
    </aside>
  )
}

import { useState } from 'react'
import { GitBranch, X, Save, Trash2 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { usePlotStore } from '@/stores/plot-store'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import type { PlotNode } from '@/types'

type ModalShape = (Partial<PlotNode> & { isNew?: boolean }) | null

export default function PlotNodeModal() {
  const { modalData, closeModal, pushModal } = useUIStore()
  const bookId = useBookStore((s) => s.currentBookId)!
  const { createPlotNode, updatePlotNode, deletePlotNode, plotlines, setPlotNodeCharacters } = usePlotStore()
  const characters = useCharacterStore((s) => s.characters)
  const data = modalData as ModalShape
  const isNew = Boolean(data && 'isNew' in data && data.isNew)
  const initialCharacterIds =
    !isNew && data?.id ? usePlotStore.getState().plotNodeCharacterIds[data.id] ?? [] : []

  const [chapterNumber, setChapterNumber] = useState(() =>
    isNew ? useChapterStore.getState().getCurrentChapterNumber() || 1 : data?.chapter_number ?? 0
  )
  const [title, setTitle] = useState(() => data?.title || '')
  const [score, setScore] = useState(() => data?.score ?? 0)
  const [nodeType, setNodeType] = useState<'main' | 'branch'>(() => data?.node_type || 'main')
  const [description, setDescription] = useState(() => data?.description || '')
  const [plotlineId, setPlotlineId] = useState<number | ''>(() => data?.plotline_id ?? '')
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>(initialCharacterIds)

  const toggleCharacter = (characterId: number) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId]
    )
  }

  const handleSave = async () => {
    if (!title.trim()) return
    const plotlinePayload =
      plotlineId === '' || plotlineId === undefined ? null : Number(plotlineId)

    if (isNew) {
      const created = await createPlotNode({
        book_id: bookId,
        chapter_number: chapterNumber,
        title: title.trim(),
        score,
        node_type: nodeType,
        description: description.trim(),
        plotline_id: plotlinePayload
      })
      await setPlotNodeCharacters(created.id, selectedCharacterIds)
    } else if (data?.id) {
      await updatePlotNode(data.id, {
        chapter_number: chapterNumber,
        title: title.trim(),
        score,
        node_type: nodeType,
        description: description.trim(),
        plotline_id: plotlinePayload
      })
      await setPlotNodeCharacters(data.id, selectedCharacterIds)
    }
    closeModal()
  }

  const handleDelete = () => {
    if (!data?.id || isNew) return
    pushModal('confirm', {
      title: '删除剧情节点',
      message: '确定删除该节点吗？',
      onConfirm: async () => {
        await deletePlotNode(data.id!)
        closeModal()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <GitBranch size={18} />
            <span>{isNew ? '新建剧情节点' : '编辑剧情节点'}</span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">章节序号</label>
              <input
                type="number"
                value={chapterNumber}
                onChange={(e) => setChapterNumber(Number(e.target.value))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">节点类型</label>
              <select
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value as 'main' | 'branch')}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="main">主线</option>
                <option value="branch">支线</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">所属剧情线</label>
            <select
              value={plotlineId === '' ? '' : String(plotlineId)}
              onChange={(e) => {
                const v = e.target.value
                setPlotlineId(v === '' ? '' : Number(v))
              }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">未分配</option>
              {plotlines.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">节点标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              placeholder="例如：当众打脸反派"
            />
          </div>

          <div>
            <label className="flex justify-between text-[11px] text-[var(--text-muted)] uppercase mb-2">
              <span>爽度评分</span>
              <span className="text-[var(--accent-secondary)] font-mono">{score > 0 ? `+${score}` : score}</span>
            </label>
            <input
              type="range"
              min={-5}
              max={5}
              step={1}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-[var(--accent-primary)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 font-mono">
              <span>-5 毒点</span>
              <span>0 平稳</span>
              <span>+5 爆爽</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-2">出场人物</label>
            <div className="max-h-36 overflow-y-auto rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 space-y-1.5">
              {characters.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)] py-1">暂无角色，请在右侧角色面板添加。</p>
              ) : (
                characters.map((ch) => (
                  <label
                    key={ch.id}
                    className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-tertiary)] rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCharacterIds.includes(ch.id)}
                      onChange={() => toggleCharacter(ch.id)}
                      className="rounded border-[var(--border-secondary)] bg-[var(--bg-primary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                    />
                    <span className="truncate">{ch.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">说明</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
              placeholder="剧情要点、伏笔提示..."
            />
          </div>
        </div>

        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 gap-3 shrink-0">
          {!isNew && data?.id ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 text-xs text-[var(--danger-primary)] hover:brightness-105"
            >
              <Trash2 size={14} /> 删除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded"
            >
              <Save size={14} /> 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { FileText, X, Save } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useChapterStore } from '@/stores/chapter-store'
import { BUILTIN_TEMPLATES } from '@/utils/chapter-templates'

type CustomChapterTemplate = {
  id: number
  book_id: number | null
  name: string
  content: string
  is_builtin: number
  created_at: string
}

export default function NewChapterModal() {
  const { modalData, closeModal } = useUIStore()
  const createChapter = useChapterStore((s) => s.createChapter)
  const selectChapter = useChapterStore((s) => s.selectChapter)
  const volumes = useChapterStore((s) => s.volumes)
  const data = modalData as { volume_id?: number } | null

  const [volumeId, setVolumeId] = useState<number>(data?.volume_id || volumes[volumes.length - 1]?.id || 0)
  const [title, setTitle] = useState('')
  const [templateKey, setTemplateKey] = useState<string>('b:blank')
  const [customTemplates, setCustomTemplates] = useState<CustomChapterTemplate[]>([])

  const bookId = volumes.find((v) => v.id === volumeId)?.book_id

  useEffect(() => {
    if (!bookId) return
    void window.api.getChapterTemplates(bookId).then((rows) => setCustomTemplates(rows as CustomChapterTemplate[]))
  }, [bookId])

  const previewContent = useMemo(() => {
    if (templateKey.startsWith('b:')) {
      const id = templateKey.slice(2)
      return BUILTIN_TEMPLATES.find((t) => t.id === id)?.content ?? ''
    }
    const cid = Number(templateKey.slice(2))
    return customTemplates.find((t) => t.id === cid)?.content ?? ''
  }, [templateKey, customTemplates])

  const handleSubmit = async () => {
    if (!volumeId || !title.trim()) return
    const ch = await createChapter(volumeId, title.trim(), previewContent)
    await selectChapter(ch.id)
    closeModal()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-[440px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <FileText size={18} />
            <span>新建章节</span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">所属卷</label>
            <select
              value={volumeId}
              onChange={(e) => setVolumeId(Number(e.target.value))}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] text-sm"
            >
              {volumes.map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">章节标题</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              placeholder="例如：第 1 章 归来"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">章节模板</label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] text-sm"
            >
              <optgroup label="内置">
                {BUILTIN_TEMPLATES.map((t) => (
                  <option key={`b:${t.id}`} value={`b:${t.id}`}>{t.name}</option>
                ))}
              </optgroup>
              {customTemplates.length > 0 && (
                <optgroup label="自定义">
                  {customTemplates.map((t) => (
                    <option key={`c:${t.id}`} value={`c:${t.id}`}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">内容预览</label>
            <div
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-xs text-[var(--text-secondary)] max-h-[160px] overflow-y-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: previewContent || '<p class="text-slate-600">（空白）</p>'
              }}
            />
          </div>
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-end px-5 gap-3 shrink-0">
          <button onClick={closeModal} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            取消
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!title.trim() || !volumeId}
            className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded"
          >
            <Save size={14} /> 创建并打开
          </button>
        </div>
      </div>
    </div>
  )
}

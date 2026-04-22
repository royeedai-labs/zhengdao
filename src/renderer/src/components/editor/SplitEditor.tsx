import { useEffect, useMemo, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { X } from 'lucide-react'
import { useChapterStore } from '@/stores/chapter-store'
import { useConfigStore } from '@/stores/config-store'
import { useUIStore } from '@/stores/ui-store'
import type { Chapter } from '@/types'

export default function SplitEditor() {
  const volumes = useChapterStore((s) => s.volumes)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const { splitChapterId, setSplitChapterId, toggleSplitView } = useUIStore()
  const config = useConfigStore((s) => s.config)

  const editorFont = config?.editor_font || 'serif'
  const editorFontSize = config?.editor_font_size ?? 19
  const editorLineHeight = config?.editor_line_height ?? 2.2
  const editorWidth = config?.editor_width || 'standard'
  const widthClass =
    editorWidth === 'narrow' ? 'max-w-xl' : editorWidth === 'wide' ? 'max-w-5xl' : 'max-w-3xl'

  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null)

  const chapterOptions = useMemo(() => {
    const rows: { id: number; title: string; volumeTitle: string }[] = []
    for (const vol of volumes) {
      for (const ch of vol.chapters || []) {
        rows.push({
          id: ch.id,
          title: ch.title,
          volumeTitle: vol.title
        })
      }
    }
    return rows
  }, [volumes])

  useEffect(() => {
    if (splitChapterId !== null) return
    const other = chapterOptions.find((c) => c.id !== currentChapter?.id)
    if (other) setSplitChapterId(other.id)
  }, [chapterOptions, currentChapter?.id, splitChapterId, setSplitChapterId])

  useEffect(() => {
    if (!splitChapterId) return
    let cancelled = false
    void window.api.getChapter(splitChapterId).then((c) => {
      if (!cancelled) setLoadedChapter(c as Chapter)
    })
    return () => {
      cancelled = true
    }
  }, [splitChapterId])

  const displayChapter =
    splitChapterId != null && loadedChapter?.id === splitChapterId ? loadedChapter : null

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ history: { depth: 50 } }),
      Placeholder.configure({ placeholder: '' }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-node bg-[var(--danger-surface)] text-[var(--danger-primary)] rounded cursor-default'
        },
        suggestion: {
          char: '@',
          items: () => [],
          render: () => ({
            onStart: () => {},
            onUpdate: () => {},
            onKeyDown: () => false,
            onExit: () => {}
          })
        },
        renderLabel({ node }) {
          return node.attrs.label || ''
        }
      })
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: `${widthClass} mx-auto tracking-wide focus:outline-none min-h-[60vh] text-[var(--text-secondary)] opacity-95`,
        style: `font-family: ${editorFont}; font-size: ${editorFontSize}px; line-height: ${editorLineHeight}`
      }
    }
  })

  useEffect(() => {
    if (!editor || !displayChapter) return
    editor.commands.setContent(displayChapter.content || '<p></p>')
  }, [editor, displayChapter])

  useEffect(() => {
    if (!editor) return
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps?.attributes,
          class: `${widthClass} mx-auto tracking-wide focus:outline-none min-h-[60vh] text-[var(--text-secondary)] opacity-95`,
          style: `font-family: ${editorFont}; font-size: ${editorFontSize}px; line-height: ${editorLineHeight}`
        }
      }
    })
  }, [editor, widthClass, editorFont, editorFontSize, editorLineHeight])

  const title = displayChapter?.title ?? '对照章节'

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-editor)]">
      <header className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <select
          value={splitChapterId ?? ''}
          onChange={(e) => {
            const v = e.target.value
            setSplitChapterId(v ? Number(v) : null)
          }}
          className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
        >
          <option value="">选择章节</option>
          {chapterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.volumeTitle} · {c.title}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--text-muted)] truncate max-w-[120px]" title={title}>
          {title}
        </span>
        <button
          type="button"
          onClick={() => toggleSplitView()}
          className="shrink-0 p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
          title="关闭分屏"
        >
          <X size={16} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 min-h-0">
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  )
}

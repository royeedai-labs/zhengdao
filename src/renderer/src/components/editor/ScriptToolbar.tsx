import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  SCRIPT_PARAGRAPH_DESCRIPTIONS,
  SCRIPT_PARAGRAPH_KINDS,
  SCRIPT_PARAGRAPH_LABELS,
  type ScriptParagraphKind
} from './ScriptKindAttr'

/**
 * DI-03 — 剧本编辑器扩展工具栏
 *
 * 仅在 work profile.genre === 'script' 时挂在 EditorArea 顶部。
 * 选中文本或将光标置于段落内, 点击对应按钮把当前段落标记为剧本结构。
 * 再次点击同一类型 toggle 回普通段落。
 */

interface Props {
  editor: Editor | null
}

export default function ScriptToolbar({ editor }: Props) {
  const [activeKind, setActiveKind] = useState<ScriptParagraphKind | null>(null)

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const attrs = editor.getAttributes('paragraph') as { scriptKind?: string }
      const kind = attrs.scriptKind && SCRIPT_PARAGRAPH_KINDS.includes(attrs.scriptKind as ScriptParagraphKind)
        ? (attrs.scriptKind as ScriptParagraphKind)
        : null
      setActiveKind(kind)
    }
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!editor) return null

  const setKind = (kind: ScriptParagraphKind) => {
    const target = activeKind === kind ? null : kind
    editor
      .chain()
      .focus()
      .updateAttributes('paragraph', { scriptKind: target })
      .run()
  }

  return (
    <div className="flex items-center gap-1 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs">
      <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        剧本结构
      </span>
      {SCRIPT_PARAGRAPH_KINDS.map((kind) => {
        const active = activeKind === kind
        return (
          <button
            key={kind}
            type="button"
            onClick={() => setKind(kind)}
            title={SCRIPT_PARAGRAPH_DESCRIPTIONS[kind]}
            className={`rounded border px-2 py-0.5 transition ${
              active
                ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
            }`}
          >
            {SCRIPT_PARAGRAPH_LABELS[kind]}
          </button>
        )
      })}
      <span className="ml-auto text-[10px] text-[var(--text-muted)]">
        快捷: 选中段落 / 光标置入 → 点击按钮切换
      </span>
    </div>
  )
}

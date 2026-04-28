import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { InlineAiDraft } from '@/stores/ui-store'

export const aiInlineDraftKey = new PluginKey<{ tick: number }>('aiInlineDraft')

type AiInlineDraftOptions = {
  getDraft: () => InlineAiDraft | null
  getPosition: (draft: InlineAiDraft, state: EditorState) => number | null
  onAccept: (draft: InlineAiDraft) => void
  onDismiss: (draft: InlineAiDraft) => void
  onRetry: (draft: InlineAiDraft) => void
}

function draftContentText(draft: InlineAiDraft): string {
  return String(draft.payload.content || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function createIconButton(label: string, className: string, onClick: (event: MouseEvent) => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.className = className
  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  button.addEventListener('click', onClick)
  return button
}

function buildWidget(draft: InlineAiDraft, options: AiInlineDraftOptions) {
  const shell = document.createElement('span')
  shell.className = 'ai-inline-draft-widget'
  shell.contentEditable = 'false'
  shell.addEventListener('mousedown', (event) => event.stopPropagation())
  shell.addEventListener('click', (event) => event.stopPropagation())

  const header = document.createElement('span')
  header.className = 'ai-inline-draft-header'

  const title = document.createElement('span')
  title.className = 'ai-inline-draft-title'
  title.textContent = draft.title || 'AI 续写草稿'

  const actions = document.createElement('span')
  actions.className = 'ai-inline-draft-actions'
  actions.append(
    createIconButton('采纳', 'ai-inline-draft-accept', (event) => {
      event.preventDefault()
      event.stopPropagation()
      options.onAccept(draft)
    }),
    createIconButton('重试', 'ai-inline-draft-secondary', (event) => {
      event.preventDefault()
      event.stopPropagation()
      options.onRetry(draft)
    }),
    createIconButton('丢弃', 'ai-inline-draft-secondary', (event) => {
      event.preventDefault()
      event.stopPropagation()
      options.onDismiss(draft)
    })
  )

  header.append(title, actions)

  const preview = document.createElement('span')
  preview.className = 'ai-inline-draft-preview'
  preview.textContent = draftContentText(draft) || 'AI 草稿为空'

  shell.append(header, preview)
  return shell
}

export function createAiInlineDraftExtension(options: AiInlineDraftOptions) {
  return Extension.create({
    name: 'aiInlineDraft',

    addProseMirrorPlugins() {
      return [
        new Plugin<{ tick: number }>({
          key: aiInlineDraftKey,
          state: {
            init: () => ({ tick: 0 }),
            apply(tr, prev) {
              if (tr.getMeta(aiInlineDraftKey) === 'refresh') {
                return { tick: prev.tick + 1 }
              }
              return prev
            }
          },
          props: {
            decorations(state) {
              void aiInlineDraftKey.getState(state)
              const draft = options.getDraft()
              if (!draft) return DecorationSet.empty
              const position = options.getPosition(draft, state)
              if (position == null) return DecorationSet.empty
              const pos = Math.max(0, Math.min(position, state.doc.content.size))
              return DecorationSet.create(state.doc, [
                Decoration.widget(pos, () => buildWidget(draft, options), {
                  side: 1,
                  key: `ai-inline-draft-${draft.id}`
                })
              ])
            }
          }
        })
      ]
    }
  })
}

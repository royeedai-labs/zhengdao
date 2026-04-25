import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { AiCallerConfig } from '@/utils/ai'
import { aiComplete, isAiConfigReady } from '@/utils/ai'

export const inlineCompleteKey = new PluginKey<InlineCompletePluginState>('inlineComplete')

type InlineCompletePluginState = {
  suggestion: string | null
  pos: number | null
}

type InlineCompleteMeta =
  | { type: 'set'; suggestion: string; pos: number }
  | { type: 'clear' }

const PROMPT = '请续写后续内容，与前文衔接自然，篇幅控制在两三句话以内。'

export function createInlineCompleteExtension(
  getConfig: () => Promise<AiCallerConfig | null> | AiCallerConfig | null,
  getEnabled: () => boolean
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null
  let activityGeneration = 0

  function clearTimer() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function invalidateInFlight() {
    activityGeneration++
    abortController?.abort()
    abortController = null
  }

  return Extension.create({
    name: 'inlineComplete',

    addOptions() {
      return {
        enabled: true
      }
    },

    addProseMirrorPlugins() {
      const optionEnabled = this.options.enabled as boolean

      return [
        new Plugin<InlineCompletePluginState>({
          key: inlineCompleteKey,
          state: {
            init: (): InlineCompletePluginState => ({ suggestion: null, pos: null }),
            apply(tr, prev): InlineCompletePluginState {
              const meta = tr.getMeta(inlineCompleteKey) as InlineCompleteMeta | undefined
              if (meta?.type === 'clear') {
                return { suggestion: null, pos: null }
              }
              if (meta?.type === 'set') {
                return { suggestion: meta.suggestion, pos: meta.pos }
              }
              if (tr.docChanged || tr.selectionSet) {
                return { suggestion: null, pos: null }
              }
              return prev
            }
          },
          props: {
            decorations(state) {
              const st = inlineCompleteKey.getState(state)
              if (!st?.suggestion || st.pos == null) return DecorationSet.empty

              const pos = st.pos
              if (pos < 0 || pos > state.doc.content.size) return DecorationSet.empty

              const deco = Decoration.widget(
                pos,
                (view) => {
                  const latest = inlineCompleteKey.getState(view.state)
                  const span = document.createElement('span')
                  span.className = 'inline-suggestion'
                  span.textContent = latest?.suggestion || ''
                  return span
                },
                { side: 1, key: 'inline-complete-ghost' }
              )
              return DecorationSet.create(state.doc, [deco])
            },

            handleKeyDown(view, event) {
              const st = inlineCompleteKey.getState(view.state)
              if (event.key === 'Tab' && st?.suggestion && st.pos != null) {
                event.preventDefault()
                const insert = st.suggestion
                const pos = st.pos
                view.dispatch(view.state.tr.insertText(insert, pos).setMeta(inlineCompleteKey, { type: 'clear' }))
                return true
              }
              if (event.key === 'Escape' && st?.suggestion) {
                event.preventDefault()
                view.dispatch(view.state.tr.setMeta(inlineCompleteKey, { type: 'clear' }))
                return true
              }
              if (st?.suggestion) {
                const printable =
                  event.key.length === 1 ||
                  event.key === 'Enter' ||
                  event.key === 'Backspace' ||
                  event.key === 'Delete'
                if (printable && event.key !== 'Tab') {
                  view.dispatch(view.state.tr.setMeta(inlineCompleteKey, { type: 'clear' }))
                }
              }
              return false
            }
          },

          view(_editorView) {
            return {
              update(view, prevState) {
                if (!getEnabled() || !optionEnabled) {
                  clearTimer()
                  invalidateInFlight()
                  if (inlineCompleteKey.getState(view.state)?.suggestion) {
                    view.dispatch(view.state.tr.setMeta(inlineCompleteKey, { type: 'clear' }))
                  }
                  return
                }

                const docChanged = view.state.doc !== prevState.doc
                const selChanged = !view.state.selection.eq(prevState.selection)

                if (!docChanged && !selChanged) return

                invalidateInFlight()
                clearTimer()

                if (inlineCompleteKey.getState(view.state)?.suggestion) {
                  view.dispatch(view.state.tr.setMeta(inlineCompleteKey, { type: 'clear' }))
                }

                const { selection } = view.state
                if (!selection.empty) return

                abortController = new AbortController()
                const signal = abortController.signal
                const scheduledGen = activityGeneration

                debounceTimer = setTimeout(() => {
                  debounceTimer = null
                  void (async () => {
                    const cfg = await getConfig()
                    if (!isAiConfigReady(cfg)) return

                    const aiCfg: AiCallerConfig = {
                      ai_provider: cfg.ai_provider,
                      ai_api_key: cfg.ai_api_key,
                      ai_api_endpoint: cfg.ai_api_endpoint,
                      ai_model: cfg.ai_model || '',
                      ai_official_profile_id: cfg.ai_official_profile_id || ''
                    }

                    const cursorPos = view.state.selection.from
                    if (cursorPos !== view.state.selection.to) return

                    const textSlice = view.state.doc.textBetween(
                      Math.max(0, cursorPos - 300),
                      cursorPos,
                      '\n'
                    )

                    const res = await aiComplete(aiCfg, PROMPT, textSlice, { signal })
                    if (signal.aborted || scheduledGen !== activityGeneration) return

                    const suggestion = (res.content || '').trim()
                    if (!suggestion || res.error) return

                    const latestPos = view.state.selection.from
                    if (latestPos !== cursorPos || !view.state.selection.empty) return

                    view.dispatch(
                      view.state.tr.setMeta(inlineCompleteKey, {
                        type: 'set',
                        suggestion,
                        pos: cursorPos
                      })
                    )
                  })()
                }, 2000)
              },
              destroy() {
                clearTimer()
                invalidateInFlight()
              }
            }
          }
        })
      ]
    }
  })
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import { Crosshair, History, Palette, Search, Sparkles, X } from 'lucide-react'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useConfigStore } from '@/stores/config-store'
import { useToastStore } from '@/stores/toast-store'
import { useUpdateStore } from '@/stores/update-store'
import { aiSummarize, getResolvedAiConfigForBook, isAiConfigReady } from '@/utils/ai'
import { createInlineCompleteExtension } from '@/components/editor/InlineComplete'
import { useDailyStats } from '@/hooks/useDailyStats'
import { useAchievementCheck } from '@/hooks/useAchievements'
import { getSensitiveWords } from '@/utils/sensitive-words'
import type { Annotation, Chapter } from '@/types'
import { createAnnotationExtension } from '@/components/editor/AnnotationDecorations'
import { appendEditorAnnotation, getEditorAnnotations, setEditorAnnotations } from '@/components/editor/annotation-sync'
import { useShortcutStore } from '@/stores/shortcut-store'
import { matchesShortcutChord } from '@/utils/shortcuts'
import { TextReplaceExtension } from '@/components/editor/TextReplace'
import { collectCharacterIdsFromContent } from '@/utils/character-association'
import { setActiveEditor } from '@/components/editor/active-editor'
import { buildAiAssistantSelectionSnapshot } from '@/components/editor/ai-selection'
import { getLocalDateKey } from '@/utils/daily-workbench'
import MentionList from './MentionList'
import type { MentionListRef } from './MentionList'

const sensitivePluginKey = new PluginKey('sensitiveHighlight')
const focusModePluginKey = new PluginKey<{ tick: number }>('focusMode')

function createFocusModeExtension(getFocusMode: () => boolean) {
  return Extension.create({
    name: 'focusMode',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: focusModePluginKey,
          state: {
            init: () => ({ tick: 0 }),
            apply(tr, prev) {
              if (tr.getMeta('focusModeToggle')) {
                return { tick: prev.tick + 1 }
              }
              return prev
            }
          },
          props: {
            decorations(state) {
              void focusModePluginKey.getState(state)
              if (!getFocusMode()) return DecorationSet.empty
              const { doc, selection } = state
              const decorations: Decoration[] = []
              const $pos = selection.$head
              const resolvedPos = doc.resolve($pos.pos)
              let depth = resolvedPos.depth
              while (depth > 0 && resolvedPos.node(depth).type.name !== 'paragraph') {
                depth--
              }
              if (depth > 0) {
                const start = resolvedPos.before(depth)
                const end = resolvedPos.after(depth)
                decorations.push(Decoration.node(start, end, { class: 'is-focused' }))
              }
              return DecorationSet.create(doc, decorations)
            }
          }
        })
      ]
    }
  })
}

function createSensitiveHighlightExtension(words: string[]) {
  return Extension.create({
    name: 'sensitiveHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: sensitivePluginKey,
          state: {
            init(_, state) {
              return buildDecorations(state.doc, words)
            },
            apply(tr, oldSet) {
              if (tr.docChanged) {
                return buildDecorations(tr.doc, words)
              }
              return oldSet
            }
          },
          props: {
            decorations(state) {
              return this.getState(state)
            }
          }
        })
      ]
    }
  })
}

function buildDecorations(doc: any, words: string[]): DecorationSet {
  if (words.length === 0) return DecorationSet.empty
  const decorations: Decoration[] = []
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    for (const word of words) {
      let idx = 0
      while (true) {
        const foundIdx = node.text.indexOf(word, idx)
        if (foundIdx === -1) break
        decorations.push(
          Decoration.inline(pos + foundIdx, pos + foundIdx + word.length, {
            class: 'sensitive-word'
          })
        )
        idx = foundIdx + word.length
      }
    }
  })
  return DecorationSet.create(doc, decorations)
}

type PostSave = 'none' | 'syncOnly' | 'full'

export default function EditorArea() {
  const { currentChapter, volumes, updateChapterContent, updateChapterSummary, getTotalWords, getCurrentChapterNumber } =
    useChapterStore()
  const {
    openModal,
    focusMode,
    toggleFocusMode,
    openAiAssistant,
    setAiAssistantSelection
  } = useUIStore()
  const syncAppearances = useCharacterStore((s) => s.syncAppearances)
  const bookId = useBookStore((s) => s.currentBookId)!
  const checkAndUpgrade = useForeshadowStore((s) => s.checkAndUpgrade)
  const { refresh: refreshDailyStats } = useDailyStats()
  const checkAchievements = useAchievementCheck()
  const sensitiveList = useConfigStore((s) => s.config?.sensitive_list || 'default')
  const sensitiveWords = getSensitiveWords(sensitiveList)
  const config = useConfigStore((s) => s.config)

  const editorFont = config?.editor_font || 'serif'
  const editorFontSize = config?.editor_font_size ?? 19
  const editorLineHeight = config?.editor_line_height ?? 2.2
  const editorWidth = config?.editor_width || 'standard'
  const widthClass =
    editorWidth === 'narrow' ? 'max-w-xl' : editorWidth === 'wide' ? 'max-w-5xl' : 'max-w-3xl'

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const lastSavedRef = useRef<string>('')
  const prevWordCountRef = useRef(0)
  const prevChapterIdRef = useRef<number | undefined>(undefined)
  const [savedAt, setSavedAt] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    selectedText: string
  } | null>(null)

  const [annotationDraft, setAnnotationDraft] = useState<{
    x: number
    y: number
    textAnchor: string
  } | null>(null)
  const [annotationBody, setAnnotationBody] = useState('')

  const persistChapter = useCallback(
    async (
      chapterId: number,
      html: string,
      wordCount: number,
      editorInstance: Editor | null,
      postSave: PostSave
    ) => {
      useUIStore.getState().markChapterSaving(chapterId)
      const delta = wordCount - prevWordCountRef.current

      try {
        await updateChapterContent(chapterId, html, wordCount)
      } catch (error) {
        useUIStore
          .getState()
          .markChapterSaveError(chapterId, error instanceof Error ? error.message : '保存失败')
        throw error
      }

      if (delta > 0) {
        const today = getLocalDateKey()
        const stats = (await window.api.getDailyStats(bookId, today)) as { word_count?: number }
        await window.api.updateDailyStats(bookId, today, (stats?.word_count ?? 0) + delta)
        await refreshDailyStats()
        void checkAchievements(bookId)
      }

      prevWordCountRef.current = wordCount
      lastSavedRef.current = html
      try {
        localStorage.removeItem(`draft_${chapterId}`)
      } catch {
        void 0
      }
      setSavedAt(
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      )
      useUIStore.getState().markChapterSaved(chapterId)

      if (postSave === 'syncOnly' || postSave === 'full') {
        if (!editorInstance) return
        const mentionIds = new Set<number>()
        editorInstance.state.doc.descendants((node) => {
          if (node.type.name === 'mention' && node.attrs.id) {
            mentionIds.add(Number(node.attrs.id))
          }
        })
        const characterIds = collectCharacterIdsFromContent({
          plainText: editorInstance.getText(),
          mentionIds: [...mentionIds],
          characters: useCharacterStore
            .getState()
            .characters.map((character) => ({ id: character.id, name: character.name }))
        })
        await syncAppearances(chapterId, characterIds)
      }

      if (postSave === 'full') {
        const totalW = getTotalWords()
        const chNum = getCurrentChapterNumber()
        await checkAndUpgrade(bookId, totalW, chNum)
      }
    },
    [
      bookId,
      checkAndUpgrade,
      getCurrentChapterNumber,
      getTotalWords,
      refreshDailyStats,
      syncAppearances,
      updateChapterContent,
      checkAchievements
    ]
  )

  const persistChapterRef = useRef(persistChapter)
  useEffect(() => {
    persistChapterRef.current = persistChapter
  }, [persistChapter])

  const mentionSuggestion = {
    char: '@',
    items: ({ query }: { query: string }) => {
      return useCharacterStore
        .getState()
        .characters
        .filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
        .map((c) => ({ id: c.id, name: c.name, faction: c.faction }))
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null
      let popup: any = null

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor
          })
          if (!props.clientRect) return
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start'
          })
        },
        onUpdate: (props: any) => {
          component?.updateProps(props)
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect })
          }
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          return component?.ref?.onKeyDown(props) || false
        },
        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        }
      }
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: { depth: 100 } }),
      Placeholder.configure({ placeholder: '开始你的创作...' }),
      createSensitiveHighlightExtension(sensitiveWords),
      createFocusModeExtension(() => useUIStore.getState().focusMode),
      createAnnotationExtension(() => getEditorAnnotations()),
      TextReplaceExtension,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-node bg-[var(--danger-surface)] text-[var(--danger-primary)] rounded cursor-pointer'
        },
        suggestion: mentionSuggestion,
        renderLabel({ node }) {
          return node.attrs.label || ''
        }
      }),
      createInlineCompleteExtension(
        () => getResolvedAiConfigForBook(bookId),
        () => true
      )
    ],
    editorProps: {
      attributes: {
        class: `${widthClass} mx-auto tracking-wide focus:outline-none min-h-[60vh] text-[var(--text-primary)] ${focusMode ? 'focus-mode' : ''}`,
        style: `font-family: ${editorFont}; font-size: ${editorFontSize}px; line-height: ${editorLineHeight}`
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement
        if (target.classList.contains('mention-node') || target.closest('.mention-node')) {
          const mentionEl = target.classList.contains('mention-node')
            ? target
            : target.closest('.mention-node')!
          const charId = mentionEl.getAttribute('data-id')
          if (charId) {
            const char = useCharacterStore.getState().characters.find((c) => c.id === Number(charId))
            if (char) openModal('character', { ...char })
          }
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor: e }) => {
      isTypingRef.current = true
      if (!currentChapter) return
      const html = e.getHTML()
      useUIStore.getState().markChapterDirty(currentChapter.id)
      try {
        localStorage.setItem(`draft_${currentChapter.id}`, html)
      } catch {
        void 0
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const scheduledChapterId = currentChapter.id
      saveTimerRef.current = setTimeout(async () => {
        if (useChapterStore.getState().currentChapter?.id !== scheduledChapterId) return
        const text = e.getText()
        const wordCount = text.replace(/\s/g, '').length
        await persistChapterRef.current(scheduledChapterId, html, wordCount, e, 'full').catch((error) => {
          useUIStore
            .getState()
            .markChapterSaveError(scheduledChapterId, error instanceof Error ? error.message : '自动保存失败')
        })
      }, 800)
    }
  })

  const syncAiAssistantSelection = useCallback(() => {
    setAiAssistantSelection(
      buildAiAssistantSelectionSnapshot({
        currentChapterId: currentChapter?.id ?? null,
        editor
      })
    )
  }, [currentChapter?.id, editor, setAiAssistantSelection])

  const flushPendingSave = useCallback(
    async (postSave: PostSave = 'full') => {
      if (!editor || !currentChapter) return

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      const html = editor.getHTML()
      if (html === lastSavedRef.current) return

      const wordCount = editor.getText().replace(/\s/g, '').length
      await persistChapterRef.current(currentChapter.id, html, wordCount, editor, postSave)
    },
    [currentChapter, editor]
  )

  useEffect(() => {
    useUpdateStore.getState().setPrepareInstallHandler(currentChapter && editor ? () => flushPendingSave('full') : null)

    return () => {
      useUpdateStore.getState().setPrepareInstallHandler(null)
    }
  }, [currentChapter, editor, flushPendingSave])

  useEffect(() => {
    if (!editor) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const targetChapter = useChapterStore.getState().currentChapter
    const prevId = prevChapterIdRef.current
    const nextId = targetChapter?.id

    const shouldFlush =
      prevId !== undefined && (nextId === undefined ? true : prevId !== nextId)

    const applyChapterToEditor = (ch: Chapter) => {
      const content = ch.content || ''
      if (content !== lastSavedRef.current) {
        editor.commands.setContent(content || '<p></p>')
        lastSavedRef.current = content
      }
      prevWordCountRef.current = ch.word_count
      prevChapterIdRef.current = ch.id
      useUIStore.getState().markChapterSaved(ch.id, ch.updated_at)
    }

    if (!shouldFlush) {
      if (targetChapter) {
        applyChapterToEditor(targetChapter)
      } else {
        prevChapterIdRef.current = undefined
        prevWordCountRef.current = 0
      }
      return
    }

    let cancelled = false

    void (async () => {
      const html = editor.getHTML()
      const wc = editor.getText().replace(/\s/g, '').length
      if (html !== lastSavedRef.current) {
        await persistChapterRef.current(prevId!, html, wc, editor, 'syncOnly').catch((error) => {
          useUIStore
            .getState()
            .markChapterSaveError(prevId!, error instanceof Error ? error.message : '切换章节前保存失败')
        })
      }

      if (cancelled) return

      const latest = useChapterStore.getState().currentChapter
      if (latest) {
        applyChapterToEditor(latest)
      } else {
        prevChapterIdRef.current = undefined
        prevWordCountRef.current = 0
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editor, currentChapter?.id])

  useEffect(() => {
    if (!editor) return
    if (!currentChapter) {
      setEditorAnnotations([])
      editor.view.dispatch(editor.state.tr.setMeta('annotationsRefresh', true))
      return
    }
    let cancelled = false
    void (async () => {
      const rows = (await window.api.getAnnotations(currentChapter.id)) as Annotation[]
      if (cancelled) return
      setEditorAnnotations(rows)
      editor.view.dispatch(editor.state.tr.setMeta('annotationsRefresh', true))
    })()
    return () => {
      cancelled = true
    }
  }, [currentChapter, editor])

  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(editor.state.tr.setMeta('focusModeToggle', true))
  }, [editor, focusMode])

  useEffect(() => {
    if (!editor) return
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps?.attributes,
          class: `${widthClass} mx-auto tracking-wide focus:outline-none min-h-[60vh] text-[var(--text-primary)] ${focusMode ? 'focus-mode' : ''}`,
          style: `font-family: ${editorFont}; font-size: ${editorFontSize}px; line-height: ${editorLineHeight}`
        }
      }
    })
  }, [editor, widthClass, editorFont, editorFontSize, editorLineHeight, focusMode])

  useEffect(() => {
    if (!editor) return
    setActiveEditor(editor)
    return () => {
      setActiveEditor(null)
    }
  }, [editor])

  useEffect(() => {
    syncAiAssistantSelection()
  }, [syncAiAssistantSelection, currentChapter?.content])

  useEffect(() => {
    if (!editor) return
    const handleSelectionUpdate = () => {
      syncAiAssistantSelection()
      const smart = useUIStore.getState().smartTypewriter
      if (smart && !isTypingRef.current) return

      const pos = useUIStore.getState().typewriterPosition
      const positionRatio =
        pos === 'upper' ? 0.33 : pos === 'lower' ? 0.67 : 0.5

      const { view } = editor
      const { from } = view.state.selection
      const coords = view.coordsAtPos(from)
      const editorEl = view.dom.closest('.overflow-y-auto')
      if (editorEl && coords) {
        const containerRect = editorEl.getBoundingClientRect()
        const targetY = containerRect.top + containerRect.height * positionRatio
        const diff = coords.top - targetY
        if (Math.abs(diff) > 50) {
          editorEl.scrollBy({ top: diff, behavior: 'smooth' })
        }
      }

      if (smart) {
        isTypingRef.current = false
      }
    }
    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, syncAiAssistantSelection])

  const shortcutOverrides = useShortcutStore((s) => s.overrides)

  useEffect(() => {
    const getChord = useShortcutStore.getState().getChord

    const handler = (e: KeyboardEvent) => {
      if (matchesShortcutChord(e, getChord('find'))) {
        e.preventDefault()
        setShowSearch(true)
        return
      }
      if (matchesShortcutChord(e, getChord('save'))) {
        e.preventDefault()
        if (editor && currentChapter) {
          const html = editor.getHTML()
          const text = editor.getText()
          const wc = text.replace(/\s/g, '').length
          void persistChapterRef.current(currentChapter.id, html, wc, editor, 'none').catch((error) => {
            useUIStore
              .getState()
              .markChapterSaveError(currentChapter.id, error instanceof Error ? error.message : '手动保存失败')
          })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor, currentChapter, shortcutOverrides])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      let selectedText = ''
      if (editor && !editor.state.selection.empty) {
        selectedText = editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to
        )
      }
      setContextMenu({ x: e.clientX, y: e.clientY, selectedText })
    },
    [editor, setContextMenu]
  )

  const handleGenerateSummary = useCallback(async () => {
    if (!editor || !currentChapter) return
    const cfg = await getResolvedAiConfigForBook(bookId)
    if (!isAiConfigReady(cfg)) {
      useToastStore.getState().addToast('warning', '请先在应用设置中配置 AI')
      return
    }
    const text = editor.getText()
    if (!text.trim()) {
      useToastStore.getState().addToast('warning', '本章暂无正文')
      return
    }
    const res = await aiSummarize(
      {
        ai_provider: cfg.ai_provider,
        ai_api_key: cfg.ai_api_key,
        ai_api_endpoint: cfg.ai_api_endpoint,
        ai_model: cfg.ai_model || '',
        ai_official_profile_id: cfg.ai_official_profile_id || ''
      },
      text
    )
    if (res.error) {
      useToastStore.getState().addToast('error', res.error || '生成失败')
      return
    }
    await updateChapterSummary(currentChapter.id, res.content.trim())
    useToastStore.getState().addToast('success', '章节摘要已生成')
  }, [editor, currentChapter, updateChapterSummary, bookId])

  const handleFindReplace = () => {
    if (!editor || !searchQuery) return
    const text = editor.getText()
    if (!text.includes(searchQuery)) return

    const { doc, tr } = editor.state
    const replacements: { from: number; to: number }[] = []
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      let idx = 0
      while (true) {
        const foundIdx = node.text.indexOf(searchQuery, idx)
        if (foundIdx === -1) break
        replacements.push({ from: pos + foundIdx, to: pos + foundIdx + searchQuery.length })
        idx = foundIdx + searchQuery.length
      }
    })

    for (let i = replacements.length - 1; i >= 0; i--) {
      tr.replaceWith(replacements[i].from, replacements[i].to, editor.schema.text(replaceQuery))
    }

    if (replacements.length > 0) {
      editor.view.dispatch(tr)
      const html = editor.getHTML()
      const wc = editor.getText().replace(/\s/g, '').length
      if (currentChapter) {
        void persistChapterRef.current(currentChapter.id, html, wc, editor, 'none')
      }
    }
    setShowSearch(false)
  }

  const totalWords = getTotalWords()

  if (!currentChapter) {
    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-editor)] relative items-center justify-center px-8 text-center">
        <div className="max-w-md rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] px-8 py-7 shadow-sm">
          <p className="text-[var(--text-primary)] text-lg font-semibold">选择章节，开始写作</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            左侧大纲是写作主导航。你可以选中已有章节，或直接创建新的卷章。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => openModal('newVolume', { book_id: bookId })}
              className="primary-btn"
            >
              新建卷
            </button>
            {volumes.length > 0 && (
              <button
                type="button"
                onClick={() => openModal('newChapter', { volume_id: volumes[volumes.length - 1].id })}
                className="secondary-btn"
              >
                新建章
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--bg-editor)] relative min-h-0 min-w-0"
      onClick={() => {
        setContextMenu(null)
        setAnnotationDraft(null)
      }}
    >
      {showSearch && (
        <div className="absolute top-0 left-0 w-full z-20 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] px-4 py-2 flex items-center gap-2 animate-fade-in">
          <Search size={14} className="text-[var(--text-muted)]" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="查找..."
            className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] w-48"
          />
          <input
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="替换为..."
            className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] w-48"
          />
          <button
            onClick={handleFindReplace}
            className="primary-btn"
          >
            全部替换
          </button>
          <button
            onClick={() => setShowSearch(false)}
            title="关闭查找替换"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-12 flex items-center justify-between px-8 bg-gradient-to-b from-[var(--bg-editor)] to-transparent z-10 pointer-events-none">
        <div className="text-[var(--text-muted)] font-serif tracking-widest text-sm opacity-60">
          {currentChapter.title}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-8 pt-16 pb-32 lg:px-32 scroll-smooth"
        onContextMenu={handleContextMenu}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="absolute bottom-0 left-0 w-full h-7 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] flex items-center justify-between px-4 text-[10px] text-[var(--text-muted)] z-10">
        <span>
          本章 {currentChapter.word_count.toLocaleString()} 字 / 全书{' '}
          {totalWords.toLocaleString()} 字
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleFocusMode}
            className={`flex items-center gap-1 transition ${focusMode ? 'text-[var(--accent-secondary)]' : 'hover:text-[var(--info-primary)]'}`}
            title="段落聚焦模式"
          >
            <Crosshair size={11} /> 聚焦
          </button>
          <button
            onClick={() => openModal('snapshot')}
            className="flex items-center gap-1 hover:text-[var(--info-primary)] transition"
            title="查看历史快照"
          >
            <History size={11} /> 快照
          </button>
          <button
            type="button"
            onClick={() => openAiAssistant('continue_writing')}
            className="flex items-center gap-1 hover:text-[var(--accent-secondary)] transition"
            title="打开 AI 续写助手"
          >
            <Sparkles size={11} /> 续写
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateSummary()}
            className="flex items-center gap-1 hover:text-[var(--accent-secondary)] transition"
            title="AI 生成本章摘要"
          >
            <Sparkles size={11} /> 摘要
          </button>
          <button
            type="button"
            onClick={() => openModal('styleAnalysis', {})}
            className="flex items-center gap-1 hover:text-[var(--accent-secondary)] transition"
            title="写作风格分析"
          >
            <Palette size={11} /> 风格
          </button>
          <span>{savedAt ? `已保存 ${savedAt}` : '未保存'}</span>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl py-1 z-50 min-w-[160px] text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { editor?.commands.undo(); setContextMenu(null) }}
            className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
          >
            撤销
          </button>
          <button
            onClick={() => { editor?.commands.redo(); setContextMenu(null) }}
            className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
          >
            重做
          </button>
          <div className="border-t border-[var(--border-primary)] my-1" />
          {editor?.state.selection.empty ? (
            <>
              <button
                onClick={() => {
                  navigator.clipboard
                    .readText()
                    .then((t) => {
                      if (t) editor?.commands.insertContent(t)
                    })
                    .catch(() => {
                      /* clipboard permission denied or empty */
                    })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              >
                粘贴
              </button>
              <button
                type="button"
                onClick={() => {
                  openModal('textAnalysis', { scope: 'chapter' })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--info-primary)] hover:bg-[var(--info-surface)] transition"
              >
                文本分析（本章）
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  const sel = editor?.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to
                  )
                  if (sel) navigator.clipboard.writeText(sel).catch(() => {})
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              >
                复制
              </button>
              <button
                onClick={() => {
                  const sel = editor?.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to
                  )
                  if (sel) navigator.clipboard.writeText(sel).catch(() => {})
                  editor?.commands.deleteSelection()
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              >
                剪切
              </button>
              <div className="border-t border-[var(--border-primary)] my-1" />
              <button
                onClick={() => {
                  openModal('foreshadow', { selectedText: contextMenu.selectedText })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--warning-primary)] hover:bg-[var(--warning-surface)] transition"
              >
                设为伏笔
              </button>
              <button
                type="button"
                onClick={() => {
                  openModal('textAnalysis', { text: contextMenu.selectedText, scope: 'selection' })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--info-primary)] hover:bg-[var(--info-surface)] transition"
              >
                文本分析
              </button>
              <button
                type="button"
                onClick={() => {
                  openModal('styleAnalysis', { text: contextMenu.selectedText })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)] transition"
              >
                写作风格分析
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editor) return
                  const { from, to } = editor.state.selection
                  const textAnchor = editor.state.doc.textBetween(from, to, '\n')
                  const coords = editor.view.coordsAtPos(to)
                  setAnnotationBody('')
                  setAnnotationDraft({ x: coords.left, y: coords.bottom + 4, textAnchor })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--brand-primary)] hover:bg-[var(--brand-surface)] transition"
              >
                添加批注
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (!editor || !currentChapter) return
              const name = window.prompt('模板名称', currentChapter.title)
              if (!name?.trim()) {
                setContextMenu(null)
                return
              }
              void (async () => {
                try {
                  const html = editor.getHTML()
                  await window.api.createChapterTemplate(bookId, name.trim(), html)
                  useToastStore.getState().addToast('success', '已保存为章节模板')
                } catch {
                  useToastStore.getState().addToast('error', '保存失败')
                }
                setContextMenu(null)
              })()
            }}
            className="w-full px-3 py-1.5 text-left text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)] transition"
          >
            从当前章节创建模板
          </button>
          <button
            onClick={() => { editor?.commands.selectAll(); setContextMenu(null) }}
            className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
          >
            全选
          </button>
        </div>
      )}

      {annotationDraft && currentChapter && (
        <div
          className="fixed z-[60] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl p-2 w-[280px] animate-fade-in"
          style={{ left: annotationDraft.x, top: annotationDraft.y }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="批注"
        >
          <textarea
            autoFocus
            value={annotationBody}
            onChange={(e) => setAnnotationBody(e.target.value)}
            placeholder="批注内容..."
            rows={4}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAnnotationDraft(null)
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setAnnotationDraft(null)}
              className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!editor || !currentChapter) return
                const body = annotationBody.trim()
                if (!body) {
                  useToastStore.getState().addToast('warning', '请输入批注内容')
                  return
                }
                void (async () => {
                  const created = (await window.api.createAnnotation(
                    currentChapter.id,
                    annotationDraft.textAnchor,
                    body
                  )) as Annotation
                  appendEditorAnnotation(created)
                  editor.view.dispatch(editor.state.tr.setMeta('annotationsRefresh', true))
                  setAnnotationDraft(null)
                  useToastStore.getState().addToast('success', '已添加批注')
                })()
              }}
              className="px-3 py-1 text-xs rounded bg-[var(--brand-primary)] text-[var(--accent-contrast)] hover:brightness-105"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

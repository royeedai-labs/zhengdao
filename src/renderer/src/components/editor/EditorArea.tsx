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
import { Check, Copy, Crosshair, History, Palette, RotateCcw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useChapterStore } from '@/stores/chapter-store'
import { useCharacterStore } from '@/stores/character-store'
import { useUIStore } from '@/stores/ui-store'
import { useBookStore } from '@/stores/book-store'
import { useForeshadowStore } from '@/stores/foreshadow-store'
import { useConfigStore } from '@/stores/config-store'
import { useToastStore } from '@/stores/toast-store'
import { useUpdateStore } from '@/stores/update-store'
import { aiSummarize, getResolvedGlobalAiConfig, isAiConfigReady } from '@/utils/ai'
import { stripHtmlToText } from '@/utils/html-to-text'
import { useDailyStats } from '@/hooks/useDailyStats'
import { useAchievementCheck } from '@/hooks/useAchievements'
import { getSensitiveWords } from '@/utils/sensitive-words'
import type { Annotation, Chapter } from '@/types'
import { createAnnotationExtension } from '@/components/editor/AnnotationDecorations'
import { appendEditorAnnotation, getEditorAnnotations, setEditorAnnotations } from '@/components/editor/annotation-sync'
import { useShortcutStore } from '@/stores/shortcut-store'
import { matchesShortcutChord } from '@/utils/shortcuts'
import { TextReplaceExtension } from '@/components/editor/TextReplace'
import { ScriptKindAttr } from '@/components/editor/ScriptKindAttr'
import ScriptToolbar from '@/components/editor/ScriptToolbar'
import { collectCharacterIdsFromContent } from '@/utils/character-association'
import { setActiveEditor } from '@/components/editor/active-editor'
import { buildAiAssistantSelectionSnapshot } from '@/components/editor/ai-selection'
import { aiInlineDraftKey, createAiInlineDraftExtension } from '@/components/editor/AiInlineDraft'
import { createSensitiveHighlightExtension } from '@/components/editor/sensitive-highlight'
import { getLocalDateKey } from '@/utils/daily-workbench'
import { planTextDraftApplication, type AiDraftPayload } from '@/utils/ai/assistant-workflow'
import type { AiChapterDraft, InlineAiDraft } from '@/stores/ui-store'
import MentionList from './MentionList'
import type { MentionListRef } from './MentionList'

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

type PostSave = 'none' | 'syncOnly' | 'full'

const AI_CONTINUE_PROMPT = '从当前光标或章节末尾自然续写，保持当前节奏。'
const AI_POLISH_PROMPT = '润色选中文本，保留原意和人物口吻。'

function plainToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function ensureHtmlContent(text: string): string {
  const value = text.trim()
  if (!value) return ''
  return /<\/?[a-z][^>]*>/i.test(value) ? value : plainToHtml(value)
}

function countPlainWords(text: string): number {
  return text.replace(/\s/g, '').length
}

function scheduleIdleWork(callback: () => void, timeout = 450): () => void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }
  if (typeof idleWindow.requestIdleCallback === 'function') {
    const id = idleWindow.requestIdleCallback(callback, { timeout })
    return () => idleWindow.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(callback, timeout)
  return () => window.clearTimeout(id)
}

export default function EditorArea() {
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const volumes = useChapterStore((s) => s.volumes)
  const createVolume = useChapterStore((s) => s.createVolume)
  const createChapter = useChapterStore((s) => s.createChapter)
  const selectChapter = useChapterStore((s) => s.selectChapter)
  const updateChapterContent = useChapterStore((s) => s.updateChapterContent)
  const updateChapterSummary = useChapterStore((s) => s.updateChapterSummary)
  const getTotalWords = useChapterStore((s) => s.getTotalWords)
  const getCurrentChapterNumber = useChapterStore((s) => s.getCurrentChapterNumber)
  const openModal = useUIStore((s) => s.openModal)
  const focusMode = useUIStore((s) => s.focusMode)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)
  const openAiAssistant = useUIStore((s) => s.openAiAssistant)
  const setAiAssistantSelection = useUIStore((s) => s.setAiAssistantSelection)
  const inlineAiDraft = useUIStore((s) => s.inlineAiDraft)
  const clearInlineAiDraft = useUIStore((s) => s.clearInlineAiDraft)
  const aiChapterDraft = useUIStore((s) => s.aiChapterDraft)
  const updateAiChapterDraft = useUIStore((s) => s.updateAiChapterDraft)
  const clearAiChapterDraft = useUIStore((s) => s.clearAiChapterDraft)
  const chapterSaveStatus = useUIStore((s) => s.chapterSaveStatus)
  const syncAppearances = useCharacterStore((s) => s.syncAppearances)
  const bookId = useBookStore((s) => s.currentBookId)!

  useEffect(() => {
    let cancelled = false
    if (!bookId) {
      setAiWorkGenre(null)
      return () => {
        cancelled = true
      }
    }
    void window.api
      .aiGetWorkProfile(bookId)
      .then((profile: unknown) => {
        if (cancelled) return
        const g = (profile as { genre?: string } | null)?.genre
        setAiWorkGenre(typeof g === 'string' ? g : null)
      })
      .catch(() => {
        if (!cancelled) setAiWorkGenre(null)
      })
    return () => {
      cancelled = true
    }
  }, [bookId])
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
  const draftFlushCancelRef = useRef<(() => void) | null>(null)
  const isTypingRef = useRef(false)
  const lastSavedRef = useRef<string>('')
  const prevWordCountRef = useRef(0)
  const prevChapterIdRef = useRef<number | undefined>(undefined)
  const currentChapterIdRef = useRef<number | null>(currentChapter?.id ?? null)
  const inlineAiDraftRef = useRef<InlineAiDraft | null>(inlineAiDraft)
  const acceptInlineDraftRef = useRef<(draft: InlineAiDraft) => void>(() => {})
  const dismissInlineDraftRef = useRef<(draft: InlineAiDraft) => void>(() => {})
  const retryInlineDraftRef = useRef<(draft: InlineAiDraft) => void>(() => {})
  // DI-03: 当前作品题材包. 仅 'script' 时挂 ScriptToolbar。
  const [aiWorkGenre, setAiWorkGenre] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [editorHudVisible, setEditorHudVisible] = useState(false)
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

  useEffect(() => {
    currentChapterIdRef.current = currentChapter?.id ?? null
  }, [currentChapter?.id])

  useEffect(() => {
    inlineAiDraftRef.current = inlineAiDraft
  }, [inlineAiDraft])

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

  const cancelDraftFlush = useCallback(() => {
    draftFlushCancelRef.current?.()
    draftFlushCancelRef.current = null
  }, [])

  const scheduleDraftFlush = useCallback(
    (chapterId: number, editorInstance: Editor) => {
      cancelDraftFlush()
      draftFlushCancelRef.current = scheduleIdleWork(() => {
        draftFlushCancelRef.current = null
        if (useChapterStore.getState().currentChapter?.id !== chapterId) return
        try {
          localStorage.setItem(`draft_${chapterId}`, editorInstance.getHTML())
        } catch {
          void 0
        }
      })
    },
    [cancelDraftFlush]
  )

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
      ScriptKindAttr,
      // eslint-disable-next-line react-hooks/refs
      createAiInlineDraftExtension({
        getDraft: () => inlineAiDraftRef.current,
        getPosition: (draft, state) => {
          const currentChapterId = currentChapterIdRef.current
          if (currentChapterId == null || draft.chapterId !== currentChapterId) return null
          const plan = planTextDraftApplication(draft.payload as AiDraftPayload, currentChapterId)
          if (!plan || plan.kind !== 'insert_text') return null
          return plan.insertAt ?? state.doc.content.size
        },
        onAccept: (draft) => acceptInlineDraftRef.current(draft),
        onDismiss: (draft) => dismissInlineDraftRef.current(draft),
        onRetry: (draft) => retryInlineDraftRef.current(draft)
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-node bg-[var(--danger-surface)] text-[var(--danger-primary)] rounded cursor-pointer'
        },
        suggestion: mentionSuggestion,
        renderLabel({ node }) {
          return node.attrs.label || ''
        }
      })
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
      useUIStore.getState().markChapterDirty(currentChapter.id)
      scheduleDraftFlush(currentChapter.id, e)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const scheduledChapterId = currentChapter.id
      saveTimerRef.current = setTimeout(async () => {
        if (useChapterStore.getState().currentChapter?.id !== scheduledChapterId) return
        const html = e.getHTML()
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

  const acceptInlineDraft = useCallback(
    async (draft: InlineAiDraft) => {
      if (!editor || !currentChapter) {
        useToastStore.getState().addToast('warning', '请先打开目标章节')
        return
      }
      const plan = planTextDraftApplication(draft.payload as AiDraftPayload, currentChapter.id)
      if (!plan || plan.kind !== 'insert_text') {
        useToastStore.getState().addToast('error', '续写草稿已失效，请重新生成')
        clearInlineAiDraft(draft.id)
        return
      }

      const htmlFragment = ensureHtmlContent(plan.content)
      if (!htmlFragment) {
        useToastStore.getState().addToast('error', '续写草稿为空')
        clearInlineAiDraft(draft.id)
        return
      }

      try {
        const beforeHtml = editor.getHTML()
        const beforeWordCount = editor.getText().replace(/\s/g, '').length
        await window.api.createSnapshot({
          chapter_id: currentChapter.id,
          content: beforeHtml,
          word_count: beforeWordCount
        })
        const maxPos = editor.state.doc.content.size
        const insertAt = Math.max(0, Math.min(plan.insertAt ?? maxPos, maxPos))
        const inserted = editor.commands.insertContentAt(insertAt, htmlFragment)
        if (!inserted) throw new Error('无法将 AI 续写草稿插入当前正文。')
        const nextHtml = editor.getHTML()
        const nextWordCount = stripHtmlToText(nextHtml).replace(/\s/g, '').length
        await updateChapterContent(currentChapter.id, nextHtml, nextWordCount)
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        lastSavedRef.current = nextHtml
        prevWordCountRef.current = nextWordCount
        useUIStore.getState().markChapterSaved(currentChapter.id)
        await window.api.aiSetDraftStatus(draft.id, 'applied')
        clearInlineAiDraft(draft.id)
        useToastStore.getState().addToast('success', 'AI 续写已采纳')
      } catch (error) {
        useToastStore
          .getState()
          .addToast('error', error instanceof Error ? error.message : '采纳续写草稿失败')
      }
    },
    [clearInlineAiDraft, currentChapter, editor, updateChapterContent]
  )

  const dismissInlineDraft = useCallback(
    async (draft: InlineAiDraft) => {
      await window.api.aiSetDraftStatus(draft.id, 'dismissed')
      clearInlineAiDraft(draft.id)
      useToastStore.getState().addToast('info', '已丢弃 AI 续写草稿')
    },
    [clearInlineAiDraft]
  )

  const retryInlineDraft = useCallback(
    async (draft: InlineAiDraft) => {
      await window.api.aiSetDraftStatus(draft.id, 'dismissed')
      clearInlineAiDraft(draft.id)
      openAiAssistant({ input: draft.retryInput || AI_CONTINUE_PROMPT, autoSend: true })
    },
    [clearInlineAiDraft, openAiAssistant]
  )

  const acceptAiChapterDraft = useCallback(
    async (draft: AiChapterDraft) => {
      const title = draft.title.trim()
      const content = draft.content.trim()
      if (!title || !content) {
        useToastStore.getState().addToast('warning', '章节标题和正文不能为空')
        return
      }

      try {
        const requestedVolume = draft.volumeId
          ? volumes.find((volume) => volume.id === draft.volumeId)
          : null
        const requestedVolumeTitle = draft.volumeTitle.trim()
        let targetVolumeId = requestedVolume?.id ?? null
        if (targetVolumeId == null && requestedVolumeTitle) {
          const existingVolume = volumes.find((volume) => volume.title.trim() === requestedVolumeTitle)
          targetVolumeId = existingVolume?.id ?? null
          if (targetVolumeId == null) {
            const createdVolume = await createVolume(bookId, requestedVolumeTitle)
            targetVolumeId = createdVolume.id
          }
        }
        if (targetVolumeId == null) {
          const fallbackVolume = volumes[volumes.length - 1] ?? (await createVolume(bookId, '第一卷'))
          targetVolumeId = fallbackVolume.id
        }

        const html = ensureHtmlContent(content)
        const chapter = await createChapter(targetVolumeId, title, html, draft.summary.trim())
        await window.api.aiSetDraftStatus(draft.id, 'applied')
        clearAiChapterDraft(draft.id)
        await selectChapter(chapter.id)
        useToastStore.getState().addToast('success', `已创建 ${title}`)
      } catch (error) {
        useToastStore
          .getState()
          .addToast('error', error instanceof Error ? error.message : '创建章节失败')
      }
    },
    [bookId, clearAiChapterDraft, createChapter, createVolume, selectChapter, volumes]
  )

  const dismissAiChapterDraft = useCallback(
    async (draft: AiChapterDraft) => {
      await window.api.aiSetDraftStatus(draft.id, 'dismissed')
      clearAiChapterDraft(draft.id)
      useToastStore.getState().addToast('info', '已丢弃 AI 章节草稿')
    },
    [clearAiChapterDraft]
  )

  const retryAiChapterDraft = useCallback(
    async (draft: AiChapterDraft) => {
      await window.api.aiSetDraftStatus(draft.id, 'dismissed')
      clearAiChapterDraft(draft.id)
      openAiAssistant({ input: draft.retryInput, autoSend: true })
    },
    [clearAiChapterDraft, openAiAssistant]
  )

  const copyAiChapterDraft = useCallback(async (draft: AiChapterDraft) => {
    try {
      await navigator.clipboard.writeText(`${draft.title.trim()}\n\n${draft.content.trim()}`.trim())
      useToastStore.getState().addToast('success', '章节草稿已复制')
    } catch {
      useToastStore.getState().addToast('error', '复制失败，请检查剪贴板权限')
    }
  }, [])

  useEffect(() => {
    acceptInlineDraftRef.current = (draft) => {
      void acceptInlineDraft(draft)
    }
    dismissInlineDraftRef.current = (draft) => {
      void dismissInlineDraft(draft)
    }
    retryInlineDraftRef.current = (draft) => {
      void retryInlineDraft(draft)
    }
  }, [acceptInlineDraft, dismissInlineDraft, retryInlineDraft])

  useEffect(() => {
    if (!editor) return
    if (inlineAiDraft && (!currentChapter || inlineAiDraft.chapterId !== currentChapter.id)) {
      clearInlineAiDraft(inlineAiDraft.id)
      return
    }
    editor.view.dispatch(editor.state.tr.setMeta(aiInlineDraftKey, 'refresh'))
  }, [clearInlineAiDraft, currentChapter, editor, inlineAiDraft])

  useEffect(() => {
    setEditorHudVisible(false)
  }, [currentChapter?.id])

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
      cancelDraftFlush()

      const html = editor.getHTML()
      if (html === lastSavedRef.current) return

      const wordCount = editor.getText().replace(/\s/g, '').length
      await persistChapterRef.current(currentChapter.id, html, wordCount, editor, postSave)
    },
    [cancelDraftFlush, currentChapter, editor]
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
    cancelDraftFlush()

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
  }, [cancelDraftFlush, editor, currentChapter?.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      cancelDraftFlush()
    }
  }, [cancelDraftFlush])

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

  const requestAiContinuation = useCallback(
    (autoSend: boolean) => {
      if (!currentChapter) {
        useToastStore.getState().addToast('warning', '请先打开目标章节')
        setContextMenu(null)
        return
      }
      syncAiAssistantSelection()
      openAiAssistant({ input: AI_CONTINUE_PROMPT, autoSend })
      setContextMenu(null)
    },
    [currentChapter, openAiAssistant, setContextMenu, syncAiAssistantSelection]
  )

  const handleGenerateSummary = useCallback(async () => {
    if (!editor || !currentChapter || summaryLoading) return
    if (currentChapter.summary?.trim()) {
      const ok = window.confirm('当前章节已有摘要。确定重新生成并覆盖吗？')
      if (!ok) return
    }
    const cfg = await getResolvedGlobalAiConfig()
    if (!isAiConfigReady(cfg)) {
      useToastStore.getState().addToast('warning', '请先在应用设置中配置 AI')
      return
    }
    const text = editor.getText()
    if (!text.trim()) {
      useToastStore.getState().addToast('warning', '本章暂无正文')
      return
    }
    setSummaryLoading(true)
    try {
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
      const summary = res.content.trim()
      if (!summary) {
        useToastStore.getState().addToast('error', '生成的摘要为空')
        return
      }
      await updateChapterSummary(currentChapter.id, summary)
      setSummaryModalOpen(true)
      useToastStore.getState().addToast('success', '章节摘要已生成')
    } finally {
      setSummaryLoading(false)
    }
  }, [editor, currentChapter, summaryLoading, updateChapterSummary])

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
  const currentSummary = currentChapter?.summary?.trim() ?? ''
  const saveStatusLabel =
    chapterSaveStatus.kind === 'saving'
      ? '正文保存中'
      : chapterSaveStatus.kind === 'dirty'
        ? '正文未保存'
        : chapterSaveStatus.kind === 'error'
          ? '正文保存失败'
          : savedAt
            ? `正文已保存 ${savedAt}`
            : '正文已保存'
  const saveStatusClass =
    chapterSaveStatus.kind === 'error'
      ? 'text-[var(--danger-primary)]'
      : chapterSaveStatus.kind === 'dirty' || chapterSaveStatus.kind === 'saving'
        ? 'text-[var(--warning-primary)]'
        : 'text-[var(--text-muted)]'

  if (aiChapterDraft) {
    const draftWordCount = countPlainWords(aiChapterDraft.content)
    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-editor)] relative min-h-0 min-w-0 select-text">
        <div className="shrink-0 border-b border-[var(--warning-border)] bg-[var(--warning-surface)] px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--warning-primary)]">
                <Sparkles size={14} /> AI 章节草稿
                <span className="rounded border border-[var(--warning-border)] px-1.5 py-0.5 text-[10px]">
                  尚未写入小说
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                {draftWordCount.toLocaleString()} 字
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void acceptAiChapterDraft(aiChapterDraft)}
                disabled={!aiChapterDraft.title.trim() || !aiChapterDraft.content.trim()}
                className="primary-btn"
                title="创建章节"
              >
                <Check size={14} /> 创建章节
              </button>
              <button
                type="button"
                onClick={() => void copyAiChapterDraft(aiChapterDraft)}
                className="secondary-btn"
                title="复制正文"
              >
                <Copy size={14} /> 复制正文
              </button>
              <button
                type="button"
                onClick={() => void retryAiChapterDraft(aiChapterDraft)}
                className="secondary-btn"
                title="重生成"
              >
                <RotateCcw size={14} /> 重生成
              </button>
              <button
                type="button"
                onClick={() => void dismissAiChapterDraft(aiChapterDraft)}
                className="secondary-btn text-[var(--danger-primary)] hover:border-[var(--danger-border)] hover:text-[var(--danger-primary)]"
                title="丢弃"
              >
                <Trash2 size={14} /> 丢弃
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pt-6 pb-14 lg:px-32">
          <div className={`${widthClass} mx-auto space-y-4`}>
            <div className="grid gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm md:grid-cols-[1fr_220px]">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">章节标题</span>
                <input
                  value={aiChapterDraft.title}
                  onChange={(event) => updateAiChapterDraft({ title: event.target.value })}
                  className="field"
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">目标卷</span>
                <select
                  value={aiChapterDraft.volumeId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    updateAiChapterDraft({
                      volumeId: value ? Number(value) : null,
                      volumeTitle: value ? '' : aiChapterDraft.volumeTitle
                    })
                  }}
                  className="field"
                >
                  <option value="">新建或使用默认卷</option>
                  {volumes.map((volume) => (
                    <option key={volume.id} value={volume.id}>
                      {volume.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 md:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">新卷名</span>
                <input
                  value={aiChapterDraft.volumeTitle}
                  onChange={(event) => updateAiChapterDraft({ volumeTitle: event.target.value, volumeId: null })}
                  placeholder={volumes.length > 0 ? '留空则使用最新卷' : '第一卷'}
                  className="field"
                />
              </label>
              <label className="min-w-0 md:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">摘要</span>
                <textarea
                  rows={3}
                  value={aiChapterDraft.summary}
                  onChange={(event) => updateAiChapterDraft({ summary: event.target.value })}
                  className="field resize-none"
                />
              </label>
            </div>

            <textarea
              value={aiChapterDraft.content}
              onChange={(event) => updateAiChapterDraft({ content: event.target.value })}
              className="min-h-[62vh] w-full resize-y rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] px-8 py-7 text-[var(--text-primary)] shadow-sm focus:border-[var(--accent-primary)] focus:outline-none"
              style={{
                fontFamily: editorFont,
                fontSize: editorFontSize,
                lineHeight: editorLineHeight
              }}
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 z-10 flex h-7 w-full items-center justify-between border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 text-[10px] text-[var(--text-muted)]">
          <span>AI 草稿 {draftWordCount.toLocaleString()} 字</span>
          <span>确认创建后进入正式目录</span>
        </div>
      </div>
    )
  }

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

      {editorHudVisible && !showSearch && (
        <div
          className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/95 px-2 py-1 text-[10px] shadow-md backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openModal('snapshot')}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--info-primary)]"
            title="查看历史快照"
          >
            <History size={11} /> 快照
          </button>
          <span className={`px-1.5 py-1 ${saveStatusClass}`}>{saveStatusLabel}</span>
        </div>
      )}

      {aiWorkGenre === 'script' && <ScriptToolbar editor={editor} />}
      {aiWorkGenre === 'academic' && (
        <div className="flex items-center gap-1 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            学术工具
          </span>
          <button
            type="button"
            onClick={() => useUIStore.getState().openModal('citationPicker')}
            title="在光标处插入引文锚点 [@citekey] (DI-02)"
            className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[var(--text-primary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)]"
          >
            插入引文
          </button>
          <button
            type="button"
            onClick={() => useUIStore.getState().openModal('citationsManager')}
            title="管理学术引文条目 (citekey + 元数据)"
            className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[var(--text-primary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)]"
          >
            引文管理
          </button>
          <button
            type="button"
            onClick={() => useUIStore.getState().openModal('referencesBuild')}
            title="按 GB/T 7714 / APA / MLA 规范生成文末参考文献章节 (DI-02 v3)"
            className="rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-2 py-0.5 text-[var(--accent-secondary)] transition hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)]"
          >
            生成参考文献
          </button>
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">
            正文中以 [@citekey] 形式引用 · 一键生成符合规范的参考文献章节
          </span>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto px-8 pt-16 pb-32 lg:px-32 scroll-smooth"
        onClick={() => setEditorHudVisible(true)}
        onContextMenu={handleContextMenu}
      >
        {currentSummary && (
          <button
            type="button"
            onClick={() => setSummaryModalOpen(true)}
            className={`${widthClass} mx-auto mb-5 block w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] px-4 py-3 text-left shadow-sm transition hover:border-[var(--accent-primary)]`}
          >
            <div className="mb-1 text-[11px] font-medium text-[var(--accent-secondary)]">本章摘要</div>
            <div className="line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{currentSummary}</div>
          </button>
        )}
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
            type="button"
            onClick={() => requestAiContinuation(false)}
            className="flex items-center gap-1 hover:text-[var(--accent-secondary)] transition"
            title="打开 AI 续写助手"
          >
            <Sparkles size={11} /> 续写
          </button>
          <button
            type="button"
            onClick={() => setSummaryModalOpen(true)}
            className="flex items-center gap-1 hover:text-[var(--accent-secondary)] transition"
            title={currentSummary ? '查看本章摘要' : '生成本章摘要'}
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
        </div>
      </div>

      {summaryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setSummaryModalOpen(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)]">本章摘要</div>
                <div className="truncate text-xs text-[var(--text-muted)]">{currentChapter.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryModalOpen(false)}
                className="rounded p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-[180px] overflow-y-auto p-5">
              {currentSummary ? (
                <div className="whitespace-pre-wrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 text-sm leading-7 text-[var(--text-secondary)]">
                  {currentSummary}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center text-sm text-[var(--text-muted)]">
                  暂无摘要
                </div>
              )}
            </div>
            <div className="flex h-14 shrink-0 items-center justify-end gap-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
              <button
                type="button"
                onClick={() => setSummaryModalOpen(false)}
                className="px-4 py-1.5 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateSummary()}
                disabled={summaryLoading}
                className="flex items-center gap-1 rounded bg-[var(--accent-primary)] px-4 py-1.5 text-xs text-[var(--accent-contrast)] transition hover:bg-[var(--accent-secondary)] disabled:opacity-50"
              >
                <Sparkles size={14} /> {summaryLoading ? '生成中...' : currentSummary ? '重新生成' : 'AI 生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl py-1 z-50 min-w-[160px] text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
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
              <button
                type="button"
                onClick={() => requestAiContinuation(true)}
                className="w-full px-3 py-1.5 text-left text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)] transition"
              >
                AI 续写
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
                onClick={() => requestAiContinuation(true)}
                className="w-full px-3 py-1.5 text-left text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)] transition"
              >
                AI 续写
              </button>
              <button
                type="button"
                onClick={() => {
                  syncAiAssistantSelection()
                  openAiAssistant({ input: AI_POLISH_PROMPT, autoSend: true })
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)] transition"
              >
                AI 润色改写
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

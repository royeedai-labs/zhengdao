import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, Wand2, X } from 'lucide-react'
import { DOMSerializer } from '@tiptap/pm/model'
import { useUIStore } from '@/stores/ui-store'
import { useToastStore } from '@/stores/toast-store'
import { useBookStore } from '@/stores/book-store'
import { getActiveEditor } from '@/components/editor/active-editor'

/**
 * DI-04 v2 — 剧本对话块改写
 *
 * 桌面端针对 script 题材的对白连块改写流程:
 *  1. 接收编辑器选中文本作为初始输入 (modalData.selectedText)
 *  2. 简易 parser 把 "Name: text" / "NAME\n(parenthetical)\nline" 拆成结构化
 *     dialogueLine 数组, 用户可以在表格里手动微调
 *  3. 提交改写意图 + 数组到 layer2.dialogue-block-rewrite Skill
 *  4. 渲染原文/改写对照, 一键"应用替换"把结果写回选区
 *
 * 触发入口: AiAssistantDock 顶部 toolbar 的"对白块改写"按钮 (仅 script 题材
 * 显示)。
 */

interface DialogueLineDraft {
  character: string
  parenthetical: string
  line: string
}

interface RewrittenLine {
  character: string
  parenthetical?: string
  line: string
  reasoning?: string
}

interface DialogueRewriteOutput {
  projectId: string
  rewritten: RewrittenLine[]
  overallNotes?: string
}

interface ModalData {
  selectedText?: string
}

/**
 * DI-04 v3 — 优先用 DI-03 写好的 data-script-kind 段落结构。
 *
 * tiptap selection HTML 形如:
 *   <p data-script-kind="character">ANGELA</p>
 *   <p data-script-kind="parenthetical">(冷笑)</p>
 *   <p data-script-kind="dialogue">你又迟到了。</p>
 *   <p data-script-kind="character">MARK</p>
 *   <p data-script-kind="dialogue">堵车。</p>
 *
 * 解析时把连续 character + (parenthetical?) + dialogue 合并成一行
 * DialogueLineDraft。multi-line dialogue (同一 character 下多个 dialogue)
 * 用空格连成一段。识别失败 (没有任何 data-script-kind 段落) 时返回 null,
 * 让上层 fallback 到 plain-text naive parser。
 */
export function parseStructuredDialogue(html: string | null | undefined): DialogueLineDraft[] | null {
  if (!html) return null
  if (typeof DOMParser === 'undefined') return null
  if (!html.includes('data-script-kind')) return null

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const paragraphs = Array.from(doc.querySelectorAll('p'))
  if (paragraphs.length === 0) return null

  const lines: DialogueLineDraft[] = []
  let current: DialogueLineDraft | null = null

  for (const p of paragraphs) {
    const kind = p.getAttribute('data-script-kind')
    const text = (p.textContent || '').trim()
    if (!text) continue
    if (kind === 'character') {
      if (current) lines.push(current)
      current = { character: text, parenthetical: '', line: '' }
    } else if (kind === 'parenthetical' && current) {
      current.parenthetical = text.replace(/^\(/, '').replace(/\)$/, '')
    } else if (kind === 'dialogue' && current) {
      current.line = current.line ? `${current.line} ${text}` : text
    }
    // slugline / transition / 普通段落: 跳过 (剧本块改写只关心连续对白)
  }
  if (current) lines.push(current)

  const filled = lines.filter((l) => l.character && l.line)
  return filled.length > 0 ? filled : null
}

/**
 * 从 active tiptap editor 当前 selection 取出 HTML, 用 prosemirror DOMSerializer
 * 序列化 selection 切片, 再交给 parseStructuredDialogue。失败 / 没选区返回 null。
 */
function readStructuredFromActiveEditor(): DialogueLineDraft[] | null {
  if (typeof document === 'undefined') return null
  const editor = getActiveEditor()
  if (!editor) return null
  const { from, to } = editor.state.selection
  if (from === to) return null
  try {
    const slice = editor.state.doc.cut(from, to)
    const serializer = DOMSerializer.fromSchema(editor.state.schema)
    const fragment = serializer.serializeFragment(slice.content)
    const wrapper = document.createElement('div')
    wrapper.appendChild(fragment)
    return parseStructuredDialogue(wrapper.innerHTML)
  } catch {
    return null
  }
}

function naiveParseDialogue(raw: string): DialogueLineDraft[] {
  const text = raw.trim()
  if (!text) return [{ character: '', parenthetical: '', line: '' }]

  // 1) "Name: line" / "NAME：line" 风格 (zh + en)
  const colonStyle = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (colonStyle.every((l) => /^[A-Z\u4e00-\u9fa5][\w\u4e00-\u9fa5\s]{0,30}\s*[:：]/.test(l))) {
    return colonStyle.map((l) => {
      const [name, ...rest] = l.split(/[:：]/)
      return {
        character: (name || '').trim(),
        parenthetical: '',
        line: rest.join(':').trim()
      }
    })
  }

  // 2) Fountain 风格: NAME (大写) 后跟 (parenthetical) 后跟台词, 段落分隔
  const blocks = text.split(/\n{2,}/)
  if (blocks.length > 0 && blocks.every((b) => /^[A-Z\u4e00-\u9fa5][\w\u4e00-\u9fa5\s]{0,30}$/.test(b.split('\n')[0]?.trim() || ''))) {
    return blocks.map((b) => {
      const lines = b.split('\n').map((l) => l.trim()).filter(Boolean)
      const character = lines[0] || ''
      let parenthetical = ''
      let lineRest = lines.slice(1).join(' ')
      const parenMatch = lines[1] && /^\((.+)\)$/.exec(lines[1])
      if (parenMatch) {
        parenthetical = parenMatch[1] || ''
        lineRest = lines.slice(2).join(' ')
      }
      return { character, parenthetical, line: lineRest }
    })
  }

  // 兜底：单行台词，要用户手填角色名
  return [{ character: '', parenthetical: '', line: text }]
}

function formatRewrittenForApply(rewritten: RewrittenLine[]): string {
  return rewritten
    .map((line) => {
      const paren = line.parenthetical ? `(${line.parenthetical})\n` : ''
      return `${line.character}\n${paren}${line.line}`
    })
    .join('\n\n')
}

export default function DialogueRewriteModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const modalData = useUIStore((s) => s.modalData) as ModalData | null
  const bookId = useBookStore((s) => s.currentBookId)
  const addToast = useToastStore((s) => s.addToast)

  // DI-04 v3: 初始化时先尝试从 active editor 抓 selection HTML, 命中
  // DI-03 的 data-script-kind 段落则结构化解析 (作者已经标好了 character/
  // parenthetical/dialogue, 拆得最准); 失败再退化到 plain-text naive parser。
  const [lines, setLines] = useState<DialogueLineDraft[]>(() => {
    const structured = readStructuredFromActiveEditor()
    if (structured) return structured
    return naiveParseDialogue(modalData?.selectedText || '')
  })
  const [intent, setIntent] = useState('')
  const [voiceProfilesRaw, setVoiceProfilesRaw] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DialogueRewriteOutput | null>(null)

  useEffect(() => {
    if (modalData?.selectedText) {
      setLines(naiveParseDialogue(modalData.selectedText))
    }
  }, [modalData?.selectedText])

  const validLines = useMemo(
    () =>
      lines
        .map((l) => ({ ...l, character: l.character.trim(), line: l.line.trim() }))
        .filter((l) => l.character && l.line),
    [lines]
  )
  const ready = validLines.length >= 1 && bookId != null

  const updateLine = (idx: number, field: keyof DialogueLineDraft, value: string) =>
    setLines((cur) => cur.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))

  const addLine = () =>
    setLines((cur) => [...cur, { character: '', parenthetical: '', line: '' }])

  const removeLine = (idx: number) =>
    setLines((cur) => (cur.length > 1 ? cur.filter((_, i) => i !== idx) : cur))

  const handleRewrite = useCallback(async () => {
    if (!bookId) return
    setRunning(true)
    try {
      const characterVoiceProfiles: Record<string, string> = {}
      voiceProfilesRaw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((row) => {
          const [name, ...rest] = row.split(/[:：]/)
          if (name && rest.length > 0) {
            characterVoiceProfiles[name.trim()] = rest.join(':').trim()
          }
        })

      const r = await window.api.aiExecuteSkill(
        'layer2.dialogue-block-rewrite',
        {
          projectId: String(bookId),
          dialogueBlock: validLines.map((l) => ({
            character: l.character,
            parenthetical: l.parenthetical || undefined,
            line: l.line
          })),
          characterVoiceProfiles:
            Object.keys(characterVoiceProfiles).length > 0 ? characterVoiceProfiles : undefined,
          intent: intent.trim() || undefined
        },
        { modelHint: 'balanced' }
      )

      if (r.error) {
        const msg =
          r.code === 'PRO_REQUIRED'
            ? '剧本对白改写是 Pro 功能, 请先升级证道 Pro'
            : r.code === 'GENRE_PACK_REQUIRED'
              ? '剧本题材包未订阅, 该 Skill 仅 script 题材包用户可用'
              : r.code === 'SKILL_TIMEOUT'
                ? '改写超时, 请减少对白行数或稍后再试'
                : r.error.includes('GENRE_MISMATCH')
                  ? '当前作品题材不是 script, 该 Skill 仅在剧本题材下可用'
                  : r.error
        addToast('error', msg)
        return
      }
      setResult(r.output as DialogueRewriteOutput)
    } finally {
      setRunning(false)
    }
  }, [addToast, bookId, intent, validLines, voiceProfilesRaw])

  const handleApply = () => {
    if (!result) return
    const editor = getActiveEditor()
    if (!editor) {
      addToast('error', '未找到活跃编辑器, 无法应用改写')
      return
    }
    const text = formatRewrittenForApply(result.rewritten)
    const { from, to } = editor.state.selection
    if (from === to) {
      // 无选区——插到光标处
      editor.chain().focus().insertContent(text).run()
    } else {
      editor.chain().focus().deleteSelection().insertContent(text).run()
    }
    addToast('success', '已把改写后的对白写入正文')
    closeModal()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <Wand2 size={18} className="text-[var(--accent-secondary)]" />
            剧本对白块改写 (DI-04)
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">原始对白块</h3>
            <p className="text-xs text-[var(--text-muted)]">
              已尝试自动解析选中文本, 如解析有误请手动调整。每行需角色 + 台词。
              <br />
              支持 “Name: text” / Fountain 段落格式。
            </p>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
                  <div className="grid grid-cols-[120px_120px_1fr_auto] items-start gap-2">
                    <input
                      value={line.character}
                      onChange={(e) => updateLine(i, 'character', e.target.value)}
                      placeholder="角色名"
                      className="field text-xs"
                    />
                    <input
                      value={line.parenthetical}
                      onChange={(e) => updateLine(i, 'parenthetical', e.target.value)}
                      placeholder="(动作 / 表情)"
                      className="field text-xs"
                    />
                    <textarea
                      rows={2}
                      value={line.line}
                      onChange={(e) => updateLine(i, 'line', e.target.value)}
                      placeholder="台词内容"
                      className="field min-h-[40px] resize-vertical text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-red-500 disabled:opacity-30"
                      aria-label="删除该行"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 text-xs text-[var(--accent-secondary)] hover:underline"
              >
                <Plus size={12} /> 加一行
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">改写意图 (可选)</label>
              <textarea
                rows={2}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="例如: 让 Mark 更焦躁; 把对白浓度提高, 减少寒暄..."
                className="field text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">
                角色 voice profile (可选, 一行一条 “角色名: 性格/口吻”)
              </label>
              <textarea
                rows={3}
                value={voiceProfilesRaw}
                onChange={(e) => setVoiceProfilesRaw(e.target.value)}
                placeholder="Mark: 41 岁工程师, 焦虑型沟通, 偏好长句和反问&#10;Angela: 35 岁律师, 直球, 高频用短句"
                className="field font-mono text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleRewrite()}
                disabled={!ready || running}
                className="primary-btn disabled:opacity-50"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {running ? '改写中...' : 'AI 改写对白块'}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">改写结果</h3>
            {!result && (
              <p className="text-xs text-[var(--text-muted)]">
                等待改写。模型: balanced (单次约 2~10 秒)。
                <br />
                改写完成后可以预览每一行的差异和 reasoning, 满意再"应用替换"。
              </p>
            )}
            {result && (
              <div className="space-y-3">
                {result.overallNotes && (
                  <div className="rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] p-2 text-xs text-[var(--accent-secondary)]">
                    <span className="font-bold">总评:</span> {result.overallNotes}
                  </div>
                )}
                <div className="space-y-2">
                  {result.rewritten.map((rw, i) => {
                    const original = validLines[i]
                    return (
                      <div key={i} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-xs">
                        <div className="font-bold text-[var(--accent-secondary)]">
                          {rw.character}
                          {rw.parenthetical ? ` (${rw.parenthetical})` : ''}
                        </div>
                        {original && (
                          <div className="mt-1 text-[var(--text-muted)] line-through">{original.line}</div>
                        )}
                        <div className="mt-1 text-[var(--text-primary)]">{rw.line}</div>
                        {rw.reasoning && (
                          <div className="mt-1 text-[10px] text-[var(--text-muted)]">↪ {rw.reasoning}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    重新改写
                  </button>
                  <button type="button" onClick={handleApply} className="primary-btn">
                    应用替换
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

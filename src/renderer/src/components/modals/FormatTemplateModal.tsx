import { useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Save, X } from 'lucide-react'
import { useChapterStore } from '@/stores/chapter-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { stripHtmlToText } from '@/utils/html-to-text'
import {
  PROFESSIONAL_TEMPLATES,
  PROFESSIONAL_TEMPLATE_IDS,
  applyProfessionalTemplate,
  type ProfessionalTemplate,
  type ProfessionalTemplateId
} from '../../../../shared/professional-templates'

/**
 * DI-05 v2 — 公文格式模板 Modal
 *
 * 公文题材作品的工具入口：选择 12 个 GB/T 9704 公文模板之一，填写字段，
 * 把当前章节正文包装为正式公文。Modal 直接调 updateChapterContent + 创建
 * snapshot，绕过草稿篮（用户主动选模板填字段，不需 AI 草稿确认流程）。
 *
 * 触发入口（v3 添加）：EditorArea 工具栏在 genre='professional' 时显示
 * "应用格式模板"按钮 → useUIStore.pushModal('formatTemplate')。
 */

type Step = 'select' | 'fields' | 'preview'

const PLAIN_HTML_PARAGRAPHS = (text: string): string =>
  text
    .split('\n\n')
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

export default function FormatTemplateModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const currentChapter = useChapterStore((s) => s.currentChapter)
  const updateChapterContent = useChapterStore((s) => s.updateChapterContent)
  const addToast = useToastStore((s) => s.addToast)

  const [step, setStep] = useState<Step>('select')
  const [selectedId, setSelectedId] = useState<ProfessionalTemplateId | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const selectedTemplate: ProfessionalTemplate | null = selectedId
    ? PROFESSIONAL_TEMPLATES[selectedId]
    : null

  const previewText = (() => {
    if (!selectedTemplate || !currentChapter) return ''
    const content = stripHtmlToText(currentChapter.content || '').trim()
    if (!content) return ''
    return applyProfessionalTemplate(selectedTemplate.id, content, fields)
  })()

  const canGoToFields = selectedTemplate !== null
  const requiredFieldsFilled = selectedTemplate
    ? selectedTemplate.fields.filter((f) => f.required).every((f) => (fields[f.key] || '').trim().length > 0)
    : false

  const handleApply = async () => {
    if (!selectedTemplate || !currentChapter) return
    if (!requiredFieldsFilled) {
      addToast('warning', '请填写所有必填字段后再应用')
      return
    }
    const originalText = stripHtmlToText(currentChapter.content || '').trim()
    if (!originalText) {
      addToast('error', '当前章节内容为空，无法套用公文模板')
      return
    }
    setSubmitting(true)
    try {
      await window.api.createSnapshot({
        chapter_id: currentChapter.id,
        content: currentChapter.content ?? '',
        word_count: stripHtmlToText(currentChapter.content || '').replace(/\s/g, '').length
      })
      const wrapped = applyProfessionalTemplate(selectedTemplate.id, originalText, fields)
      const html = PLAIN_HTML_PARAGRAPHS(wrapped)
      const wordCount = stripHtmlToText(html).replace(/\s/g, '').length
      await updateChapterContent(currentChapter.id, html, wordCount)
      addToast('success', `已应用公文模板：${selectedTemplate.label}`)
      closeModal()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : '应用公文模板失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-elevated)] border border-[var(--border-primary)] w-[640px] max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-12 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="flex items-center space-x-2 text-[var(--accent-secondary)] font-bold">
            <FileText size={18} />
            <span>
              应用公文格式模板{selectedTemplate ? `：${selectedTemplate.label}` : ''}
            </span>
          </div>
          <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {!currentChapter && (
            <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-sm text-[var(--text-primary)]">
              请先打开一个章节再应用公文模板。
            </div>
          )}

          {currentChapter && step === 'select' && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-secondary)]">
                按 GB/T 9704-2012《党政机关公文格式》选择目标文种。文种决定红头 / 主送 /
                落款的字段集合与结尾用语。
              </p>
              {PROFESSIONAL_TEMPLATE_IDS.map((id) => {
                const tpl = PROFESSIONAL_TEMPLATES[id]
                const active = selectedId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active
                        ? 'border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                        : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm">{tpl.label}</div>
                        <div className="mt-1 text-[11px] text-[var(--text-muted)]">{tpl.description}</div>
                      </div>
                      {active && <CheckCircle2 size={16} className="shrink-0 text-[var(--accent-secondary)]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {currentChapter && step === 'fields' && selectedTemplate && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-secondary)]">
                填写「{selectedTemplate.label}」所需字段。星号字段必填；其他字段为空时使用占位符。
              </p>
              {selectedTemplate.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {f.label}
                    {f.required ? <span className="ml-1 text-[var(--danger-primary)]">*</span> : null}
                  </label>
                  <input
                    type="text"
                    value={fields[f.key] || ''}
                    onChange={(e) => setFields((cur) => ({ ...cur, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {currentChapter && step === 'preview' && selectedTemplate && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-secondary)]">
                这是「{selectedTemplate.label}」格式应用预览。点击下方"应用"将替换当前章节正文，应用前会自动创建快照可恢复。
              </p>
              <pre className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-[12px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap font-mono">
                {previewText || '当前章节内容为空，无法预览。'}
              </pre>
            </div>
          )}
        </div>

        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between px-5">
          <div className="text-[11px] text-[var(--text-muted)]">
            {step === 'select' ? '步骤 1 / 3 · 选择模板' : step === 'fields' ? '步骤 2 / 3 · 填写字段' : '步骤 3 / 3 · 预览'}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'select' && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 'preview' ? 'fields' : 'select'))}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center"
              >
                <ChevronLeft size={14} className="mr-1" /> 上一步
              </button>
            )}
            <button onClick={closeModal} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5">
              取消
            </button>
            {step === 'select' && (
              <button
                onClick={() => canGoToFields && setStep('fields')}
                disabled={!canGoToFields}
                className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-contrast)] rounded flex items-center transition"
              >
                下一步 <ChevronRight size={14} className="ml-1" />
              </button>
            )}
            {step === 'fields' && (
              <button
                onClick={() => requiredFieldsFilled && setStep('preview')}
                disabled={!requiredFieldsFilled}
                className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-contrast)] rounded flex items-center transition"
              >
                预览 <ChevronRight size={14} className="ml-1" />
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => void handleApply()}
                disabled={submitting || !previewText}
                className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--accent-contrast)] rounded flex items-center transition"
              >
                <Save size={14} className="mr-1" /> {submitting ? '应用中...' : '应用到章节'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

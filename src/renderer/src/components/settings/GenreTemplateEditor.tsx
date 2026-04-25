import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import type { CharacterField, EmotionLabel, FactionLabel, GenreTemplate, StatusLabel } from '@/types'

export interface GenreTemplateDraft extends Record<string, unknown> {
  name: string
  character_fields: CharacterField[]
  faction_labels: FactionLabel[]
  status_labels: StatusLabel[]
  emotion_labels: EmotionLabel[]
}

export function createEmptyGenreTemplateDraft(name = '新题材模板'): GenreTemplateDraft {
  return {
    name,
    character_fields: [],
    faction_labels: [],
    status_labels: [],
    emotion_labels: []
  }
}

export function draftFromGenreTemplate(template: Pick<
  GenreTemplate,
  'name' | 'character_fields' | 'faction_labels' | 'status_labels' | 'emotion_labels'
>): GenreTemplateDraft {
  return {
    name: template.name,
    character_fields: template.character_fields.map((field) => ({ ...field, options: field.options ? [...field.options] : undefined })),
    faction_labels: template.faction_labels.map((label) => ({ ...label })),
    status_labels: template.status_labels.map((label) => ({ ...label })),
    emotion_labels: template.emotion_labels.map((label) => ({ ...label }))
  }
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold text-[var(--text-primary)]">{children}</h3>
}

function SmallHint({ children }: { children: string }) {
  return <p className="text-[11px] text-[var(--text-muted)]">{children}</p>
}

function RowActions({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="rounded-md border border-dashed border-[var(--border-secondary)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-secondary)]"
    >
      + {label}
    </button>
  )
}

function FieldCard({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">{children}</div>
}

function PlainInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] ${
        props.className || ''
      }`}
    />
  )
}

function PlainSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] ${
        props.className || ''
      }`}
    />
  )
}

function RemoveButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-md border border-[var(--danger-border)] px-2 py-1 text-[11px] text-[var(--danger-primary)] transition hover:bg-[var(--danger-surface)]"
    >
      删除
    </button>
  )
}

export function GenreTemplatePreview({
  template,
  hint
}: {
  template: Pick<GenreTemplateDraft, 'name' | 'character_fields' | 'faction_labels' | 'status_labels' | 'emotion_labels'>
  hint?: string
}) {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div>
        <SectionTitle>{template.name}</SectionTitle>
        <SmallHint>{hint || '预览当前模板快照。'}</SmallHint>
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">角色字段</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {template.character_fields.length > 0 ? template.character_fields.map((field) => (
              <span
                key={field.key}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {field.label}
              </span>
            )) : <span className="text-[11px] text-[var(--text-muted)]">暂无角色字段</span>}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">阵营标签</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {template.faction_labels.length > 0 ? template.faction_labels.map((label) => (
              <span
                key={label.value}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {label.label}
              </span>
            )) : <span className="text-[11px] text-[var(--text-muted)]">暂无阵营标签</span>}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">状态标签</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {template.status_labels.length > 0 ? template.status_labels.map((label) => (
              <span
                key={label.value}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {label.label}
              </span>
            )) : <span className="text-[11px] text-[var(--text-muted)]">暂无状态标签</span>}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">爽度标签</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {template.emotion_labels.length > 0 ? template.emotion_labels.map((label) => (
              <span
                key={`${label.score}-${label.label}`}
                className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {label.score > 0 ? `+${label.score}` : label.score} · {label.label}
              </span>
            )) : <span className="text-[11px] text-[var(--text-muted)]">暂无爽度标签</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GenreTemplateEditor({
  draft,
  onChange
}: {
  draft: GenreTemplateDraft
  onChange: (draft: GenreTemplateDraft) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] uppercase text-[var(--text-muted)]">模板名称</label>
        <PlainInput
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="例如：悬疑群像"
        />
      </div>

      <EditableCharacterFields
        items={draft.character_fields}
        onChange={(character_fields) => onChange({ ...draft, character_fields })}
      />
      <EditableFactionLabels
        items={draft.faction_labels}
        onChange={(faction_labels) => onChange({ ...draft, faction_labels })}
      />
      <EditableStatusLabels
        items={draft.status_labels}
        onChange={(status_labels) => onChange({ ...draft, status_labels })}
      />
      <EditableEmotionLabels
        items={draft.emotion_labels}
        onChange={(emotion_labels) => onChange({ ...draft, emotion_labels })}
      />
    </div>
  )
}

function EditableCharacterFields({
  items,
  onChange
}: {
  items: CharacterField[]
  onChange: (items: CharacterField[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>角色字段</SectionTitle>
          <SmallHint>角色档案中的核心字段。</SmallHint>
        </div>
        <RowActions
          label="新增字段"
          onAdd={() => onChange([...items, { key: `field_${items.length + 1}`, label: '新字段', type: 'text' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((field, index) => (
          <div key={`${field.key}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_64px]">
            <PlainInput
              value={field.label}
              placeholder="显示名"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <PlainInput
              value={field.key}
              placeholder="字段 key"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item)))
              }
            />
            <PlainSelect
              value={field.type}
              onChange={(event) =>
                onChange(
                  items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, type: event.target.value as CharacterField['type'] } : item
                  )
                )}
            >
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="select">选项</option>
            </PlainSelect>
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除字段" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

function EditableFactionLabels({
  items,
  onChange
}: {
  items: FactionLabel[]
  onChange: (items: FactionLabel[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>阵营标签</SectionTitle>
          <SmallHint>用于角色阵营分类。</SmallHint>
        </div>
        <RowActions
          label="新增阵营"
          onAdd={() => onChange([...items, { value: `faction_${items.length + 1}`, label: '新阵营', color: 'slate' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((label, index) => (
          <div key={`${label.value}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_64px]">
            <PlainInput
              value={label.label}
              placeholder="标签名"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <PlainInput
              value={label.value}
              placeholder="标签值"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
              }
            />
            <PlainSelect
              value={label.color}
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, color: event.target.value } : item)))
              }
            >
              <option value="indigo">青蓝</option>
              <option value="amber">琥珀</option>
              <option value="red">红色</option>
              <option value="slate">石板</option>
              <option value="emerald">翠绿</option>
            </PlainSelect>
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除阵营" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

function EditableStatusLabels({
  items,
  onChange
}: {
  items: StatusLabel[]
  onChange: (items: StatusLabel[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>状态标签</SectionTitle>
          <SmallHint>用于角色/剧情资产状态展示。</SmallHint>
        </div>
        <RowActions
          label="新增状态"
          onAdd={() => onChange([...items, { value: `status_${items.length + 1}`, label: '新状态' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((label, index) => (
          <div key={`${label.value}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_64px]">
            <PlainInput
              value={label.label}
              placeholder="标签名"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <PlainInput
              value={label.value}
              placeholder="标签值"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
              }
            />
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除状态" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

function EditableEmotionLabels({
  items,
  onChange
}: {
  items: EmotionLabel[]
  onChange: (items: EmotionLabel[]) => void
}) {
  return (
    <FieldCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle>爽度标签</SectionTitle>
          <SmallHint>创世沙盘和爽点心电图使用的分值标签。</SmallHint>
        </div>
        <RowActions
          label="新增标签"
          onAdd={() => onChange([...items, { score: 0, label: '新标签' }])}
        />
      </div>
      <div className="space-y-2">
        {items.map((label, index) => (
          <div key={`${label.score}-${label.label}-${index}`} className="grid gap-2 md:grid-cols-[120px_1fr_64px]">
            <PlainInput
              type="number"
              min={-5}
              max={5}
              value={label.score}
              onChange={(event) =>
                onChange(
                  items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, score: Number(event.target.value) } : item
                  )
                )}
            />
            <PlainInput
              value={label.label}
              placeholder="标签文案"
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <RemoveButton onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="删除标签" />
          </div>
        ))}
      </div>
    </FieldCard>
  )
}

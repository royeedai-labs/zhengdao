import { buildContextText, clip, nonEmpty, section } from './helpers'
import type {
  AiAssistantContext,
  AiContextBlock,
  AiContextChipKind,
  AiSkillOverride,
  AiSkillTemplate,
  AiWorkProfile
} from './types'

/**
 * SPLIT-008 — context construction.
 *
 * `buildAssistantContext` converts the renderer's local data into the
 * "context blocks" that the prompt builders read. `applyAssistantContextSelection`
 * lets the chip UI toggle each block on/off without rebuilding the whole
 * context from scratch.
 *
 * `resolveSkillForBook` and `resolveAssistantContextPolicy` are tiny
 * resolvers that fold per-book overrides on top of the global skill
 * template / context policy.
 */

function normalizeMatchCandidate(value: string, maxLength = 24): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function isMentioned(source: string, candidate: string): boolean {
  const haystack = source.replace(/\s+/g, ' ').trim()
  const needle = normalizeMatchCandidate(candidate)
  if (!haystack || !needle || needle.length < 2) return false
  return haystack.includes(needle)
}

function createContextBlock(input: {
  id: string
  kind: AiContextChipKind
  label: string
  enabled: boolean
  body: string
}): AiContextBlock | null {
  if (!nonEmpty(input.body)) return null
  return {
    chip: {
      id: input.id,
      kind: input.kind,
      label: input.label,
      enabled: input.enabled
    },
    body: input.body
  }
}

export function applyAssistantContextSelection(
  context: AiAssistantContext,
  enabledChipIds: Iterable<string>
): AiAssistantContext {
  if (!context.blocks) return context

  const enabled = new Set(enabledChipIds)
  const blocks = context.blocks.map((block) => ({
    ...block,
    chip: {
      ...block.chip,
      enabled: enabled.has(block.chip.id)
    }
  }))

  return {
    ...context,
    blocks,
    chips: blocks.map((block) => block.chip),
    contextText: buildContextText(blocks)
  }
}

export function resolveSkillForBook(
  base: AiSkillTemplate,
  override?: AiSkillOverride | null
): AiSkillTemplate {
  if (!override) return base
  return {
    ...base,
    name: nonEmpty(override.name) ? override.name : base.name,
    description: nonEmpty(override.description) ? override.description : base.description,
    system_prompt: nonEmpty(override.system_prompt) ? override.system_prompt : base.system_prompt,
    user_prompt_template: nonEmpty(override.user_prompt_template)
      ? override.user_prompt_template
      : base.user_prompt_template,
    context_policy: nonEmpty(override.context_policy) ? override.context_policy : base.context_policy,
    output_contract: nonEmpty(override.output_contract) ? override.output_contract : base.output_contract,
    enabled_surfaces: nonEmpty(override.enabled_surfaces)
      ? override.enabled_surfaces
      : base.enabled_surfaces
  }
}

export function resolveAssistantContextPolicy(
  skill?: Pick<AiSkillTemplate, 'context_policy'> | null,
  profile?: Pick<AiWorkProfile, 'context_policy'> | null
): string {
  if (nonEmpty(skill?.context_policy)) return skill!.context_policy.trim()
  if (nonEmpty(profile?.context_policy)) return profile!.context_policy.trim()
  return 'smart_minimal'
}

export function buildAssistantContext(input: {
  policy: 'smart_minimal' | 'manual' | 'full' | string
  currentChapter?: { id: number; title: string; plainText: string; summary?: string } | null
  selectedText?: string
  characters?: Array<{ id: number; name: string; description?: string }>
  foreshadowings?: Array<{ id: number; text: string; status: string }>
  plotNodes?: Array<{ id: number; title: string; description?: string; chapter_number?: number }>
}): AiAssistantContext {
  const policy = input.policy || 'smart_minimal'
  const maxChapterChars = policy === 'full' ? 16000 : 2600
  const defaultEnabled = policy !== 'manual'
  const referenceText = `${input.selectedText || ''}\n${input.currentChapter?.summary || ''}\n${input.currentChapter?.plainText || ''}`.trim()
  const blocks: AiContextBlock[] = []

  const selectionBlock = createContextBlock({
    id: 'selection',
    kind: 'selection',
    label: '选中文本',
    enabled: defaultEnabled,
    body: section('选中文本', clip(input.selectedText || '', 1600))
  })
  if (selectionBlock) blocks.push(selectionBlock)

  const chapterBody = input.currentChapter
    ? [
        nonEmpty(input.currentChapter.summary)
          ? `本章摘要：${clip(input.currentChapter.summary || '', 900)}`
          : '',
        clip(input.currentChapter.plainText || '', maxChapterChars)
      ].filter(Boolean).join('\n\n')
    : ''
  const chapterBlock = input.currentChapter
    ? createContextBlock({
        id: `chapter:${input.currentChapter.id}`,
        kind: 'chapter',
        label: input.currentChapter.title,
        enabled: defaultEnabled,
        body: section(`当前章节：${input.currentChapter.title}`, chapterBody)
      })
    : null
  if (chapterBlock) blocks.push(chapterBlock)

  const rawCharacters =
    policy === 'smart_minimal'
      ? (input.characters || [])
          .filter((character) => isMentioned(referenceText, character.name))
          .slice(0, 10)
      : (input.characters || []).slice(0, policy === 'full' ? 20 : 12)
  const charactersBlock = createContextBlock({
    id: 'characters',
    kind: 'characters',
    label: '角色',
    enabled: defaultEnabled,
    body: section(
      '角色',
      rawCharacters
        .map((character) => `- ${character.name}${character.description ? `：${character.description}` : ''}`)
        .join('\n')
    )
  })
  if (charactersBlock) blocks.push(charactersBlock)

  const rawForeshadowings =
    policy === 'smart_minimal'
      ? (input.foreshadowings || [])
          .filter((item) => isMentioned(referenceText, item.text))
          .slice(0, 8)
      : (input.foreshadowings || []).slice(0, policy === 'full' ? 16 : 10)
  const foreshadowingsBlock = createContextBlock({
    id: 'foreshadowings',
    kind: 'foreshadowings',
    label: '伏笔',
    enabled: defaultEnabled,
    body: section(
      '伏笔',
      rawForeshadowings
        .map((item) => `- [${item.status}] ${item.text}`)
        .join('\n')
    )
  })
  if (foreshadowingsBlock) blocks.push(foreshadowingsBlock)

  const rawPlotNodes =
    policy === 'smart_minimal'
      ? (input.plotNodes || [])
          .filter(
            (node) =>
              isMentioned(referenceText, node.title) ||
              isMentioned(referenceText, node.description || '')
          )
          .slice(0, 8)
      : (input.plotNodes || []).slice(0, policy === 'full' ? 16 : 10)
  const plotNodesBlock = createContextBlock({
    id: 'plot_nodes',
    kind: 'plot_nodes',
    label: '剧情节点',
    enabled: defaultEnabled,
    body: section(
      '剧情节点',
      rawPlotNodes
        .map(
          (node) =>
            `- Ch${node.chapter_number ?? '?'} ${node.title}${node.description ? `：${node.description}` : ''}`
        )
        .join('\n')
    )
  })
  if (plotNodesBlock) blocks.push(plotNodesBlock)

  return {
    blocks,
    chips: blocks.map((block) => block.chip),
    contextText: buildContextText(blocks)
  }
}

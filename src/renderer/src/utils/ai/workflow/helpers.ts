import type { AiContextBlock } from './types'

/**
 * SPLIT-008 — string-shape helpers shared by canon-pack / context / prompt
 * builders. Pure functions, no DOM / window reach.
 */

export function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

export function clip(value: string, maxChars: number): string {
  const text = value.trim()
  if (text.length <= maxChars) return text
  const head = Math.floor(maxChars * 0.35)
  const tail = maxChars - head
  return `${text.slice(0, head)}\n...[已裁剪]...\n${text.slice(-tail)}`
}

export function section(title: string, body: string | null | undefined): string {
  if (!nonEmpty(body)) return ''
  return `## ${title}\n${body!.trim()}`
}

export function buildContextText(blocks: AiContextBlock[]): string {
  return blocks
    .filter((block) => block.chip.enabled && nonEmpty(block.body))
    .map((block) => block.body)
    .join('\n\n')
}

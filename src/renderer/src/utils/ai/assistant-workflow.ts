/**
 * SPLIT-008 — assistant-workflow re-export shim.
 *
 * The 902-LOC monolith has been broken into:
 *   workflow/types.ts        public types + AiDraftKind + ALLOWED_DRAFT_KINDS
 *   workflow/helpers.ts      nonEmpty / clip / section / buildContextText
 *   workflow/canon-pack.ts   buildDesktopCanonPack (Skill execution payload)
 *   workflow/context.ts      buildAssistantContext + chip selection +
 *                            resolveSkillForBook + resolveAssistantContextPolicy
 *   workflow/prompt.ts       composeSkillPrompt + composeAssistantChatPrompt
 *   workflow/parse.ts        parseAssistantDrafts + chapter-draft creation +
 *                            attachSelectionMetaToDrafts
 *   workflow/apply.ts        planTextDraftApplication
 *
 * Public API is unchanged. New code should import from the specific
 * sub-module to keep imports honest.
 */

export type {
  AiAssistantContext,
  AiCanonPack,
  AiContextBlock,
  AiContextChip,
  AiContextChipKind,
  AiDraftKind,
  AiDraftPayload,
  AiSelectionSnapshot,
  AiSkillOverride,
  AiSkillTemplate,
  AiTextDraftApplicationPlan,
  AiWorkProfile,
  CanonLockEntry
} from './workflow/types'

export { buildDesktopCanonPack } from './workflow/canon-pack'
export {
  applyAssistantContextSelection,
  buildAssistantContext,
  resolveAssistantContextPolicy,
  resolveSkillForBook
} from './workflow/context'
export { composeAssistantChatPrompt, composeSkillPrompt } from './workflow/prompt'
export {
  attachSelectionMetaToDrafts,
  createChapterDraftFromAssistantResponse,
  createChapterDraftFromPlainText,
  parseAssistantDrafts
} from './workflow/parse'
export { planTextDraftApplication } from './workflow/apply'

import { describe, expect, it } from 'vitest'
import { resolveAssistantSkillSelection } from '../conversation-mode'
import type { AiSkillOverride, AiSkillTemplate } from '../../../utils/ai/assistant-workflow'

const skills: AiSkillTemplate[] = [
  {
    id: 1,
    key: 'continue_writing',
    name: '续写正文',
    description: '续写',
    system_prompt: 'global continue',
    user_prompt_template: 'continue {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'plain_text',
    enabled_surfaces: 'assistant',
    sort_order: 1,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 2,
    key: 'create_character',
    name: '生成角色',
    description: '生成角色',
    system_prompt: 'global character',
    user_prompt_template: 'character {{input}}',
    context_policy: 'manual',
    output_contract: 'json_drafts',
    enabled_surfaces: 'assistant',
    sort_order: 2,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  }
]

describe('resolveAssistantSkillSelection', () => {
  it('keeps ordinary chat mode when no skill key is selected', () => {
    expect(resolveAssistantSkillSelection(skills, [], null)).toBeNull()
    expect(resolveAssistantSkillSelection(skills, [], '')).toBeNull()
  })

  it('resolves only an explicitly selected skill and applies book overrides', () => {
    const overrides: AiSkillOverride[] = [
      {
        id: 1,
        book_id: 1,
        skill_key: 'continue_writing',
        name: '本书续写',
        description: '',
        system_prompt: 'book continue',
        user_prompt_template: '',
        context_policy: '',
        output_contract: '',
        enabled_surfaces: '',
        created_at: '',
        updated_at: ''
      }
    ]

    expect(resolveAssistantSkillSelection(skills, overrides, 'continue_writing')).toMatchObject({
      key: 'continue_writing',
      name: '本书续写',
      system_prompt: 'book continue'
    })
  })
})

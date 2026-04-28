import { describe, expect, it } from 'vitest'
import {
  resolveAssistantIntent,
  resolveAssistantSkillSelection
} from '../conversation-mode'
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
  },
  {
    id: 3,
    key: 'polish_text',
    name: '润色改写',
    description: '润色',
    system_prompt: 'global polish',
    user_prompt_template: 'polish {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'json_drafts',
    enabled_surfaces: 'assistant',
    sort_order: 3,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 4,
    key: 'review_chapter',
    name: '审核本章',
    description: '审核',
    system_prompt: 'global review',
    user_prompt_template: 'review {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'plain_text',
    enabled_surfaces: 'assistant',
    sort_order: 4,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 5,
    key: 'create_wiki_entry',
    name: '生成设定',
    description: '设定',
    system_prompt: 'global wiki',
    user_prompt_template: 'wiki {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'json_drafts',
    enabled_surfaces: 'assistant',
    sort_order: 5,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 6,
    key: 'create_foreshadowing',
    name: '整理伏笔',
    description: '伏笔',
    system_prompt: 'global foreshadow',
    user_prompt_template: 'foreshadow {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'json_drafts',
    enabled_surfaces: 'assistant',
    sort_order: 6,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 7,
    key: 'create_plot_node',
    name: '剧情节点建议',
    description: '剧情',
    system_prompt: 'global plot',
    user_prompt_template: 'plot {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'json_drafts',
    enabled_surfaces: 'assistant',
    sort_order: 7,
    is_builtin: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 8,
    key: 'create_chapter',
    name: '创建章节',
    description: '章节',
    system_prompt: 'global chapter',
    user_prompt_template: 'chapter {{input}}',
    context_policy: 'smart_minimal',
    output_contract: 'json_drafts',
    enabled_surfaces: 'assistant',
    sort_order: 8,
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

describe('resolveAssistantIntent', () => {
  it('routes from the user request instead of accepting manual type overrides', () => {
    expect(
      resolveAssistantIntent({
        skills,
        userInput: '帮我生成角色',
        hasCurrentChapter: true
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'create_character' })
  })

  it('routes selected rewrite requests to polish_text', () => {
    expect(
      resolveAssistantIntent({
        skills,
        userInput: '帮我润色这段，让句子更顺',
        selectedText: '他拔剑冲了上去。',
        hasCurrentChapter: true
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'polish_text' })
  })

  it('routes continuation requests to continue_writing', () => {
    expect(
      resolveAssistantIntent({
        skills,
        userInput: '接着写下一段',
        hasCurrentChapter: true
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'continue_writing' })
  })

  it('routes chapter draft requests to create_chapter', () => {
    expect(
      resolveAssistantIntent({
        skills,
        userInput: '帮我生成下一章草稿',
        hasCurrentChapter: true,
        hasVolumes: true
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'create_chapter' })

    expect(
      resolveAssistantIntent({
        skills,
        userInput: '帮我新建章节卷，写出标题和正文',
        hasCurrentChapter: true,
        hasVolumes: true
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'create_chapter' })

    expect(
      resolveAssistantIntent({
        skills,
        userInput: '创建第二章，写出标题和正文',
        hasCurrentChapter: false,
        hasVolumes: false
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'create_chapter' })
  })

  it('routes chapter review requests to review_chapter', () => {
    expect(
      resolveAssistantIntent({
        skills,
        userInput: '审核这一章的毒点和人物一致性',
        hasCurrentChapter: true
      })
    ).toMatchObject({ mode: 'skill', skillKey: 'review_chapter' })
  })

  it('routes asset generation requests to matching skills', () => {
    expect(resolveAssistantIntent({ skills, userInput: '生成一个反派人物卡' })).toMatchObject({
      skillKey: 'create_character'
    })
    expect(resolveAssistantIntent({ skills, userInput: '设计一个功法设定' })).toMatchObject({
      skillKey: 'create_wiki_entry'
    })
    expect(resolveAssistantIntent({ skills, userInput: '整理这一段里的伏笔线索' })).toMatchObject({
      skillKey: 'create_foreshadowing'
    })
    expect(resolveAssistantIntent({ skills, userInput: '给我生成三个剧情节点建议' })).toMatchObject({
      skillKey: 'create_plot_node'
    })
  })

  it('keeps low-confidence general questions in ordinary chat', () => {
    expect(
      resolveAssistantIntent({
        skills,
        userInput: '你能帮我做什么？',
        hasCurrentChapter: true
      })
    ).toMatchObject({ mode: 'chat', skillKey: null })
  })
})

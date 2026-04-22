import { describe, expect, it } from 'vitest'
import {
  attachSelectionMetaToDrafts,
  buildAssistantContext,
  composeAssistantChatPrompt,
  composeSkillPrompt,
  parseAssistantDrafts,
  planTextDraftApplication,
  resolveAssistantContextPolicy,
  resolveSkillForBook,
  type AiSkillTemplate,
  type AiSkillOverride,
  type AiWorkProfile
} from '../assistant-workflow'

const baseSkill: AiSkillTemplate = {
  id: 1,
  key: 'continue_writing',
  name: '续写正文',
  description: '根据当前上下文续写',
  system_prompt: '你是网文助手。',
  user_prompt_template: '请续写：{{input}}',
  context_policy: 'current_chapter,selected_text,characters',
  output_contract: 'plain_text',
  enabled_surfaces: 'assistant,editor',
  sort_order: 1,
  is_builtin: 1,
  created_at: '',
  updated_at: ''
}

const profile: AiWorkProfile = {
  id: 1,
  book_id: 10,
  default_account_id: 2,
  style_guide: '短句，强节奏。',
  genre_rules: '都市逆袭，不写玄幻修仙。',
  content_boundaries: '不要改写已经确认的主线设定。',
  asset_rules: '角色必须包含阵营和一句动机。',
  rhythm_rules: '每 1200 字至少推进一个冲突。',
  context_policy: 'smart_minimal',
  created_at: '',
  updated_at: ''
}

describe('resolveSkillForBook', () => {
  it('prefers the book override while preserving the global skill identity', () => {
    const override: AiSkillOverride = {
      id: 3,
      book_id: 10,
      skill_key: 'continue_writing',
      name: '本书续写',
      description: '',
      system_prompt: '你是本书专属续写助手。',
      user_prompt_template: '按本书节奏续写：{{input}}',
      context_policy: '',
      output_contract: '',
      enabled_surfaces: '',
      created_at: '',
      updated_at: ''
    }

    expect(resolveSkillForBook(baseSkill, override)).toMatchObject({
      key: 'continue_writing',
      name: '本书续写',
      system_prompt: '你是本书专属续写助手。',
      user_prompt_template: '按本书节奏续写：{{input}}',
      context_policy: baseSkill.context_policy,
      output_contract: baseSkill.output_contract
    })
  })
})

describe('buildAssistantContext', () => {
  it('builds transparent smart-minimal context chips and trims long chapter text', () => {
    const context = buildAssistantContext({
      policy: 'smart_minimal',
      currentChapter: {
        id: 7,
        title: '第七章 宴会',
        plainText: `${'前情'.repeat(1200)}光标附近的关键冲突`
      },
      selectedText: '主角抬手压下全场。',
      characters: [
        { id: 1, name: '林凡', description: '主角' },
        { id: 2, name: '赵天宇', description: '反派' }
      ],
      foreshadowings: [{ id: 1, text: '黑色戒指', status: 'pending' }],
      plotNodes: [{ id: 1, title: '宴会反杀', description: '公开打脸', chapter_number: 7 }]
    })

    expect(context.chips.map((chip) => chip.kind)).toEqual([
      'selection',
      'chapter',
      'characters',
      'foreshadowings',
      'plot_nodes'
    ])
    expect(context.contextText).toContain('主角抬手压下全场。')
    expect(context.contextText).toContain('第七章 宴会')
    expect(context.contextText.length).toBeLessThan(5000)
  })
})

describe('resolveAssistantContextPolicy', () => {
  it('prefers the selected skill policy over the work profile policy', () => {
    expect(
      resolveAssistantContextPolicy(
        { context_policy: 'full' },
        { context_policy: 'smart_minimal' }
      )
    ).toBe('full')
    expect(resolveAssistantContextPolicy(null, { context_policy: 'manual' })).toBe('manual')
  })
})

describe('composeSkillPrompt', () => {
  it('combines the work profile, skill prompt, context chips, and user input', () => {
    const prompt = composeSkillPrompt({
      skill: baseSkill,
      profile,
      context: {
        contextText: '当前章节：主角来到宴会。',
        chips: [{ id: 'chapter:7', kind: 'chapter', label: '第七章 宴会', enabled: true }]
      },
      userInput: '续写 800 字'
    })

    expect(prompt.systemPrompt).toContain('你是网文助手。')
    expect(prompt.systemPrompt).toContain('短句，强节奏。')
    expect(prompt.systemPrompt).toContain('不要改写已经确认的主线设定。')
    expect(prompt.userPrompt).toContain('请续写：续写 800 字')
    expect(prompt.userPrompt).toContain('当前章节：主角来到宴会。')
    expect(prompt.userPrompt).toContain('第七章 宴会')
  })
})

describe('composeAssistantChatPrompt', () => {
  it('supports ordinary assistant questions without forcing a writing skill or JSON draft output', () => {
    const prompt = composeAssistantChatPrompt({
      profile,
      context: {
        contextText: '当前章节：主角来到宴会。',
        chips: [{ id: 'chapter:7', kind: 'chapter', label: '第七章 宴会', enabled: true }]
      },
      skills: [baseSkill],
      userInput: '你能为我做什么？'
    })

    expect(prompt.systemPrompt).toContain('普通对话')
    expect(prompt.systemPrompt).toContain('不要直接写入作品')
    expect(prompt.systemPrompt).toContain('续写正文')
    expect(prompt.userPrompt).toContain('你能为我做什么？')
    expect(prompt.userPrompt).toContain('当前章节：主角来到宴会。')
    expect(prompt.userPrompt).not.toContain('请续写')
    expect(prompt.userPrompt).not.toContain('请严格只返回一个可解析的 JSON 对象')
  })
})

describe('parseAssistantDrafts', () => {
  it('accepts only whitelisted draft kinds and rejects malformed structured output', () => {
    const parsed = parseAssistantDrafts(
      JSON.stringify({
        drafts: [
          { kind: 'create_chapter', title: '第八章 反杀', content: '<p>正文</p>' },
          { kind: 'delete_chapter', id: 7 }
        ]
      })
    )

    expect(parsed.drafts).toEqual([{ kind: 'create_chapter', title: '第八章 反杀', content: '<p>正文</p>' }])
    expect(parsed.errors).toEqual(['不支持的 AI 草稿类型：delete_chapter'])
  })

  it('extracts fenced JSON drafts even when the model adds explanatory prose', () => {
    const parsed = parseAssistantDrafts(`
这是角色草稿，请先预览再决定是否应用：

\`\`\`json
{
  "drafts": [
    {
      "kind": "create_character",
      "name": "苏离",
      "faction": "夜巡司",
      "status": "active",
      "description": "冷面刀修，擅长借势压人。",
      "custom_fields": {
        "动机": "查清师门灭门真相"
      }
    }
  ]
}
\`\`\`
`)

    expect(parsed.errors).toEqual([])
    expect(parsed.drafts).toEqual([
      {
        kind: 'create_character',
        name: '苏离',
        faction: '夜巡司',
        status: 'active',
        description: '冷面刀修，擅长借势压人。',
        custom_fields: {
          动机: '查清师门灭门真相'
        }
      }
    ])
  })
})

describe('attachSelectionMetaToDrafts', () => {
  it('binds replace and insert drafts to the current selection snapshot', () => {
    const drafts = attachSelectionMetaToDrafts(
      [
        { kind: 'replace_text', content: '改写后' },
        { kind: 'insert_text', content: '续写段落' }
      ],
      {
        chapterId: 9,
        text: '原选中文本',
        from: 12,
        to: 24
      }
    )

    expect(drafts).toEqual([
      {
        kind: 'replace_text',
        content: '改写后',
        original_text: '原选中文本',
        selection_chapter_id: 9,
        selection_from: 12,
        selection_to: 24
      },
      {
        kind: 'insert_text',
        content: '续写段落',
        selection_chapter_id: 9,
        selection_to: 24
      }
    ])
  })
})

describe('planTextDraftApplication', () => {
  it('refuses to replace text when the draft is not anchored to a source selection', () => {
    expect(
      planTextDraftApplication(
        { kind: 'replace_text', content: '改写后' },
        9
      )
    ).toEqual({
      kind: 'invalid',
      error: 'AI 草稿缺少原始选区，不能直接替换正文，请重新生成。'
    })
  })

  it('keeps insert drafts at the captured cursor when the chapter still matches', () => {
    expect(
      planTextDraftApplication(
        {
          kind: 'insert_text',
          content: '续写段落',
          selection_chapter_id: 7,
          selection_to: 88
        },
        7
      )
    ).toEqual({
      kind: 'insert_text',
      content: '续写段落',
      insertAt: 88
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  attachSelectionMetaToDrafts,
  buildAssistantContext,
  buildDesktopCanonPack,
  composeAssistantChatPrompt,
  composeSkillPrompt,
  createChapterDraftFromAssistantResponse,
  createChapterDraftFromPlainText,
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
        plainText: `${'前情'.repeat(1200)}林凡在宴会反杀，黑色戒指发烫，光标附近的关键冲突`
      },
      selectedText: '主角抬手压下赵天宇，全场哗然。',
      characters: [
        { id: 1, name: '林凡', description: '主角' },
        { id: 2, name: '赵天宇', description: '反派' },
        { id: 3, name: '苏离', description: '本章未出场' }
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
    expect(context.contextText).toContain('主角抬手压下赵天宇，全场哗然。')
    expect(context.contextText).toContain('第七章 宴会')
    expect(context.contextText).toContain('林凡')
    expect(context.contextText).toContain('赵天宇')
    expect(context.contextText).not.toContain('苏离')
    expect(context.contextText.length).toBeLessThan(5000)
  })

  it('keeps a blank chapter visible when it has a summary for AI drafting', () => {
    const context = buildAssistantContext({
      policy: 'smart_minimal',
      currentChapter: {
        id: 1,
        title: '第一章 开始',
        plainText: '',
        summary: '建立老王的现实处境和即将到来的变化。'
      },
      characters: [
        { id: 1, name: '老王', description: '退休老人，主视角' },
        { id: 2, name: '小李', description: '青年线索人物' }
      ],
      foreshadowings: [{ id: 1, text: '村口旧井夜里传出脚步声', status: 'pending' }],
      plotNodes: [
        { id: 1, title: '现实处境', description: '主角在生活压力中登场', chapter_number: 1 },
        { id: 2, title: '异常钩子', description: '轻幻想异象打破平静', chapter_number: 1 }
      ]
    })

    expect(context.chips.map((chip) => chip.kind)).toContain('chapter')
    expect(context.chips.map((chip) => chip.kind)).toContain('characters')
    expect(context.chips.map((chip) => chip.kind)).toContain('foreshadowings')
    expect(context.chips.map((chip) => chip.kind)).toContain('plot_nodes')
    expect(context.contextText).toContain('本章摘要：建立老王的现实处境')
    expect(context.contextText).toContain('小李')
    expect(context.contextText).toContain('村口旧井')
    expect(context.contextText).toContain('现实处境')
    expect(context.contextText).toContain('异常钩子')
  })
})

describe('buildDesktopCanonPack', () => {
  it('packages confirmed local story context without changing draft behavior', () => {
    const pack = buildDesktopCanonPack({
      bookId: 10,
      profile,
      generatedAt: '2026-04-27T00:00:00.000Z',
      currentChapter: {
        id: 7,
        title: '第七章 宴会',
        plainText: '林凡在宴会反杀，黑色戒指发烫。'
      },
      selectedText: '主角抬手压下赵天宇，全场哗然。',
      characters: [{ id: 1, name: '林凡', description: '主角' }],
      foreshadowings: [{ id: 1, text: '黑色戒指', status: 'pending' }],
      plotNodes: [{ id: 1, title: '宴会反杀', description: '公开打脸', chapter_number: 7 }],
      localCitations: [{ ref: 'L1', sourceId: '7', title: '第七章 宴会', excerpt: '黑色戒指发烫。' }]
    })

    expect(pack.version).toBe('canon-pack.v2')
    expect(pack.kind).toBe('canon')
    expect(pack.provenance).toEqual({
      source: 'desktop-local',
      generatedAt: '2026-04-27T00:00:00.000Z',
      userConfirmedOnly: true
    })
    expect(pack.style.styleGuide).toBe('短句，强节奏。')
    expect(pack.scene.currentChapter?.title).toBe('第七章 宴会')
    expect(pack.assets.characters[0]).toMatchObject({ id: '1', name: '林凡' })
    expect(pack.retrieval.mode).toBe('local_keyword')
    expect(pack.retrieval.citations[0]?.ref).toBe('L1')
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
    expect(prompt.systemPrompt).toContain('自动识别')
    expect(prompt.systemPrompt).toContain('不要直接写入作品')
    expect(prompt.systemPrompt).toContain('草稿篮确认')
    expect(prompt.systemPrompt).toContain('续写正文')
    expect(prompt.systemPrompt).not.toContain('选择对应能力卡')
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

  it('accepts JSON5-style lenient output with trailing commas (LB-07)', () => {
    const parsed = parseAssistantDrafts(`{
      "drafts": [
        { "kind": "insert_text", "content": "续写段落", },
      ],
    }`)
    expect(parsed.errors).toEqual([])
    expect(parsed.drafts).toEqual([{ kind: 'insert_text', content: '续写段落' }])
  })

  it('accepts JSON5-style lenient output with unquoted keys (LB-07)', () => {
    const parsed = parseAssistantDrafts(`{
      drafts: [
        { kind: 'insert_text', content: '续写段落' }
      ]
    }`)
    expect(parsed.errors).toEqual([])
    expect(parsed.drafts).toEqual([{ kind: 'insert_text', content: '续写段落' }])
  })

  it('accepts a single draft object without a drafts wrapper', () => {
    const parsed = parseAssistantDrafts(`{
      "kind": "create_chapter",
      "title": "第三章 雨夜追兵",
      "content": "雨声压住了马蹄声。"
    }`)

    expect(parsed.errors).toEqual([])
    expect(parsed.drafts).toEqual([
      {
        kind: 'create_chapter',
        title: '第三章 雨夜追兵',
        content: '雨声压住了马蹄声。'
      }
    ])
  })

  it('rejects writeable drafts that are missing required schema fields', () => {
    const parsed = parseAssistantDrafts(
      JSON.stringify({
        drafts: [
          { kind: 'create_chapter', title: '第九章 空壳' },
          { kind: 'create_character', description: '没有名字的角色' },
          { kind: 'create_wiki_entry', title: '空设定' }
        ]
      })
    )

    expect(parsed.drafts).toEqual([])
    expect(parsed.errors).toEqual([
      'AI 草稿 create_chapter 缺少章节正文',
      'AI 草稿 create_character 缺少角色名',
      'AI 草稿 create_wiki_entry 缺少设定内容'
    ])
  })

  it('accepts new GP-05 academic and professional draft kinds', () => {
    const parsed = parseAssistantDrafts(
      JSON.stringify({
        drafts: [
          { kind: 'create_citation', title: 'Smith 2024', payload: {} },
          { kind: 'apply_format_template', templateName: 'red-header-notice' }
        ]
      })
    )
    expect(parsed.errors).toEqual([])
    expect(parsed.drafts).toHaveLength(2)
  })
})

describe('createChapterDraftFromPlainText', () => {
  it('wraps non-JSON chapter output as a confirmable chapter draft', () => {
    expect(createChapterDraftFromPlainText('第十二章 风雪归人\n\n他推开门，风雪倒灌进来。')).toEqual({
      kind: 'create_chapter',
      title: '第十二章 风雪归人',
      content: '他推开门，风雪倒灌进来。'
    })
  })

  it('keeps prose without a chapter title as body content with a fallback title', () => {
    expect(createChapterDraftFromPlainText('他推开门，风雪倒灌进来。', 'AI 章节草稿')).toEqual({
      kind: 'create_chapter',
      title: 'AI 章节草稿',
      content: '他推开门，风雪倒灌进来。'
    })
  })

  it('preserves a plain volume heading when wrapping chapter prose', () => {
    expect(createChapterDraftFromPlainText('第一卷 潜龙在渊\n\n第二章 风雪归人\n\n他推开门，风雪倒灌进来。')).toEqual({
      kind: 'create_chapter',
      volume_title: '第一卷 潜龙在渊',
      title: '第二章 风雪归人',
      content: '他推开门，风雪倒灌进来。'
    })
  })
})

describe('createChapterDraftFromAssistantResponse', () => {
  it('coerces chapter-shaped JSON without a kind field', () => {
    expect(
      createChapterDraftFromAssistantResponse(`{
        "volume_title": "第一卷 潜龙在渊",
        "chapter_title": "第三章 雨夜追兵",
        "content": "雨声压住了马蹄声。",
        "summary": "追兵逼近。"
      }`)
    ).toEqual({
      kind: 'create_chapter',
      volume_title: '第一卷 潜龙在渊',
      title: '第三章 雨夜追兵',
      content: '雨声压住了马蹄声。',
      summary: '追兵逼近。'
    })
  })

  it('coerces nested chapter payloads from common model wrappers', () => {
    expect(
      createChapterDraftFromAssistantResponse(`{
        "chapter": {
          "title": "第三章 雨夜追兵",
          "body": "雨声压住了马蹄声。"
        }
      }`)
    ).toEqual({
      kind: 'create_chapter',
      title: '第三章 雨夜追兵',
      content: '雨声压住了马蹄声。'
    })
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

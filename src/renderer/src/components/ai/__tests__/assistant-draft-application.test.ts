import { describe, expect, it, vi } from 'vitest'
import { applyAiDraft, type ApplyAiDraftDeps } from '../assistant-draft-application'

function deps(): ApplyAiDraftDeps {
  return {
    currentChapter: null,
    bookId: 1,
    volumes: [{ id: 10, title: '第一卷' }],
    updateChapterContent: vi.fn(),
    createVolume: vi.fn().mockResolvedValue({ id: 11, title: '新卷' }),
    createChapter: vi.fn().mockResolvedValue({ id: 20 }),
    selectChapter: vi.fn(),
    updateChapterSummary: vi.fn(),
    createCharacter: vi.fn(),
    createWikiEntry: vi.fn(),
    createPlotNode: vi.fn(),
    createForeshadowing: vi.fn(),
    markDraft: vi.fn(),
    confirm: vi.fn(() => true)
  }
}

describe('applyAiDraft', () => {
  it('does not create a chapter from empty editor HTML', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 7,
        kind: 'create_chapter',
        title: '空章节草稿',
        payload: { title: '空章节草稿', content: '<p><br /></p>' },
        status: 'pending'
      },
      api
    )

    expect(api.createChapter).not.toHaveBeenCalled()
    expect(api.selectChapter).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('does not create a chapter from a plain non-breaking-space entity', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 8,
        kind: 'create_chapter',
        title: '空章节草稿',
        payload: { title: '空章节草稿', content: '&nbsp;' },
        status: 'pending'
      },
      api
    )

    expect(api.createChapter).not.toHaveBeenCalled()
    expect(api.selectChapter).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('creates a chapter with a readable plain-text summary from editor HTML', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 12,
        kind: 'create_chapter',
        title: '新章节草稿',
        payload: {
          title: '第十二章 账册',
          content: '<p>林雪拿到账册。</p>',
          summary: '<p>主角拿到账册。</p><p>反派开始追查。</p>'
        },
        status: 'pending'
      },
      api
    )

    expect(api.createChapter).toHaveBeenCalledWith(
      10,
      '第十二章 账册',
      '<p>林雪拿到账册。</p>',
      '主角拿到账册。\n反派开始追查。'
    )
    expect(api.selectChapter).toHaveBeenCalledWith(20)
    expect(api.markDraft).toHaveBeenCalledWith(12, 'applied')
  })

  it('does not update a chapter summary from empty editor HTML', async () => {
    const api = {
      ...deps(),
      currentChapter: { id: 7, content: '<p>正文</p>', summary: '' }
    }

    await applyAiDraft(
      {
        id: 9,
        kind: 'update_chapter_summary',
        title: '空摘要草稿',
        payload: { summary: '<p><br /></p>' },
        status: 'pending'
      },
      api
    )

    expect(api.updateChapterSummary).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('does not update a chapter summary from a plain non-breaking-space entity', async () => {
    const api = {
      ...deps(),
      currentChapter: { id: 7, content: '<p>正文</p>', summary: '' }
    }

    await applyAiDraft(
      {
        id: 10,
        kind: 'update_chapter_summary',
        title: '空摘要草稿',
        payload: { summary: '&nbsp;' },
        status: 'pending'
      },
      api
    )

    expect(api.updateChapterSummary).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('updates a chapter summary with visible text from editor HTML', async () => {
    const api = {
      ...deps(),
      currentChapter: { id: 7, content: '<p>正文</p>', summary: '' }
    }

    await applyAiDraft(
      {
        id: 11,
        kind: 'update_chapter_summary',
        title: '摘要草稿',
        payload: { summary: '<p>主角拿到账册。</p><p>反派开始追查。</p>' },
        status: 'pending'
      },
      api
    )

    expect(api.updateChapterSummary).toHaveBeenCalledWith(
      7,
      '主角拿到账册。\n反派开始追查。'
    )
    expect(api.markDraft).toHaveBeenCalledWith(11, 'applied')
  })

  it('does not create a character from an empty editor HTML name', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 19,
        kind: 'create_character',
        title: '空角色草稿',
        payload: { name: '<p><br /></p>', description: '冷面刀修。' },
        status: 'pending'
      },
      api
    )

    expect(api.createCharacter).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('creates a character with readable plain-text fields from editor HTML', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 20,
        kind: 'create_character',
        title: '角色草稿',
        payload: {
          name: '<p>苏离</p>',
          faction: '夜巡司',
          status: 'active',
          description: '<p>冷面刀修。</p><p>动机是查清旧案。</p>'
        },
        status: 'pending'
      },
      api
    )

    expect(api.createCharacter).toHaveBeenCalledWith({
      book_id: 1,
      name: '苏离',
      faction: '夜巡司',
      status: 'active',
      description: '冷面刀修。\n\n动机是查清旧案。',
      custom_fields: {}
    })
    expect(api.markDraft).toHaveBeenCalledWith(20, 'applied')
  })

  it('does not create a wiki entry from empty editor HTML content', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 13,
        kind: 'create_wiki_entry',
        title: '空设定草稿',
        payload: { title: '龙脉', content: '<p><br /></p>' },
        status: 'pending'
      },
      api
    )

    expect(api.createWikiEntry).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('creates a wiki entry with readable plain-text content from editor HTML', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 14,
        kind: 'create_wiki_entry',
        title: '设定草稿',
        payload: {
          category: '世界观',
          title: '龙脉',
          content: '<p>城底有旧龙脉。</p><p>每逢雨夜会发出低鸣。</p>'
        },
        status: 'pending'
      },
      api
    )

    expect(api.createWikiEntry).toHaveBeenCalledWith({
      book_id: 1,
      category: '世界观',
      title: '龙脉',
      content: '城底有旧龙脉。\n\n每逢雨夜会发出低鸣。'
    })
    expect(api.markDraft).toHaveBeenCalledWith(14, 'applied')
  })

  it('does not create a plot node from empty editor HTML description', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 17,
        kind: 'create_plot_node',
        title: '空剧情节点草稿',
        payload: { title: '宴会反杀', description: '<p><br /></p>' },
        status: 'pending'
      },
      api
    )

    expect(api.createPlotNode).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('creates a plot node with readable plain-text description from editor HTML', async () => {
    const api = deps()

    await applyAiDraft(
      {
        id: 18,
        kind: 'create_plot_node',
        title: '剧情节点草稿',
        payload: {
          title: '宴会反杀',
          description: '<p>主角借众人之口反压反派。</p><p>结尾留到账册线索。</p>',
          chapter_number: '12',
          score: '4',
          node_type: 'branch'
        },
        status: 'pending'
      },
      api
    )

    expect(api.createPlotNode).toHaveBeenCalledWith({
      book_id: 1,
      title: '宴会反杀',
      description: '主角借众人之口反压反派。\n\n结尾留到账册线索。',
      chapter_number: 12,
      score: 4,
      node_type: 'branch'
    })
    expect(api.markDraft).toHaveBeenCalledWith(18, 'applied')
  })

  it('does not create a foreshadowing from empty editor HTML text', async () => {
    const api = {
      ...deps(),
      currentChapter: { id: 7, content: '<p>正文</p>', summary: '' }
    }

    await applyAiDraft(
      {
        id: 15,
        kind: 'create_foreshadowing',
        title: '空伏笔草稿',
        payload: { text: '<p><br /></p>' },
        status: 'pending'
      },
      api
    )

    expect(api.createForeshadowing).not.toHaveBeenCalled()
    expect(api.markDraft).not.toHaveBeenCalled()
  })

  it('creates a foreshadowing with readable plain-text content from editor HTML', async () => {
    const api = {
      ...deps(),
      currentChapter: { id: 7, content: '<p>正文</p>', summary: '' }
    }

    await applyAiDraft(
      {
        id: 16,
        kind: 'create_foreshadowing',
        title: '伏笔草稿',
        payload: {
          text: '<p>旧井夜里传出脚步声。</p><p>井沿有新泥。</p>',
          expected_chapter: '12',
          expected_word_count: '3000'
        },
        status: 'pending'
      },
      api
    )

    expect(api.createForeshadowing).toHaveBeenCalledWith({
      book_id: 1,
      chapter_id: 7,
      text: '旧井夜里传出脚步声。\n\n井沿有新泥。',
      expected_chapter: 12,
      expected_word_count: 3000,
      status: 'pending'
    })
    expect(api.markDraft).toHaveBeenCalledWith(16, 'applied')
  })
})

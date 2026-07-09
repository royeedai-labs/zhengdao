import { describe, expect, it, vi } from 'vitest'
import { REMOVE_AI_TONE_SELECTION_INPUT, START_FIRST_CHAPTER_INPUT } from '../chapter-quick-actions'
import {
  getAssistantSkillPreflightError,
  getChapterReviewProFallbackError,
  resolveAssistantRequestMaxTokens,
  runChapterReviewProQuickAction,
  runRemoveAiToneQuickAction
} from '../useAiAssistantRequest'

describe('resolveAssistantRequestMaxTokens', () => {
  it('keeps ordinary chat and continuation requests on the default budget', () => {
    expect(resolveAssistantRequestMaxTokens({ skillKey: null, userInput: '聊聊人物动机' })).toBe(1400)
    expect(resolveAssistantRequestMaxTokens({ skillKey: 'continue_writing', userInput: '接着写下一段' })).toBe(1400)
  })

  it('uses a larger budget for full chapter drafting', () => {
    expect(resolveAssistantRequestMaxTokens({ skillKey: 'create_chapter', userInput: '生成下一章草稿' })).toBe(4200)
    expect(resolveAssistantRequestMaxTokens({ skillKey: 'continue_writing', userInput: START_FIRST_CHAPTER_INPUT })).toBe(4200)
  })
})

describe('getAssistantSkillPreflightError', () => {
  it('blocks local chapter review when the current chapter body is empty', () => {
    expect(
      getAssistantSkillPreflightError({
        skillKey: 'review_chapter',
        currentChapter: { id: 7, content: '<p><br /></p>' }
      })
    ).toBe('当前章节正文为空，无法审核本章。')
  })

  it('allows local chapter review when the current chapter has body text', () => {
    expect(
      getAssistantSkillPreflightError({
        skillKey: 'review_chapter',
        currentChapter: { id: 7, content: '<p>林雪推门入场。</p>' }
      })
    ).toBeNull()
  })
})

describe('runRemoveAiToneQuickAction', () => {
  it('calls layer2.deslop directly and creates a replace_text draft', async () => {
    const api = {
      aiAddMessage: vi
        .fn()
        .mockResolvedValueOnce({ id: 1, role: 'user', content: REMOVE_AI_TONE_SELECTION_INPUT })
        .mockResolvedValueOnce({ id: 2, role: 'assistant', content: 'done' }),
      aiExecuteSkill: vi.fn().mockResolvedValue({
        runId: 'run-deslop-1',
        modelUsed: 'mock-model',
        output: {
          issues: [{ patternId: 'tier1.众所周知', quote: '众所周知' }],
          rewritten: '林雪必须拿到账册，却被守卫拦下。',
          protectedSpansApplied: [{ start: 0, end: 4, reason: 'custom', text: '林雪' }],
          secondPassAudit: []
        }
      }),
      aiCreateDraft: vi.fn().mockResolvedValue({
        id: 3,
        conversation_id: 8,
        kind: 'replace_text',
        title: '去 AI 味替换草稿（选区）',
        payload: {},
        status: 'pending',
        target_ref: 'chapter:7'
      })
    }

    const result = await runRemoveAiToneQuickAction({
      text: REMOVE_AI_TONE_SELECTION_INPUT,
      bookId: 9,
      conversationId: 8,
      currentChapter: { id: 7, content: '原章正文' },
      selectionChapterId: 7,
      selectionText: '众所周知，林雪站在那里。',
      selectionFrom: 12,
      selectionTo: 24,
      profile: {
        id: 1,
        book_id: 9,
        style_guide: '',
        genre_rules: '',
        content_boundaries: '',
        asset_rules: '',
        rhythm_rules: '',
        context_policy: 'smart_minimal',
        genre: 'webnovel',
        style_fingerprint: '{"voice":"短句、具体动作"}',
        created_at: '',
        updated_at: ''
      },
      contextChips: [],
      intent: { mode: 'skill', skillKey: 'remove_ai_tone', confidence: 1, reason: 'test' },
      api
    })

    expect(api.aiExecuteSkill).toHaveBeenCalledWith(
      'layer2.deslop',
      expect.objectContaining({
        text: '众所周知，林雪站在那里。',
        genre: 'webnovel',
        mode: 'rewrite',
        styleFingerprint: '{"voice":"短句、具体动作"}'
      }),
      { modelHint: 'balanced' }
    )
    expect(api.aiCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'replace_text',
        target_ref: 'chapter:7',
        payload: expect.objectContaining({
          kind: 'replace_text',
          content: '林雪必须拿到账册，却被守卫拦下。',
          original_text: '众所周知，林雪站在那里。',
          selection_chapter_id: 7,
          selection_from: 12,
          selection_to: 24,
          skill_run_id: 'run-deslop-1',
          quality_issues: expect.any(Array),
          protected_spans_applied: expect.any(Array)
        })
      })
    )
    expect(result.draft.kind).toBe('replace_text')
  })

  it('blocks whole-chapter deslop when the chapter only contains a non-breaking-space entity', async () => {
    const api = {
      aiAddMessage: vi
        .fn()
        .mockResolvedValueOnce({ id: 1, role: 'user', content: '去 AI 味' })
        .mockResolvedValueOnce({ id: 2, role: 'assistant', content: 'done' }),
      aiExecuteSkill: vi.fn().mockResolvedValue({
        runId: 'run-deslop-empty',
        output: {
          rewritten: '不应被调用',
          issues: [],
          protectedSpansApplied: [],
          secondPassAudit: []
        }
      }),
      aiCreateDraft: vi.fn().mockResolvedValue({
        id: 3,
        conversation_id: 8,
        kind: 'replace_text',
        title: '去 AI 味替换草稿（本章）',
        payload: {},
        status: 'pending',
        target_ref: 'chapter:7'
      })
    }

    await expect(
      runRemoveAiToneQuickAction({
        text: '去 AI 味',
        bookId: 9,
        conversationId: 8,
        currentChapter: { id: 7, content: '&nbsp;' },
        selectionChapterId: 7,
        selectionText: '',
        selectionFrom: null,
        selectionTo: null,
        profile: null,
        contextChips: [],
        intent: { mode: 'skill', skillKey: 'remove_ai_tone', confidence: 1, reason: 'test' },
        api
      })
    ).rejects.toThrow('当前章节正文为空，无法去 AI 味。')
    expect(api.aiAddMessage).not.toHaveBeenCalled()
    expect(api.aiExecuteSkill).not.toHaveBeenCalled()
    expect(api.aiCreateDraft).not.toHaveBeenCalled()
  })
})

describe('runChapterReviewProQuickAction', () => {
  it('keeps validation fallbacks from continuing into local chapter review', () => {
    expect(getChapterReviewProFallbackError('missing_chapter')).toBe('请先打开目标章节，再使用“Pro 质量复盘”。')
    expect(getChapterReviewProFallbackError('empty_chapter')).toBe('当前章节正文为空，无法进行 Pro 质量复盘。')
    expect(getChapterReviewProFallbackError('provider_unavailable')).toBeNull()
    expect(getChapterReviewProFallbackError(undefined)).toBeNull()
  })

  it('calls layer2.chapter-review-pro and records a unified review message with feedback metadata', async () => {
    const api = {
      aiAddMessage: vi
        .fn()
        .mockResolvedValueOnce({ id: 10, role: 'user', content: 'Pro 质量复盘' })
        .mockResolvedValueOnce({ id: 11, role: 'assistant', content: 'report' }),
      aiExecuteSkill: vi.fn().mockResolvedValue({
        runId: 'run-review-pro-1',
        modelUsed: 'review-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.02 },
        output: {
          projectId: 'book-9',
          chapterReviews: [
            {
              chapterId: 'chapter-7',
              structureOverall: 5,
              thrillScore: 4,
              poisonScore: 7,
              riskLevel: 'high',
              diagnosis: '中段张力断档。',
              highlights: ['开头冲突明确'],
              risks: ['毒点偏高'],
              recommendations: ['补一个阶段性收益']
            }
          ],
          summary: { scannedChapters: 1, weakStructure: 1, highPoison: 1, lowThrill: 0 }
        }
      })
    }

    const result = await runChapterReviewProQuickAction({
      text: 'Pro 质量复盘',
      bookId: 9,
      conversationId: 8,
      currentChapter: { id: 7, title: '第七章 宴会', content: '<p>林雪推门入场。</p>' },
      api
    })

    expect(api.aiExecuteSkill).toHaveBeenCalledWith(
      'layer2.chapter-review-pro',
      {
        projectId: 'book-9',
        chapters: [{ id: 'chapter-7', title: '第七章 宴会', order: 0, content: '林雪推门入场。' }],
        genre: 'other'
      },
      { modelHint: 'balanced' }
    )
    expect(api.aiAddMessage).toHaveBeenLastCalledWith(
      8,
      'assistant',
      expect.stringContaining('## Pro 质量复盘'),
      expect.objectContaining({
        skill_id: 'layer2.chapter-review-pro',
        skill_run_id: 'run-review-pro-1',
        model_used: 'review-model',
        usage: expect.objectContaining({ totalTokens: 30 })
      })
    )
    expect(result.fallbackToLocalReview).toBe(false)
    expect(result.assistantMessage).toMatchObject({ id: 11 })
  })

  it('does not present missing chapter-review risk as low risk', async () => {
    const api = {
      aiAddMessage: vi
        .fn()
        .mockResolvedValueOnce({ id: 20, role: 'user', content: 'Pro 质量复盘' })
        .mockResolvedValueOnce({ id: 21, role: 'assistant', content: 'report' }),
      aiExecuteSkill: vi.fn().mockResolvedValue({
        runId: 'run-review-pro-empty',
        output: { projectId: 'book-9', chapterReviews: [], summary: { scannedChapters: 1 } }
      })
    }

    await runChapterReviewProQuickAction({
      text: 'Pro 质量复盘',
      bookId: 9,
      conversationId: 8,
      currentChapter: { id: 7, title: '第七章 宴会', content: '<p>林雪推门入场。</p>' },
      api
    })

    expect(api.aiAddMessage).toHaveBeenLastCalledWith(
      8,
      'assistant',
      expect.stringContaining('风险等级：未评分'),
      expect.any(Object)
    )
    const lastCall = api.aiAddMessage.mock.calls[api.aiAddMessage.mock.calls.length - 1]
    expect(lastCall?.[2]).not.toContain('风险等级：低')
  })

  it('falls back without calling Pro review when the chapter body is empty', async () => {
    const api = {
      aiAddMessage: vi.fn(),
      aiExecuteSkill: vi.fn()
    }

    const result = await runChapterReviewProQuickAction({
      text: 'Pro 质量复盘',
      bookId: 9,
      conversationId: 8,
      currentChapter: { id: 7, title: '第七章 宴会', content: '<p><br /></p>' },
      api
    })

    expect(result).toEqual({
      fallbackToLocalReview: true,
      fallbackReason: 'empty_chapter'
    })
    expect(api.aiExecuteSkill).not.toHaveBeenCalled()
    expect(api.aiAddMessage).not.toHaveBeenCalled()
  })
})

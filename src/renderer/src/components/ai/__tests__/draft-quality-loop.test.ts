import { describe, expect, it } from 'vitest'
import {
  buildDraftQualityCheckPrompt,
  buildDraftQualityCheckSendOptions,
  buildDraftQualityLoopModel
} from '../draft-quality-loop'

describe('draft quality loop', () => {
  it('marks deslop drafts as already checked for AI tone', () => {
    const model = buildDraftQualityLoopModel({
      id: 1,
      kind: 'replace_text',
      title: '去 AI 味替换草稿',
      payload: { content: '改写后文本', skill_id: 'layer2.deslop' },
      status: 'pending'
    })

    expect(model.steps).toContainEqual({ label: '已去 AI 味', status: 'done' })
    expect(model.canInspect).toBe(true)
  })

  it('does not offer quality inspection for empty editor HTML drafts', () => {
    const model = buildDraftQualityLoopModel({
      id: 4,
      kind: 'create_chapter',
      title: '空章节草稿',
      payload: { content: '<p><br /></p>' },
      status: 'pending'
    })

    expect(model.canInspect).toBe(false)
  })

  it('does not offer quality inspection for plain non-breaking-space entity drafts', () => {
    const model = buildDraftQualityLoopModel({
      id: 5,
      kind: 'create_chapter',
      title: '空章节草稿',
      payload: { content: '&nbsp;' },
      status: 'pending'
    })

    expect(model.canInspect).toBe(false)
  })

  it('builds a bounded inspection prompt from draft content', () => {
    const prompt = buildDraftQualityCheckPrompt({
      id: 2,
      kind: 'create_chapter',
      title: '第一章',
      payload: { content: '正文'.repeat(4000) },
      status: 'pending'
    })

    expect(prompt).toContain('草稿篮 #2')
    expect(prompt.length).toBeLessThan(5600)
    expect(prompt).toContain('已截断')
  })

  it('sends draft quality checks through direct writing without planning provenance', () => {
    expect(buildDraftQualityCheckSendOptions()).toEqual({
      assistantMode: 'direct_writing',
      sourcePlanMessageId: null
    })
  })
})

import { describe, expect, it } from 'vitest'
import { buildDraftPreviewModel } from '../draft-preview'

describe('buildDraftPreviewModel', () => {
  it('renders character drafts as structured readable fields instead of raw JSON', () => {
    const preview = buildDraftPreviewModel({
      id: 1,
      kind: 'create_character',
      title: '创建角色',
      payload: {
        kind: 'create_character',
        name: '苏离',
        faction: '夜巡司',
        status: 'active',
        description: '冷面刀修，擅长借势压人。',
        custom_fields: {
          动机: '查清师门灭门真相',
          秘密: '半妖血脉'
        }
      },
      status: 'pending'
    })

    expect(preview.title).toBe('苏离')
    expect(preview.summary).toBe('冷面刀修，擅长借势压人。')
    expect(preview.fields).toEqual([
      { label: '阵营', value: '夜巡司' },
      { label: '状态', value: 'active' },
      { label: '动机', value: '查清师门灭门真相' },
      { label: '秘密', value: '半妖血脉' }
    ])
  })

  it('renders plot node drafts as structured readable fields', () => {
    const preview = buildDraftPreviewModel({
      id: 2,
      kind: 'create_plot_node',
      title: '创建剧情节点',
      payload: {
        kind: 'create_plot_node',
        chapter_number: 18,
        title: '宴会反杀',
        score: 4,
        node_type: 'main',
        description: '主角借众人之口反压反派。'
      },
      status: 'pending'
    })

    expect(preview.title).toBe('宴会反杀')
    expect(preview.summary).toBe('主角借众人之口反压反派。')
    expect(preview.fields).toEqual([
      { label: '章节', value: '18' },
      { label: '情绪分', value: '4' },
      { label: '节点类型', value: 'main' }
    ])
  })
})

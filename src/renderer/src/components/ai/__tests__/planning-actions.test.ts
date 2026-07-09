import { describe, expect, it } from 'vitest'
import {
  DESKTOP_PLANNING_REPORT_VERSION,
  findLatestPlanningReportMessageId,
  shouldLinkPlanningDraftSource,
  withPlanningDraftSource
} from '../planning-actions'

describe('planning action helpers', () => {
  it('finds the latest assistant planning report message', () => {
    expect(
      findLatestPlanningReportMessageId([
        { id: 1, role: 'user', content: '规划', metadata: { planning_report_version: DESKTOP_PLANNING_REPORT_VERSION } },
        { id: 2, role: 'assistant', content: '旧规划', metadata: { planning_report_version: DESKTOP_PLANNING_REPORT_VERSION } },
        { id: 3, role: 'assistant', content: '普通回复', metadata: { skill_key: 'create_plot_node' } },
        { id: 4, role: 'assistant', content: '新规划', metadata: { planning_report_version: DESKTOP_PLANNING_REPORT_VERSION } }
      ])
    ).toBe(4)
  })

  it('adds optional planning provenance to draft payloads without changing unlinked drafts', () => {
    expect(withPlanningDraftSource({ kind: 'create_plot_node', title: '节点' }, 9)).toEqual({
      kind: 'create_plot_node',
      title: '节点',
      source_plan_message_id: 9
    })
    expect(withPlanningDraftSource({ kind: 'create_foreshadowing', text: '伏笔' }, null)).toEqual({
      kind: 'create_foreshadowing',
      text: '伏笔'
    })
  })

  it('links planning provenance only for planning draft-transfer actions', () => {
    expect(shouldLinkPlanningDraftSource({ key: 'create_plot_node', targetMode: 'direct_writing' })).toBe(true)
    expect(shouldLinkPlanningDraftSource({ key: 'create_foreshadowing', targetMode: 'direct_writing' })).toBe(true)
    expect(shouldLinkPlanningDraftSource({ key: 'remove_ai_tone', targetMode: 'direct_writing' })).toBe(false)
    expect(shouldLinkPlanningDraftSource({ key: 'pro_quality_review', targetMode: 'direct_writing' })).toBe(false)
    expect(shouldLinkPlanningDraftSource({ key: 'book_plan', targetMode: 'creation_planning' })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  PROFESSIONAL_TEMPLATES,
  PROFESSIONAL_TEMPLATE_IDS,
  applyProfessionalTemplate,
  getProfessionalTemplate,
} from '../professional-templates'

describe('professional templates (DI-05)', () => {
  it('exports the 12 mandated public document types', () => {
    expect(PROFESSIONAL_TEMPLATE_IDS).toHaveLength(12)
    expect(PROFESSIONAL_TEMPLATE_IDS).toEqual(
      expect.arrayContaining([
        'red-header-notice',
        'notice',
        'request',
        'report',
        'reply',
        'decision',
        'announcement',
        'notification',
        'letter',
        'opinion',
        'motion',
        'minutes',
      ]),
    )
  })

  it('every template carries a non-empty label, description, fields list, and wrap fn', () => {
    for (const id of PROFESSIONAL_TEMPLATE_IDS) {
      const t = PROFESSIONAL_TEMPLATES[id]
      expect(t.label, id).toBeTruthy()
      expect(t.description, id).toBeTruthy()
      expect(t.fields.length, id).toBeGreaterThan(0)
      expect(typeof t.wrap, id).toBe('function')
    }
  })

  it('wrap() preserves the author content verbatim', () => {
    const content = '一、按照上级文件精神，现就……\n二、各部门认真贯彻落实。'
    for (const id of PROFESSIONAL_TEMPLATE_IDS) {
      const wrapped = applyProfessionalTemplate(id, content, {
        issuer: '示例部门',
        docNumber: '示〔2026〕1 号',
        title: '关于示例事项的示例文',
        recipient: '各下属部门',
        signer: '示例部门',
        date: '2026 年 4 月 28 日',
        meetingTitle: '示例会议',
        attendees: '甲，乙',
      })
      expect(wrapped, id).toContain('一、按照上级文件精神，现就……')
      expect(wrapped, id).toContain('二、各部门认真贯彻落实。')
    }
  })

  it('red-header-notice wrap produces the canonical 红头 / 标题 / 主送 / 落款 frame', () => {
    const content = '请按以下要求做好相关工作。'
    const wrapped = applyProfessionalTemplate('red-header-notice', content, {
      issuer: '某市发改委',
      docNumber: '发改〔2026〕1 号',
      title: '关于做好 2026 年度示例工作的通知',
      recipient: '各区县发改委',
      signer: '某市发改委',
      date: '2026 年 4 月 28 日',
    })
    expect(wrapped).toContain('【红头】某市发改委文件')
    expect(wrapped).toContain('发改〔2026〕1 号')
    expect(wrapped).toContain('关于做好 2026 年度示例工作的通知')
    expect(wrapped).toContain('各区县发改委：')
    expect(wrapped).toContain('特此通知。')
    expect(wrapped).toContain('某市发改委')
    expect(wrapped).toContain('2026 年 4 月 28 日')
  })

  it('minutes wrap surfaces meetingTitle / attendees instead of issuer fields', () => {
    const wrapped = applyProfessionalTemplate('minutes', '会议讨论了 ×× 事项。', {
      meetingTitle: '某市发改委周例会',
      title: '某市发改委周例会纪要',
      date: '2026 年 4 月 28 日',
      attendees: '主任、副主任、各处长',
    })
    expect(wrapped).toContain('【纪要】某市发改委周例会纪要')
    expect(wrapped).toContain('某市发改委周例会纪要')
    expect(wrapped).toContain('时间：2026 年 4 月 28 日')
    expect(wrapped).toContain('出席：主任、副主任、各处长')
  })

  it('getProfessionalTemplate returns undefined for unknown id', () => {
    expect(getProfessionalTemplate('not-a-real-template')).toBeUndefined()
  })

  it('applyProfessionalTemplate throws for unknown id', () => {
    expect(() => applyProfessionalTemplate('not-a-real-template', 'x')).toThrow('unknown professional template')
  })
})

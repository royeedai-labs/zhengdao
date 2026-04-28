import { Extension } from '@tiptap/core'

/**
 * DI-03 — 剧本编辑器扩展 (script genre)
 *
 * 不新增 node 类型, 而是给现有 paragraph 加一个全局 attr `scriptKind`,
 * 取值 'slugline' | 'character' | 'dialogue' | 'parenthetical' | 'transition'。
 *
 * 这样:
 * - 不破坏 StarterKit 的 Paragraph node 行为, 普通段落与剧本段落共用同一
 *   存储格式 (HTML <p>), 历史回退 / undo / 字数统计与现有逻辑无差。
 * - 视觉差异通过 CSS class `script-<kind>` 在 globals 注入 (大写、缩进、
 *   居中等 Fountain 排版规则)。
 * - AI Skill (e.g. layer2.dialogue-block-rewrite) 读到 `<p data-script-kind="dialogue">`
 *   后, 可以更准确地把内容拆成结构化对白。
 *
 * 切换段落类型由 ScriptToolbar 调
 *   editor.chain().focus().updateAttributes('paragraph', { scriptKind }).run()
 * 切回普通段落传 scriptKind: null。
 */

export type ScriptParagraphKind =
  | 'slugline'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'

export const SCRIPT_PARAGRAPH_KINDS: ScriptParagraphKind[] = [
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition'
]

export const SCRIPT_PARAGRAPH_LABELS: Record<ScriptParagraphKind, string> = {
  slugline: '场景头',
  character: '角色名',
  parenthetical: '括号注',
  dialogue: '台词',
  transition: '转场'
}

export const SCRIPT_PARAGRAPH_DESCRIPTIONS: Record<ScriptParagraphKind, string> = {
  slugline: 'INT. 客厅 - 夜 — 全大写, 描述场景空间与时间',
  character: 'ANGELA — 全大写、居中, 标记发言角色',
  parenthetical: '(冷笑) — 居中、斜体小字, 描述动作 / 表情提示',
  dialogue: '台词正文 — 居中略缩进的对白文本',
  transition: 'CUT TO: — 全大写、居右, 标记转场指令'
}

export const ScriptKindAttr = Extension.create({
  name: 'scriptKindAttr',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          scriptKind: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute('data-script-kind'),
            renderHTML: (attributes: Record<string, unknown>) => {
              const kind = attributes.scriptKind
              if (!kind || typeof kind !== 'string') return {}
              return {
                'data-script-kind': kind,
                class: `script-${kind}`
              }
            }
          }
        }
      }
    ]
  }
})

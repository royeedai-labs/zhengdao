# 变更记录：结构化草稿可读预览与 AI 面板拖拽缩放

- **基线 ID**：CR-20260422-004500-structured-draft-preview-and-panel-layout
- **时间**：2026-04-22 00:45
- **类型**：change / bugfix
- **影响级别**：P1

## 变更原因

用户反馈：

1. AI 创建角色等结构化结果经常因为模型返回了说明文字或 fenced JSON，直接报“AI 返回内容不是可解析的 JSON 草稿”。
2. 即使成功生成草稿，角色/设定/剧情节点/伏笔仍以原始字符串方式展示，不够可读。
3. AI 助手面板不能拖动、不能拉伸，续写和资产整理时操作空间不足。

## 本次变更内容

1. 放宽结构化草稿解析：
   - 支持纯 JSON
   - 支持 fenced JSON
   - 支持带说明文字的嵌入式 JSON
2. 把 `create_character`、`create_wiki_entry`、`create_plot_node`、`create_foreshadowing` 等草稿改为结构化卡片预览，不再按原始 JSON / 原始字符串直出。
3. AI 助手面板支持：
   - 拖动位置
   - 拖拽调整大小
   - 本地持久化位置与尺寸
   - 视口边界约束

## 影响分析

| 维度 | 是否受影响 | 说明 |
|------|------------|------|
| MISSION | 否 | 仍属于 AI 助手交互完善，不改高层目标 |
| baseline-log | 是 | 需要新增本次用户补充约束记录 |
| spec | 是 | 需补充结构化草稿展示与面板交互约束 |
| tasks | 是 | 需新增实现与验证任务 |
| tests | 是 | 新增解析、草稿预览、面板布局测试 |
| acceptance | 是 | 需新增结构化可读展示和拖拽缩放验收口径 |
| release | 否 | 不涉及发布流程变化 |
| memory | 否 | 本次主要是当前 lane 内交互细化，无需提升为项目级稳定记忆 |
| evals | 否 | 暂无新增长期 eval 资产需求 |

## 风险

- 结构化输出依然受模型质量影响；当前修复是“宽松解析 + 可读展示”，不是放弃白名单校验。
- 面板拖拽/缩放需要继续人工确认不同窗口尺寸下与工作区右侧元素的视觉关系。

## 验证

- `npx vitest run src/renderer/src/utils/ai/__tests__/assistant-workflow.test.ts src/renderer/src/components/ai/__tests__/draft-preview.test.ts src/renderer/src/components/ai/__tests__/panel-layout.test.ts`
- `npm test`
- `npm run build`


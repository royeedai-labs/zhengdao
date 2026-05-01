# Zhengdao Desktop UX Overhaul 2026Q2 Mission

## Goal

把 Zhengdao 桌面端从“功能很多但显得乱”推进到专业写作工作台体验：信息架构清楚、写作主路径不被干扰、AI 能力可发现且可控、每个页面和弹窗都有明确任务、状态和验收证据。

本 lane 先建立不可遗漏的 UX surface ledger，再按 ledger 分批审计、设计、实现和截图验收。Web / 官网不纳入主线，只在桌面端下载、账号或更新闭环被影响时做最小配套。

## Success Criteria

- `surface-ledger.md` 从真实源码生成，覆盖书架、工作区、编辑器、AI Dock、命令面板、搜索、设置、底部沙盘、右侧面板和全部 `ModalType` 弹窗。
- 每个 surface 都有入口、用户任务、状态、当前 UX 风险、参考模式、实现状态和截图证据字段。
- 所有 P0 surface 完成页面级 UX 方案并进入分批实现；每批实现都保留 before/after 截图。
- 验收时每个已关闭 surface 至少覆盖空数据、有数据、loading/error、键盘、文本溢出、危险操作确认。
- AI 写入正文、章节、人物、设定、剧情或伏笔前，继续强制预览和用户确认。
- 自动验证至少包括 `npm test`、`npm run typecheck`、`npm run build`；`npm run lint` 若被历史问题阻断，记录基线并确认本轮触达文件不新增 lint 问题。

## Scope

In scope:

- 桌面端 UX 治理工件、surface ledger、竞品模式映射、页面级问题清单和验收矩阵。
- Zhengdao renderer 的书架、工作区、编辑器、AI、命令面板、搜索、设置、资料/设定/剧情/角色相关页面和所有弹窗。
- 内部 UI 约定可新增：Dialog shell、toolbar action、command metadata、surface inventory metadata。

Out of scope:

- 数据库 schema、IPC、AI provider 路由、同步语义和桌面打包发布链路，除非后续单独确认。
- royeedai-website / Web app 全量 UX 重构。
- 纯营销化视觉改版、装饰型 landing page、与写作任务无关的大面积视觉资产。

## Baseline

- Baseline ID: `CR-20260501-desktop-ux-overhaul`
- Date: 2026-05-01
- Mode: brownfield change
- Quality tier: high
- Risk tier: medium
- User-confirmed defaults:
  - 桌面端优先
  - 审计 + 设计 + 实施完整链路
  - 专业产品感优先
  - Web 只做最小配套

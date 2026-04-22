# 作品入口风险登记

| 风险 ID | 描述 | 影响范围 | 触发条件 | 规避措施 | 监测入口 | 审批结论 |
|---|---|---|---|---|---|---|
| R-ENTRY-001 | 只改书架点击而不改工作区入口判定，进入后仍自动弹总览 | 书架、工作区入口、总览 modal | 入口判定逻辑回退 | 使用 `workspace-entry` helper 测试锁定 | `workspace-entry.test.ts` | accepted |
| R-ENTRY-002 | 显式总览入口被误删或不可用 | TopBar、WorkspaceLayout | 清理自动总览时误删显式入口 | 保留 TopBar / layout 显式入口代码并在 review 核对 | `DESIGN.md`、code review | accepted |
| R-ENTRY-003 | 首次 onboarding 优先级被破坏 | onboarding、工作区入口 | 入口逻辑未区分首次引导 | 测试覆盖 onboarding 优先级 | `workspace-entry.test.ts` | accepted |

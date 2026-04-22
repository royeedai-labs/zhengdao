# 作品入口与总览触发收口 Spec

## 1. 模块概述

- **模块目标**：把“打开作品”的主路径从统计模态拦截中释放出来，恢复为直接进入工作区
- **所属阶段**：build / verify
- **关联 Mission**：`MISSION.md` 当前基线 `CR-20260422-000838-bookshelf-entry-behavior`
- **关联需求点 ID / 标题**：
  - `REQ-ENTRY-001` 点击作品主体直接进入作品工作区
  - `REQ-ENTRY-002` 书籍总览仅通过显式入口触发
  - `REQ-ENTRY-003` 首次创建作品后的 onboarding 仍保持优先

## 2. 业务规则与目标

- **核心规则**：
  - 用户从书架点击作品卡片主体或列表项主体时，进入作品工作区
  - 工作区首次渲染时，不再因为 session 首次进入而自动打开“书籍总览”
  - “书籍总览”继续保留在显式入口上触发
  - 首次创建作品后的 onboarding 逻辑保持优先，不因取消自动总览而失效
- **必须优先保证的正确性**：主路径不被弹窗打断、显式总览入口可用、首次 onboarding 不回退
- **本轮非目标 / 禁止越界项**：不重做作品首页、不调整总览视觉和字段、不新增入口分流

## 3. 界面 / 接口 / 命令清单

| 编号 | 类型 | 名称 | 描述 | 验收点 |
|------|------|------|------|--------|
| I-ENTRY-001 | 书架入口 | book card / list item | 点击主体打开作品工作区 | AC-ENTRY-001 |
| I-ENTRY-002 | 工作区入口判定 | `decideWorkspaceEntry` | 仅负责 onboarding 判定，不再触发自动总览 | AC-ENTRY-001 / AC-ENTRY-003 |
| I-ENTRY-003 | 显式总览入口 | top bar overview button | 用户主动触发时仍打开“书籍总览” | AC-ENTRY-002 |

## 4. 关键流程与状态流转

1. 用户在书架点击作品主体
2. `openBook(book.id)` 打开目标作品
3. 工作区初始化时先判断 onboarding
4. 若是首次新建作品且存在 pending onboarding，则先触发 onboarding
5. 否则直接进入工作区，不自动打开“书籍总览”
6. 用户需要统计总览时，通过显式入口主动打开

## 5. 数据与契约

- **契约基准**：
  - `showOnboarding`: 仅在首次创建作品后的 pending onboarding 条件满足时为 `true`
- **输入**：
  - `onboardingDone`
  - `pendingOnboarding`
- **输出**：
  - 工作区入口决策对象
- **集成触点**：
  - `src/renderer/src/utils/workspace-entry.ts`
  - `src/renderer/src/utils/__tests__/workspace-entry.test.ts`
  - `src/renderer/src/components/layout/WorkspaceLayout.tsx`
- **Schema / 存储一致性说明**：不新增数据库 schema；仅保留既有 sessionStorage onboarding 标记

## 6. 边界条件与异常处理

- 首次创建作品：应继续优先弹 onboarding，且不能自动叠加总览
- 已完成 onboarding 的作品：进入后直接落到工作区
- 旧 session 中残留 overview session key：不应再影响工作区进入行为

## 7. 验收与证据

- **关键用户任务验证**：
  - 从书架打开已有作品时，不会自动看到“书籍总览”
  - 顶栏“总览”按钮仍能主动打开“书籍总览”
  - 首次创建作品后的 onboarding 规则仍成立
- **逻辑正确性证据**：`workspace-entry` 行为测试
- **工程质量证据**：`npm test -- src/renderer/src/utils/__tests__/workspace-entry.test.ts`、`npm run build`

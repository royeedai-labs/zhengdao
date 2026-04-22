# 作品入口与总览触发收口 Design

> 当前 lane 的交付基线为 `CR-20260422-000838-bookshelf-entry-behavior`。

## 1. 设计目标

- **本轮设计目标**：作品主体点击应直接进入作品工作区，不被总览弹窗自动拦截；总览保留为显式触发入口。
- **需要先锁定的关键页面 / 交互**：书架作品卡片、工作区入口判定、显式总览入口、首次创建作品 onboarding。
- **必须用户确认的核心设计决策**：进入作品主路径不自动弹总览；onboarding 优先级保留；不重做作品首页信息架构。
- **确认状态**：confirmed。

## 2. 信息架构

- **入口与导航骨架**：书架页点击作品进入工作区；工作区顶栏保留显式总览入口。
- **一级 / 二级结构**：作品卡片、工作区、总览 modal、onboarding。
- **关键信息优先级**：进入作品主路径 > onboarding 首次引导 > 显式总览入口。

## 3. 关键页面与交互

| 页面 / 入口 | 目标 | 关键元素 | 关键操作 | 是否核心决策 | 确认状态 |
|---|---|---|---|---|---|
| 书架作品卡片 | 直接进入作品工作区 | 作品主体点击 | 打开作品 | yes | confirmed |
| 工作区入口判定 | 不自动弹总览 | `workspace-entry` helper | 判断进入后 UI 状态 | yes | confirmed |
| 显式总览入口 | 保留总览能力 | TopBar / 总览按钮 | 用户主动打开 | yes | confirmed |
| Onboarding | 首次引导仍优先 | onboarding state | 首次进入引导 | yes | confirmed |

## 4. 关键流程

1. 用户在书架点击已有作品主体区域。
2. 应用进入工作区，不自动打开总览 modal。
3. 用户如需总览，通过显式入口打开。
4. 首次创建 / 首次引导场景仍遵守 onboarding 优先级。

## 5. 共享基础设施审计

- **受影响的共享组件**：书架页、工作区布局、TopBar、workspace entry helper。
- **受影响的接口 / 页面清单**：`BookshelfPage`、`WorkspaceLayout`、`TopBar`、`workspace-entry`。
- **同仓正常实现对照**：现有 TopBar 显式操作入口和 workspace entry test。
- **副作用清单**：若只改书架点击而不改工作区入口判定，自动总览可能继续出现。

## 6. 风险与验证

- **风险点**：显式总览入口回归、onboarding 优先级被误伤、只改局部点击导致根因未修。
- **风险工件**：`risk-register.md`。
- **验证 guard**：`verification-matrix.yaml` 与 `evals/bookshelf-entry-no-auto-overview.md`。

## 7. 验收标准（从 legacy acceptance.yaml 迁入）

```yaml
version: 1
baseline_id: "CR-20260422-000838-bookshelf-entry-behavior"
scope:
  mode: "change"
  focus: "bookshelf-entry"
  baseline_source: "MISSION.md + specs/bookshelf-entry-behavior.spec.md"
  quality_tier: "standard"

gates:
  - id: design-confirmation
    title: "设计确认门"
    status: completed
    checks:
      - "用户已确认作品主体点击应进入作品，不应被总览弹窗拦截"
      - "总览保留为显式触发，而非进入作品的自动步骤"
    evidence:
      - "CR-20260422-000838-bookshelf-entry-behavior"
      - "MISSION.md"
      - "specs/bookshelf-entry-behavior.spec.md"

  - id: logic-confirmation
    title: "逻辑确认门"
    status: completed
    checks:
      - "根因已定位为工作区入口判定中的自动总览逻辑，而非书架卡片点击行为"
      - "onboarding 优先级需要保留"
    evidence:
      - "src/renderer/src/components/layout/WorkspaceLayout.tsx"
      - "src/renderer/src/utils/workspace-entry.ts"

  - id: implementation-quality
    title: "实现质量门"
    status: completed
    checks:
      - "工作区入口行为有自动化测试覆盖"
      - "进入作品不再自动弹出总览"
      - "项目原生静态校验已完成"
    evidence:
      - "npm test -- src/renderer/src/utils/__tests__/workspace-entry.test.ts"
      - "npm run build"
      - "src/renderer/src/utils/workspace-entry.ts"
      - "src/renderer/src/utils/__tests__/workspace-entry.test.ts"

  - id: delivery-readiness
    title: "交付质量门"
    status: completed
    checks:
      - "已有作品进入工作区的主路径不再被模态打断"
      - "显式总览入口仍可用"
      - "首次创建作品的 onboarding 规则未回退"
    evidence:
      - "npm test -- src/renderer/src/utils/__tests__/workspace-entry.test.ts"
      - "npm run build"
      - "src/renderer/src/components/layout/TopBar.tsx"
      - "src/renderer/src/components/layout/WorkspaceLayout.tsx"

result:
  design_locked: passed
  logic_locked: passed
  implementation_ready: passed
  delivery_ready: passed
  blockers: []
  advisories:
    - "本轮不重做作品首页与总览信息架构，只收口触发规则"
    - "本次未单独跑 GUI 手工 smoke，交付证据来自入口行为测试、构建通过和显式总览入口代码仍在"
```

## 8. 设计确认记录

- 2026-04-22：用户确认作品入口行为收口。
- 2026-04-22：AI-OS v9 升级将本 lane 验收从 `acceptance.yaml` 迁入 `DESIGN.md`，不改变已确认功能范围。

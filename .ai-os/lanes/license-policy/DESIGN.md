# 开源许可证收紧与授权口径统一 Design

> 当前 lane 的交付基线为 `CR-20260421-225658-oss-license-tightening`。

## 1. 设计目标

- **本轮设计目标**：将仓库顶层授权口径统一为 `AGPL-3.0-only`，并确保 README、npm 元数据与 LICENSE 文本一致。
- **需要先锁定的关键文件 / 契约**：`LICENSE`、`README.md`、`package.json`、`package-lock.json`、release / 对外说明。
- **必须用户确认的核心决策**：选择 `AGPL-3.0-only`；不选择 `AGPL-3.0-or-later`；不做双许可；不批量改源码文件头；不改第三方依赖许可证。
- **确认状态**：confirmed。

## 2. 核心流程

1. 用户确认采用最严格的开源协议方向。
2. lane 工件锁定 `AGPL-3.0-only` 作为本项目当前顶层授权。
3. 顶层许可证文本、README 和 npm 元数据统一。
4. 通过文件扫描和项目原生构建验证。

## 3. 共享基础设施审计

- **受影响的共享组件**：仓库顶层授权文本、README、package metadata、发布说明。
- **受影响的接口 / 页面清单**：GitHub repo 首页、npm 包元数据、GitHub Release 文案。
- **同仓正常实现对照**：`package.json` 与 `package-lock.json` 根包 license 字段一致。
- **副作用清单**：授权口径属于法律 / 分发风险，不能把 AGPL 错描述为 MIT、source-available 或禁止商用。

## 4. 风险与验证

- **高风险点**：授权口径错误、历史版本授权事实误写、第三方依赖许可证误改、release 文案缺必要信息。
- **风险工件**：`risk-register.md`。
- **发布工件**：`release-plan.md`。
- **验证 guard**：`verification-matrix.yaml` 与 `evals/license-metadata-drift.md`。

## 5. 验收标准（从 legacy acceptance.yaml 迁入）

```yaml
version: 1
baseline_id: "CR-20260421-225658-oss-license-tightening"
scope:
  mode: "change"
  focus: "repo-license-policy"
  baseline_source: "MISSION.md + specs/license-policy.spec.md"
  change_control: "all license policy changes must go through /change-request"
  quality_tier: "high-risk"
  primary_spec: "specs/license-policy.spec.md"
  confirmed_stack_decisions: "top-level repo metadata only; SPDX license identifier; no third-party dependency license rewrite"
  target_runtime: "repository metadata and distribution notice"
  dev_fallback: "file diff + ripgrep + npm build"

gates:
  - id: design-confirmation
    title: "设计确认门"
    status: completed
    checks:
      - "已确认本轮目标是强 copyleft 开源许可，而不是非开源 source-available 许可"
      - "已确认选择 `AGPL-3.0-only`，不是 `AGPL-3.0-or-later` 或双许可"
    evidence:
      - "baseline-log/CR-20260421-225658-oss-license-tightening.md"
      - "MISSION.md"
      - "user confirmation 2026-04-21"

  - id: logic-confirmation
    title: "逻辑确认门"
    status: completed
    checks:
      - "已确认只更新顶层许可证与元数据，不批量改源码文件头"
      - "已确认不触碰第三方依赖许可证条目"
      - "已确认历史版本既有授权事实不在本轮重写"
    evidence:
      - "specs/license-policy.spec.md"
      - "MISSION.md"

  - id: implementation-quality
    title: "实现质量门"
    status: completed
    checks:
      - "LICENSE 已替换为 GNU AGPL v3 正式文本"
      - "README / package.json / package-lock.json 根包字段已统一"
      - "未覆盖工作区无关变更"
      - "项目原生静态校验已完成"
    evidence:
      - "LICENSE"
      - "README.md"
      - "package.json"
      - "package-lock.json"
      - "rg target-file scan"
      - "npm run build"

  - id: delivery-readiness
    title: "交付质量门"
    status: completed
    checks:
      - "仓库首页不再把项目描述为 MIT"
      - "对外说明未把 AGPL 描述成非开源或禁止商用"
      - "交付说明明确区分代码状态与法律口径变更"
    evidence:
      - "ship summary"
      - "verification log"
      - "README.md"

result:
  design_locked: passed
  logic_locked: passed
  implementation_ready: passed
  delivery_ready: passed
  blockers: []
  advisories:
    - "历史已发布版本的既有授权事实不会因本次文件修改自动重写"
```

## 6. 设计确认记录

- 2026-04-21：用户确认采用 `AGPL-3.0-only`。
- 2026-04-22：AI-OS v9 升级将本 lane 验收从 `acceptance.yaml` 迁入 `DESIGN.md`，不改变授权决策。

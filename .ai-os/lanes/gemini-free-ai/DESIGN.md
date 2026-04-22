# Gemini 免费使用双通道 Design

> 当前 lane 的交付基线为 `CR-20260421-212847-gemini-free-ai`。

## 1. 设计目标

- **本轮设计目标**：同时支持 Gemini API Key 免费层与 Gemini CLI Google 登录通道，让用户可在不购买额外 OpenAI API 的情况下使用证道 AI 能力。
- **需要先锁定的关键接口 / 交互**：provider routing、Gemini REST adapter、Gemini CLI 主进程服务、IPC / preload 契约、项目设置中的 provider 状态提示。
- **必须用户确认的核心设计决策**：Gemini CLI 登录采用终端式登录；不复刻 Google 私有认证；不复用 Google Drive OAuth token；CLI cwd 限定在 app-owned 目录。
- **确认状态**：confirmed。

## 2. 信息架构

- **入口与导航骨架**：项目设置 / AI 设置中暴露 Gemini API Key 与 Gemini CLI 状态入口。
- **关键信息优先级**：provider 可用状态 > 登录 / quota 错误解释 > 安全边界 > 打包可用性。

## 3. 核心接口与数据模型

| 接口 / 模型 | 用途 | 关键字段 | 状态流转 | 是否核心决策 | 确认状态 |
|---|---|---|---|---|---|
| provider routing | 在 OpenAI / Ollama / Gemini API / Gemini CLI 间选择调用路径 | provider、model、apiKey、cliStatus | configured / unavailable / error | yes | confirmed |
| Gemini CLI IPC | renderer 查询状态、启动登录、发起生成 | command、cwd、settings、stream chunks | not-installed / needs-login / ready / failed | yes | confirmed |
| Gemini REST adapter | API Key 免费层调用 | apiKey、model、prompt、stream | request / response / error | yes | confirmed |

## 4. 关键流程

1. 用户在 AI 配置中选择 Gemini API Key 或 Gemini CLI。
2. API Key 路径走 renderer provider routing 与 Gemini adapter。
3. CLI 路径通过 preload IPC 进入主进程 Gemini CLI service。
4. 主进程在受控 cwd 与最小 settings 下启动 CLI，映射登录、quota、路径和空响应错误。
5. 打包时 Gemini CLI bundle 通过 `asarUnpack` 保持可执行路径。

## 5. 共享基础设施审计

- **受影响的共享组件**：AI provider routing、main IPC handlers、preload bridge、electron-builder asar unpack、release native module rebuild。
- **受影响的接口 / 页面清单**：AI 设置 / 项目设置 provider 配置、AI assistant 发起生成、Gemini CLI 登录状态检测。
- **同仓正常实现对照**：OpenAI / Ollama provider 路由与既有 IPC handler 模式。
- **副作用清单**：新增 `@google/gemini-cli` 包体积、`node-pty` native rebuild 风险、CLI 本地工具能力边界。

## 6. 风险与验证

- **高风险点**：CLI 本地工具能力、Google 登录与 quota 外部依赖、打包后路径差异、`node-pty` native rebuild。
- **风险工件**：`risk-register.md`。
- **发布工件**：`release-plan.md`。
- **验证 guard**：`verification-matrix.yaml` 与 `evals/gemini-cli-packaged-smoke.md`。

## 7. 验收标准（从 legacy acceptance.yaml 迁入）

```yaml
version: 1
baseline_id: "CR-20260421-212847-gemini-free-ai"
scope:
  mode: "change"
  focus: "gemini-free-ai"
  quality_tier: "high-risk"
  primary_spec: "specs/gemini-free-ai.spec.md"
required_special_reviews:
  - security-guard
  - fullstack-dev-checklist

gates:
  - id: design-confirmation
    title: "设计确认门"
    status: completed
    checks:
      - "用户已确认同时支持 Gemini API Key 免费层与 Gemini CLI Google 登录路线"
      - "配置入口沿用项目设置，不新增全局设置"
      - "Gemini CLI 登录采用终端式登录，不复刻私有认证"
    evidence:
      - "用户请求 IMPLEMENT THIS PLAN"
      - "baseline-log/CR-20260421-212847-gemini-free-ai.md"

  - id: logic-confirmation
    title: "逻辑确认门"
    status: completed
    checks:
      - "provider routing、IPC 契约和 CLI 隔离 cwd 已写入 spec"
      - "API Key 免费层与 CLI 登录权益边界已写入 spec"
      - "不复用 Google Drive OAuth token 已写入 Mission"
    evidence:
      - "MISSION.md"
      - "specs/gemini-free-ai.spec.md"

  - id: implementation-quality
    title: "实现质量门"
    status: completed
    checks:
      - "provider routing 单元测试通过"
      - "Gemini CLI service 单元测试通过"
      - "项目原生静态校验通过"
      - "安全审计完成"
    evidence:
      - "npx vitest run src/renderer/src/utils/ai/__tests__/provider-routing.test.ts src/main/ai/__tests__/gemini-cli-service.test.ts -> 2 files / 7 tests passed"
      - "npm test -> 16 files / 52 tests passed"
      - "npm run build -> electron-vite build passed"
      - "security-review.md"

  - id: delivery-readiness
    title: "交付质量门"
    status: in_progress
    checks:
      - "Gemini API Key 模式可驱动写作 AI"
      - "Gemini CLI 未登录 / 登录后路径有明确状态"
      - "打包配置包含 bundled CLI"
      - "Windows / macOS packaged smoke 结果已记录或明确 blocker"
    evidence:
      - "npx electron-builder --config electron-builder.config.ts --mac dir --publish never -> passed"
      - "dist/mac-arm64/证道.app/Contents/Resources/app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js exists"
      - "ELECTRON_RUN_AS_NODE=1 packaged app gemini.js --version -> 0.38.2"
      - "Windows x64 NSIS cross smoke blocked: node-gyp does not support cross-compiling node-pty from source"

result:
  design_locked: passed
  logic_locked: passed
  implementation_ready: passed
  delivery_ready: partial
  blockers:
    - "Windows x64 NSIS smoke cannot be completed from current macOS environment because node-pty native module cannot be cross-compiled by node-gyp"
  advisories:
    - "Gemini CLI 依赖会增加安装包体积"
    - "Gemini API Key 免费层不等于网页版会员无限 API"
```

## 8. 设计确认记录

- 2026-04-21：用户确认 Gemini API Key 免费层与 Gemini CLI 登录双通道方向。
- 2026-04-22：AI-OS v9 升级将本 lane 验收从 `acceptance.yaml` 迁入 `DESIGN.md`，不改变已确认功能范围。

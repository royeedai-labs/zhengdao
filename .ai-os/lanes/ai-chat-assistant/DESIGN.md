# AI 创作助手与写作能力配置 Design

> 当前 lane 的交付基线为 `CR-20260422-084513-gemini-3-pro-streaming-experience`，历史 CR 记录保留在 `baseline-log/`。

## 1. 设计目标

- **本轮设计目标**：提供右下角 AI 创作助手、普通会话、能力卡、草稿篮、会话管理和 Gemini CLI / Gemini 3 Pro 流式体验。
- **需要先锁定的关键页面 / 交互 / 接口**：AI Assistant Dock、右侧会话列表、草稿预览、全局账号配置、作品 AI 能力配置、main/preload IPC、AI repository。
- **必须用户确认的核心设计决策**：全局账号与作品能力分层；旧 BottomPanel AI 入口下线；草稿确认前不写入正文或资产；普通会话不默认触发续写正文。
- **确认状态**：confirmed。

## 2. 信息架构

- **入口与导航骨架**：右下角 AI Dock 作为主入口；会话列表在侧栏；能力卡 / 普通对话在输入区；草稿篮作为确认层。
- **一级 / 二级结构**：全局账号配置、作品能力配置、会话列表、消息流、草稿预览、草稿应用确认。
- **关键信息优先级**：当前 provider 状态 > 用户输入 > 流式反馈 > 草稿确认 > 会话历史。

## 3. 关键页面与交互

| 页面 / 入口 | 目标 | 关键元素 | 关键操作 | 是否核心决策 | 确认状态 |
|---|---|---|---|---|---|
| AI Assistant Dock | 提供创作助手主入口 | 消息流、输入区、能力卡、等待态 | 普通对话、选择能力、发送、停止 / 完成 | yes | confirmed |
| 会话侧栏 | 管理历史会话 | 会话标题、消息数、选中态、删除 | 新建、切换、删除 | yes | confirmed |
| 草稿预览 | 让 AI 生成内容先进入确认层 | 可读草稿摘要、应用按钮 | 确认应用或丢弃 | yes | confirmed |
| 全局账号配置 | 管理 provider 与 Gemini CLI 状态 | provider、API Key、CLI 检测 / 登录 | 检测、启动登录、选择默认 | yes | confirmed |
| 作品能力配置 | 管理作品级写作能力 | skill、提示词、上下文范围 | 保存作品级能力配置 | yes | confirmed |

## 4. 核心接口与数据模型

| 接口 / 模型 | 用途 | 关键字段 | 状态流转 | 是否核心决策 | 确认状态 |
|---|---|---|---|---|---|
| AI conversation repository | 保存会话与消息 | conversationId、messages、draft kind | active / archived / deleted | yes | confirmed |
| AI draft parser | 解析模型结构化草稿 | kind、payload、raw fallback | parsed / dirty-json / unavailable | yes | confirmed |
| Gemini CLI stream bridge | 从 main 到 renderer 转发真实 delta | chunk、done、error、cleanup | waiting / streaming / completed / failed | yes | confirmed |
| account provider store | 全局 provider 状态 | provider、model、status | unconfigured / checking / ready / error | yes | confirmed |

## 5. 关键流程

1. 用户打开 AI Dock，选择普通对话或显式能力卡。
2. renderer 组合上下文并经 provider routing 调用 API Key 或 Gemini CLI 路径。
3. Gemini CLI 路径在主进程解析 stream-json，renderer 只按真实 delta chunk 队列渲染，不拆字伪造 token。
4. 若返回结构化草稿，先展示可读草稿摘要；用户确认后才写入正文或资产。
5. 会话可新建、切换、清空和删除；删除历史会话必须二次确认。

## 6. 共享基础设施审计

- **受影响的共享组件**：SQLite migrations / repositories、main IPC handlers、preload bridge、AI provider routing、renderer AI components、release native rebuild。
- **受影响的接口 / 页面清单**：AI Dock、AI settings、Project settings、BottomPanel legacy AI 入口、release workflow。
- **同仓正常实现对照**：现有 modal / confirm / repository / IPC handler 模式。
- **副作用清单**：本地数据删除、Gemini CLI 空流、上游模型延迟、native module rebuild。

## 7. 风险与验证

- **高风险点**：会话删除、本地数据写入、AI 草稿误应用、Gemini CLI stream-json 格式变化、release native rebuild。
- **风险工件**：`risk-register.md`。
- **发布工件**：`release-plan.md`。
- **验证 guard**：`verification-matrix.yaml` 与 `evals/gemini-cli-stream-empty-response.md`。

## 8. 验收标准（从 legacy acceptance.yaml 迁入）

```yaml
baseline_id: "CR-20260422-084513-gemini-3-pro-streaming-experience"
gates:
  design_confirmation:
    status: passed
    evidence:
      - "用户确认右下角 AI 助手、草稿篮确认、智能最小上下文、全局账号和作品能力配置方向"
      - "用户确认旧 BottomPanel AI 入口不再需要，Gemini CLI 登录应迁入全局账号配置"
  logic_confirmation:
    status: passed
    evidence:
      - "specs/ai-chat-assistant.spec.md"
      - "ai_drafts.kind 白名单已落库并在 renderer 解析处校验"
      - "普通会话默认不强绑能力卡，显式能力卡仍按原 skill 执行"
      - "会话切换已迁移到右侧列表；删除历史会话动作需二次确认"
  implementation_quality:
    status: passed
    evidence:
      - "provider-routing / gemini-cli-service / streaming-message / assistant workflow focused tests passed"
      - "npm test 多次全量通过，最近记录 27 files / 105 tests、27 files / 104 tests、27 files / 102 tests、27 files / 98 tests、26 files / 95 tests"
      - "npm run build passed"
      - "git diff --check passed"
      - "node scripts/release/rebuild-electron-native.mjs -> Rebuild Complete for Electron 33.4.11 arm64"
  delivery_quality:
    status: passed
    evidence:
      - "release-plan.md"
      - "node scripts/release/verify-electron-native.mjs -> better-sqlite3 Electron ABI smoke passed"
      - "待人工验证：真实 Gemini CLI 对话、AI 面板拖动缩放、会话切换/删除"
risks:
  - "Gemini 3 Pro 首 token 延迟由上游 Gemini CLI / 模型决定；应用侧只能提供等待态和真实 delta 队列渲染。"
  - "Gemini CLI stream-json 的输出结构可能随上游 CLI 版本变化。"
  - "真实 provider 输出结构化 JSON 的稳定性仍依赖模型。"
  - "旧 project_config AI 字段仍保留为兼容 fallback；彻底移除需单独迁移。"
```

## 9. 设计确认记录

- 2026-04-21 至 2026-04-22：用户连续确认 AI 创作助手、Gemini CLI、会话、草稿预览、普通对话、侧栏会话和 Gemini 3 Pro 流式体验。
- 2026-04-22：AI-OS v9 升级将本 lane 验收从 `acceptance.yaml` 迁入 `DESIGN.md`，不改变已确认功能范围。

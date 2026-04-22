# 证道 Gemini 免费使用双通道 Mission

## 1. 交付基线摘要

- **宿主项目 / 系统**：证道 Electron 桌面端创作软件
- **当前交付主题**：Gemini 免费使用双通道整合
- **当前交付目标**：让项目设置中的 AI 配置同时支持 Gemini API Key 免费层与 Gemini CLI Google 登录路线，并让现有写作 AI 功能真正按所选 provider 调用。
- **项目模式**：change
- **当前治理档位**：P1
- **当前交付档位**：high-risk
- **当前基线 ID**：CR-20260421-212847-gemini-free-ai

## 2. 用户与闭环场景

- 普通用户在「项目设置 -> AI 配置」选择 Gemini API Key 免费层，填写 AI Studio API Key 后，可以使用章节摘要、风格分析、一致性检查、剧情补全和行内补全。
- 高级用户选择 Gemini CLI（Google 登录），按终端式流程完成 Gemini CLI 登录后，可以用 Google 账号 / AI Pro / Ultra 权益调用写作 AI 功能。
- 用户能明确看到 API Key 免费层与网页版会员 / CLI Google 登录不是同一套额度体系，避免误解为 API Key 可无限免费。

## 3. 已确认约束与关键决策

- 配置入口沿用项目设置，不新增全局 AI 设置。
- `project_config.ai_provider` 继续使用 TEXT 存储，无需数据库迁移；默认 provider 仍为 `openai`。
- 不复用现有 Google Drive OAuth token；Gemini CLI 的登录凭据由 Gemini CLI 自己管理。
- Gemini CLI 由应用内置打包，但首次登录仍采用终端式 Gemini CLI 原生流程。
- CLI 调用使用应用自有隔离 cwd，不使用作品目录作为 cwd，不启用 `--yolo`。
- Gemini API Key 模式 endpoint 可为空，默认使用 Google Generative Language API。
- 当前方案不承诺把 Gemini 网页版会员转换为 API Key 免费额度。

## 4. 范围边界与非目标

### 范围内

- AI provider 类型扩展与 dispatcher 改造
- Gemini REST adapter 接入现有写作 AI 功能
- Gemini CLI 主进程服务、preload IPC 与设置页状态入口
- Gemini CLI 依赖与打包配置
- provider routing、配置校验、CLI JSON / 错误解析测试
- AI-OS 验收门与风险登记

### 范围外

- 新增全局 AI 设置中心
- 复刻 Gemini CLI 私有认证流程
- 自动代用户创建 Google Cloud / AI Studio 凭据
- 把 Gemini CLI 作为通用代码 agent 暴露给作品目录
- 发布新版本或创建 GitHub Release

## 5. 核心需求清单

| 需求 ID | 需求点 | 验收入口 |
|---------|--------|----------|
| REQ-GEMINI-001 | Gemini API Key 免费层可驱动现有写作 AI 功能 | AC-GEMINI-001 |
| REQ-GEMINI-002 | Gemini CLI Google 登录路线可通过主进程安全调用 | AC-GEMINI-002 |
| REQ-GEMINI-003 | 项目设置清晰区分 Gemini API Key 与 Gemini CLI 登录 | AC-GEMINI-003 |
| REQ-GEMINI-004 | CLI 依赖被打包且运行边界受限 | AC-GEMINI-004 |
| REQ-GEMINI-005 | 错误、未登录、quota、超时路径有稳定提示 | AC-GEMINI-005 |

## 6. 风险与外部依赖

- `@google/gemini-cli@0.38.2` 要求 Node >= 20，解压体积约 111MB，会增加安装包体积。
- Gemini CLI 登录与额度由 Google 官方服务控制，403 / quota / 地区限制需要转化为清晰错误。
- CLI 具备工具能力，必须通过 cwd、settings 和命令参数限制其对作品目录的影响面。
- 打包后 CLI 路径、asar unpack 与跨平台启动方式需要单独 smoke。

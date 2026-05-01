# 证道 Shared Mission

> 本文件只记录共享宿主上下文、长期产品边界和跨 lane 约束，不承担当前这轮交付的详细基线。
> 当前交付基线一律写在 `.ai-os/lanes/<lane-id>/MISSION.md`。

## 1. 宿主项目身份

- **项目 / 系统**：证道
- **产品定位**：沉浸式桌面端网文创作软件，面向长篇小说 / 网文作者提供创作、结构管理、角色与剧情资产管理、AI 辅助写作和发布前本地工作流。
- **项目类型**：Electron 桌面应用
- **主要语言与框架**：TypeScript、Electron、electron-vite、React、Zustand、better-sqlite3、Tailwind CSS、Vitest。
- **仓库地址**：`https://github.com/royeedai/zhengdao`
- **主要使用者**：网文作者、小说创作者、维护桌面端发布包和 AI 创作能力的开发者。
- **长期成功标准**：
  - 桌面端核心写作、资产管理和 AI 创作链路稳定可用。
  - 发布包具备清晰版本、更新日志、安装资产和回滚说明。
  - AI 能力接入不牺牲本地数据安全、可恢复性和写作主路径稳定性。

## 2. 长期边界

- **必须保持的产品边界**：
  - 桌面端创作工具优先，不把主产品变成纯聊天应用或营销站。
  - AI 产出必须经过用户确认后再写入正文或作品资产。
  - 本地作品数据和写作主路径优先于辅助能力实验。
- **必须保持的工程边界**：
  - 不破坏 Electron 主进程 / preload / renderer 的分层边界。
  - 不绕开既有 SQLite repository、IPC、设置存储和 release workflow。
  - 涉及打包、自动更新、原生模块和 AI provider 的变更必须保留项目原生验证证据。
- **明确不纳入 AI-OS 的能力**：
  - AI-OS 工件只治理交付流程，不替代产品业务逻辑、测试框架或发布脚本。
  - v9 后不再使用旧 `.agents/` slash workflow / skill system 作为项目真理源。

## 3. 跨 Lane 共享约束

- **共享基础设施约束**：
  - 主进程、preload、renderer、SQLite schema、release scripts 和 Electron builder 配置属于跨 lane 共享面，修改前必须明确影响范围。
  - `better-sqlite3`、`node-pty`、Electron ABI 与打包流程存在联动风险，发布链路不得绕过 native rebuild / ABI smoke。
  - AI provider、Gemini CLI、账号配置和作品能力配置属于高风险共享链路，变更需同步风险与验证 guard。
- **共享文档 / 规范真理源**：
  - 根层 `.ai-os/MISSION.md`：共享宿主项目上下文。
  - 根层 `.ai-os/memory.md`：长期稳定决策、约定、坑点、技术债和跨层契约。
  - 具体 lane 的 `MISSION.md` / `DESIGN.md` / `tasks.yaml` / `verification-matrix.yaml`：当前交付基线、设计、任务和验证 guard。
- **跨 lane 冲突处理原则**：
  - 不把多个并行交付目标硬塞进同一 lane。
  - 同时存在多条 active lane 时，任何实现或验证前先明确当前 lane；共享代码改动需列出受影响 lane。
  - 完成或关闭 lane 前，将稳定经验回流到根层 `.ai-os/memory.md`。

## 4. 当前 Lane 拓扑

- **默认 lane**：`default`
- **默认交付基线入口**：`.ai-os/lanes/default/MISSION.md`
- **默认会话恢复入口**：`.ai-os/lanes/default/STATE.md`
- **现有 lane**：
  - `default`：Windows 安装版桌面壳层与品牌图标收口
  - `update-experience-redesign`：应用内更新体验重构与全局“应用设置 / 关于”入口
  - `gemini-free-ai`：Gemini API Key 免费层与 Gemini CLI 登录双通道
  - `ai-chat-assistant`：AI 创作助手、会话、草稿篮和 Gemini 3 Pro 流式体验
  - `license-policy`：开源许可证收紧与授权口径统一
  - `bookshelf-entry-behavior`：作品入口与总览触发收口
  - `v13-daily-workbench`：v1.3 可信日更工作台、审稿台与发布前检查包
  - `settings-workspace-polish`：系统/作品设置拆分、题材模板系统化与工作区交互统一
  - `desktop-ux-overhaul-2026q2`：桌面端 UX 系统重构，先用源码生成 surface ledger 防遗漏，再分批审计、设计、实现和截图验收

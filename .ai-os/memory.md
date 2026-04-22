# 项目共享记忆

> 只记录跨 session、跨 lane 仍然稳定有效的事实：已确认决策、长期约束、用户偏好、已知坑点、跨层契约和技术债。
> 当前交付过程中的临时状态不要写在这里，应进入具体 lane 的 `STATE.md`、`baseline-log/` 或 spec。

## active

### 1. 设计决策

#### DD-001: AI 能力配置必须保持“全局账号 + 作品能力”分层

- **决策**：账号、API Key、Gemini CLI 登录状态和默认 provider 属于全局配置；作品级配置只影响写作能力、提示词、上下文和资产生成约束。
- **原因**：避免每个作品重复登录或重复保存 provider 凭据，同时保留不同作品的创作风格与能力配置。
- **影响范围**：AI 设置页、项目设置页、AI assistant provider routing、Gemini CLI 状态检测。
- **确认来源**：`ai-chat-assistant` lane 多个已确认 CR 与验收记录。
- **日期**：2026-04-22

### 2. 工程约束

#### EC-001: 项目顶层授权采用 AGPL-3.0-only
- **约束**：仓库顶层 `LICENSE`、`README.md`、`package.json` 与 `package-lock.json` 根包许可证字段统一使用 `AGPL-3.0-only`，后续发布与对外说明不得再按 MIT 口径描述当前项目。
- **原因**：用户明确要求采用“最严格的开源协议”，并已确认按强 copyleft 的 `AGPL-3.0-only` 执行。
- **影响范围**：仓库授权说明、发布文档、协作者预期、后续版本元数据维护。
- **确认来源**：`license-policy` lane 基线 `CR-20260421-225658-oss-license-tightening` + 用户确认“确认按 AGPL-3.0-only 执行”。
- **日期**：2026-04-21

#### EC-002: GitHub Release 正文必须包含更新日志与发布必要信息
- **约束**：每次正式 GitHub Release 的正文必须从 `CHANGELOG.md` 对应版本条目同步更新日志，并包含安装包清单、自动更新元数据、发布注意事项、验证状态和回滚提示；不能只保留 tag、commit message 或空泛自动生成内容。
- **原因**：v1.2.3 发布后用户指出 Releases 页面缺少更新日志，并明确要求后续不要再遗漏必要内容。
- **影响范围**：release workflow、`RELEASING.md`、发布脚本、发布后检查和未来版本交付说明。
- **确认来源**：用户反馈“Releases 里居然缺少了 更新日志，下次记住不要再缺少必要内容了。”
- **日期**：2026-04-22

#### EC-003: AI-OS v9 为当前项目交付治理基线

- **约束**：项目使用 AI-OS v9 canonical layout：根共享 `.ai-os/MISSION.md` / `.ai-os/memory.md` + lane 级交付工件；旧 `.agents/` slash workflow / skill system 不再作为项目内分发工件。
- **原因**：上游 AI-OS v9 将 v7/v8 混合布局统一为 shared root + default lane，并移除了旧 workflow / skill 分发体系。
- **影响范围**：AI-OS 工件、IDE 指针、session 恢复入口、后续交付协作方式。
- **确认来源**：`default` lane 基线 `CR-20260422-213129-ai-os-v9-upgrade` + 用户确认“官方 v9 + 全量规范化所有 lane”。
- **日期**：2026-04-22

### 3. 用户偏好

#### PF-001: 完成声明必须包含必要发布信息

- **偏好**：对 release、ship 或完成声明，必须说明更新日志、资产、验证状态和仍需人工执行事项。
- **适用范围**：GitHub Release、交付说明、发布后检查。
- **来源**：用户对 v1.2.3 Release 正文缺失更新日志的反馈。
- **日期**：2026-04-22

### 4. 已知坑点

#### PT-001: Electron native rebuild 容易被 node-pty 扫描污染

- **问题**：release workflow 中 rebuild 或 electron-builder 默认 rebuild 可能扫描 Gemini CLI 依赖树里的 `node-pty`，导致跨平台构建失败。
- **根因**：`@electron/rebuild --which-module` 和 electron-builder 默认 `npmRebuild` 会触达非目标 native 模块。
- **绕行方案**：release workflow 只受控 rebuild `better-sqlite3`，`electron-builder.config.ts` 显式 `npmRebuild: false`，并保留 ABI smoke。
- **影响范围**：GitHub Actions release、macOS / Windows 打包、Gemini CLI 运行依赖。
- **日期**：2026-04-22

### 5. 技术债追踪

#### TD-001: 多条 active lane 需要后续收口

- **类型**：process-debt
- **严重度**：medium
- **影响范围**：AI-OS session 恢复、跨 lane 验证范围、交付收口判断。
- **消除计划**：后续逐条判断 `default`、`license-policy`、`bookshelf-entry-behavior` 等已完成 lane 是否应归档，并将稳定经验回流到根 memory。
- **日期**：2026-04-22

### 6. 跨层契约登记表

#### 6.1 Provider / 账号 / 作品能力契约

| 契约 | 真理源 | 消费方 | 约束 |
|---|---|---|---|
| 全局 AI 账号与 provider 状态 | AI settings / account provider store | AI assistant、Project settings、Gemini CLI service | 作品级配置不得复制或覆盖全局凭据。 |
| Gemini CLI 状态检测 | main process Gemini CLI service + IPC | renderer account/provider UI | CLI 登录采用终端式流程，不复刻 Google 私有认证。 |
| AI 草稿确认 | AI assistant draft workflow | editor / assets repositories | 草稿确认前不得写入正文或作品资产。 |

#### 6.2 Release / native module 契约

| 契约 | 真理源 | 消费方 | 约束 |
|---|---|---|---|
| Release 正文 | `CHANGELOG.md` + release scripts | GitHub Releases、用户下载页 | 正式 Release 不能缺更新日志与资产说明。 |
| Electron ABI smoke | `scripts/release/rebuild-electron-native.mjs` / `verify-electron-native.mjs` | release workflow、ship 验证 | 打包前后必须区分 Node ABI 与 Electron ABI。 |
| Builder rebuild policy | `electron-builder.config.ts` | GitHub Actions release job | 不允许 electron-builder 再次扫描并 rebuild 非目标 native 依赖。 |

## archived

> 不再生效的条目移到这里，归档而非删除。

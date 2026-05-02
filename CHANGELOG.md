# Changelog

All notable changes to this project will be documented in this file.

The project follows Semantic Versioning for release numbers. Release entries use a simple `Added / Changed / Fixed / Docs / Release` structure so the app package, Git tag, GitHub Release and changelog can stay aligned.

## v1.9.0 - 2026-05-02

### Release

- 发布作者成长与拆解报告客户端

### Added

- 新增「作者成长工作台」，支持本地写作冲刺、作者周报成长卡和投稿准备清单，分享文本只包含统计摘要，不包含正文或 AI 草稿。
- 新增投稿准备入口，复用发布前检查、敏感词和伏笔风险结果，按长篇网文、开篇样章和连载发布三个档位给出阻断项、提醒项和下一步建议。
- 新增市场扫描 / 作品拆解报告本地保存能力，只保存来源说明、输入哈希、结构化输出和短证据摘录，避免持久化完整授权样本。

### Changed

- 日更工作台新增作者成长和投稿准备快捷入口，当前作品的日更、总字数、章节数、连续写作和发布风险可以直接进入成长面板复核。
- 市场扫描与作品拆解面板补齐历史报告读取、结果保存和删除路径，方便后续回看已授权的拆解结论。

### Fixed

- 同步新增的拆解报告 IPC 通道与契约测试计数，避免新增 `ai:*` 通道后主进程、preload 和共享 channel registry 脱节。

## v1.8.1 - 2026-05-02

### Release

- 发布官方云同步客户端修复版

### Added

- 新增桌面端官方云作品包格式，覆盖作品、卷章、人物、剧情、设定、引文、AI 会话、Canon 和视觉资产元数据。
- 新增「同步全部作品」入口，并在登录成功后触发官方云同步。

### Changed

- 客户端云同步从旧 Google Drive 路径迁移到 `agent.xiangweihu.com` 官方账号与 `/api/v1/desktop-sync` 接口。
- Pro / Team 账号默认开启官方云同步，手动关闭后继续尊重本机设置。

### Fixed

- 修复多设备冲突时云端副本复用同一个 `cloud_book_id` 导致本地唯一索引冲突的问题。
- 云同步作品包会清空本地 API Key 和本机文件路径，避免把本地凭据或机器路径写入云端。

### Docs

- README 与历史更新日志中的云同步口径统一为证道账号和官网云备份。

## v1.8.0 - 2026-05-01

### Release

- 发布客户端创作工作流、性能优化和专业写作体验

### Added

- 新增书架页 AI 起书筹备包状态流，支持更稳定地生成作品、卷章、人物、设定和初始正文草稿。
- 新增本地书籍封面协议、封面服务和书架封面组件，避免书架列表把封面图片编码进大 payload。
- 新增桌面端 UX surface ledger 与性能治理工件，记录书架、工作区、AI Dock、弹窗和关键写作路径的验收面。

### Changed

- 书架和工作区加载改为章节元数据优先，完整章节正文按需读取，降低进书、切章和大作品列表的同步阻塞。
- AI 起书、章节草稿、底部沙盘、关系图谱、顶部栏和多处弹窗做了交互与布局收敛，提升专业写作工作台的一致性。
- 发布前检查、参考文献生成、风格分析和世界观一致性检查改为打开功能时按需读取全本正文，保持性能优化后的正文可用性。

### Fixed

- 修复章节元数据轻载改造后，正文型弹窗仍从 `volumes` 元数据读取 `content` 导致的 typecheck 和运行时风险。
- 修复新增数据库 IPC 通道后契约测试的 `db:*` 计数未同步问题。

### Docs

- 补齐桌面 UX 重构、客户端性能重构和 AI 操作体验文档，为后续批量验收保留追踪入口。

## v1.7.2 - 2026-04-29

### Release

- 发布桌面端 AI 技能反馈提交能力

### Added

- 新增桌面端 AI 技能反馈提交流程，支持用户对技能执行结果提交评分、原因和文字反馈。
- 新增技能反馈共享契约、IPC 通道和主进程转发逻辑，把桌面端反馈提交到官方 AI 技能反馈接口。

### Changed

- AI 助手消息流、风格学习、格式模板、引用构建、对话改写和世界一致性等技能入口增加反馈表单展示。
- 技能反馈表单补齐提交中、成功、失败和不可用状态，避免用户在无技能执行记录时误提交。
- 发布模板不再生成会被 GitHub Release notes 同步脚本拒绝的占位 changelog 段落。

### Fixed

- 修复 Windows release workflow 中路径安全测试只匹配 POSIX 分隔符，导致客户端发布在 `npm test` 阶段失败的问题。

### Docs

- Release notes 继续从本版本中文 `CHANGELOG.md` 同步到 GitHub Release，保留安装包、自动更新元数据、验证状态和回滚提示。

## v1.7.1 - 2026-04-29

### Release

- 补发桌面端 AI 技能反馈提交能力

### Fixed

- 修复 Windows release workflow 中路径安全测试只匹配 POSIX 分隔符，导致客户端发布在 `npm test` 阶段失败的问题。

### Docs

- Release notes 继续从本版本中文 `CHANGELOG.md` 同步到 GitHub Release，保留安装包、自动更新元数据、验证状态和回滚提示。

## v1.7.0 - 2026-04-29

### Release

- 发布桌面端 AI 技能反馈提交能力

### Added

- 新增桌面端 AI 技能反馈提交流程，支持用户对技能执行结果提交评分、原因和文字反馈。
- 新增技能反馈共享契约、IPC 通道和主进程转发逻辑，把桌面端反馈提交到官方 AI 技能反馈接口。

### Changed

- AI 助手消息流、风格学习、格式模板、引用构建、对话改写和世界一致性等技能入口增加反馈表单展示。
- 技能反馈表单补齐提交中、成功、失败和不可用状态，避免用户在无技能执行记录时误提交。

### Docs

- 补齐技能反馈表单、IPC API 和共享反馈契约的回归测试。

## v1.6.0 - 2026-04-28

### Release

- 发布 AI 起书筹备、行内草稿和全局 AI 配置体验

### Added

- 新增书架页 AI 起书筹备流程，支持用对话和快捷选项收集作品名、题材主题、篇幅目标、章节规划、人物规划、风格平台和创作边界，并生成可预览的一键起书筹备包。
- 新增 AI 生成章节与正文的行内草稿体验，用户确认前不会直接写入正文，支持继续生成、应用、丢弃和章节级快捷动作。
- 新增 AI 创建作品数据仓储与回归测试，覆盖筹备包校验、章节内容清理、起书入库和首章生成路径。
- 新增伏笔板、快捷笔记弹窗和统一品牌标识组件，补齐右侧栏、顶部栏和工作台里的入口。

### Changed

- 全局 AI 配置从旧“账号列表”收口为单一运行时配置，继续保留官方 AI、Gemini CLI、Gemini API、Ollama、OpenAI 兼容和自定义兼容入口。
- AI 助手上下文构建改为统一 resolver，章节、选区、作品资料、宝典上下文和本地引用在流式对话、草稿和快捷动作里保持一致。
- 编辑器、AI 助手、右侧栏、日更工作台和多处 Modal 做了布局与入口整理，减少重复配置和无效跳转。
- 应用品牌图标资源更新为更轻量的一组 PNG/ICO/ICNS/SVG 资产。

### Fixed

- 修复旧作品级 AI 配置迁移到全局配置时可能残留默认账号引用的问题，并清理旧 `ai_third_party_enabled` 状态。
- 修复 AI 助手流式内容替换、消息展示和章节草稿 fallback 的边界问题，补齐对应单测。
- 修复空章节、快捷动作、发布前检查弹窗和工作区布局在新 AI 草稿流程下的状态边界。

### Docs

- Release notes 继续从本版本中文 `CHANGELOG.md` 同步到 GitHub Release，保留安装包、自动更新元数据、验证状态和回滚提示。

## v1.5.3 - 2026-04-27

### Release

- 发布 AI 助手自动意图、桌面宝典与更新提示优化

### Added

- AI 助手右侧栏支持按入口、选区、当前章节和自然语言输入自动识别写作意图，覆盖续写、润色、审稿、章节生成、角色、设定、伏笔和剧情节点等能力。
- 新增桌面本地宝典上下文包，将作品风格、题材规则、内容边界、节奏规则、当前选区 / 章节、角色、伏笔、剧情节点和本地引用统一注入 AI 提示词。
- macOS 未签名公开测试包新增手动下载 DMG 的更新路径，自动更新面板可以展示手动下载入口。

### Changed

- AI 助手输入区收口为“直接描述写作意图”的主流程，低置信请求保持普通对话，高置信请求才进入对应能力卡草稿流程。
- 统计弹窗和 AI 助手面板的交互文案与布局做了收敛，减少重复模式选择和无效解释。
- 更新状态增加可恢复动作标记，检查、下载、安装失败后能在设置面板里指向更明确的下一步操作。

### Fixed

- 修复非 Pro 账号仍可进入官方 AI 配置选择路径的边界问题；未具备权益时会引导升级，第三方模型开关继续保持显式用户选择。
- 修复 AI 助手自动路由时部分上下文裁剪、章节选区和能力选择状态不一致的问题，并补齐对应回归测试。
- 修复更新提示在 macOS 未签名包、下载错误和 HTML release notes 场景下的显示与恢复状态边界。

### Docs

- 更新 README 中应用内更新与 macOS 手动安装说明。
- 更新 AI 助手 lane 和默认验证矩阵，记录自动意图识别、桌面宝典上下文和更新提示 guard。

## v1.5.2 - 2026-04-25

### Release

- 发布账号信息与发布前检查体验优化

### Changed

- “应用设置”的首页改为账号信息面板，集中展示邮箱、角色、邮箱验证、Pro 权益、AI 点数和账户中心入口。
- 发布前检查包改为大窗口双栏工作台，支持当前章节 / 全书切换、章节级问题定位、发布稿预览、复制与 TXT / DOCX / Markdown 导出。
- 账号菜单文案收口为“账号与设置”，已登录状态下优先进入账号信息页。

### Fixed

- 修复没有加载到章节列表时发布前检查包无法使用当前章节 / 目录缓存回退的问题。
- 修复发布稿预览、问题统计和导出按钮在空章节、无当前章节或全书检查场景下的边界显示。
- 补齐发布前检查包的回归测试，覆盖章节回退、全书 scope 和发布文本生成路径。

### Docs

- Release notes 继续从本版本中文 `CHANGELOG.md` 同步到 GitHub Release，保留安装包、自动更新元数据、验证状态和回滚提示。

## v1.5.1 - 2026-04-25

### Release

- 发布官方 AI 与本地 RAG 桌面体验优化

### Added

- 新增证道官方 AI 桌面端接入，默认走 `agent.xiangweihu.com` 的账号与官方模型配置。
- 新增本地优先 RAG：使用官方 AI 时只检索当前请求相关的少量本地章节片段，并随请求作为 `[L1]` 等引用上下文发送。
- 新增本地 RAG 排序与提示词 guard，要求作品事实只依据本地片段或当前上下文，证据不足时明确说明“书中未明确”。

### Changed

- AI 助手普通对话会在官方 AI 模式下展示“本地片段”上下文 chip，方便用户知道本轮已结合本地作品证据。
- 官方 AI、Gemini CLI、Gemini API、Ollama 和 OpenAI 兼容账号继续保持“应用设置全局账号 + 作品 AI 档案”的分层边界。
- 桌面端官方 AI 请求不默认上传整本作品，也不自动创建云端语义索引。

### Fixed

- 修复官方 AI / Gemini CLI 流式桥接中的类型与取消清理边界，避免停止生成后残留错误状态。
- 修复应用设置与 AI 全局账号面板在未登录、状态检测和密钥草稿场景下的显示与验证问题。
- 补齐本地 RAG、官方 AI provider routing 和应用设置弹窗的回归测试。

### Docs

- 更新默认 lane 验证 guard，记录官方 AI 与本地 RAG 的发布前验证要求。

## v1.5.0 - 2026-04-25

### Release

- Publish the desktop account, cloud backup, and documentation migration release after `v1.4.1`.

### Added

- Add Zhengdao account login through the official web auth callback flow, including desktop deep-link handling and account refresh notifications.
- Add official cloud-backup integration for book upload, cloud backup listing, and backup download through the Agent X website API.
- Add a shared account/settings menu for the bookshelf and workspace chrome with account status, sync settings, updates, and trash access.

### Changed

- Move desktop account and cloud backup credentials to the Zhengdao website account flow.
- Keep AI accounts as application-level defaults only; work AI profiles no longer expose or persist work-level account selection.
- Remove the built-in usage-help modal and F1 help shortcut now that product documentation is moving to the website docs center.
- Simplify the daily workbench to focus on writing progress, save state, snapshots, local backups, review, and publish checks.

### Fixed

- Handle `zhengdao://auth/callback` links both when the app is already running and when the callback launches the app as the first instance.
- Preserve legacy work-profile account references safely by ignoring them at runtime and clearing incoming account references on save.

### Docs

- Record the AI account boundary correction, help-docs migration, and desktop account/cloud backup domain decisions in lane artifacts.

## v1.4.1 - 2026-04-24

### Release

- Publish a Windows tray and installer reliability patch after `v1.4.0`.

### Added

- Add a Windows runtime system tray with show, hide-to-tray, and explicit quit actions.
- Package the Windows `.ico` as a runtime resource so the tray can use the formal application icon.
- Add release documentation for recovering from NSIS installer / uninstaller integrity errors without deleting user data.

### Changed

- Change Windows close behavior to hide the main window to the tray unless the user explicitly quits.
- Lock the Windows assisted installer to the existing install path and keep desktop / Start Menu shortcuts enabled.
- Stabilize the Windows uninstall display name as `证道`.

### Fixed

- Prevent overwrite installs from landing in a different directory and leaving old shortcuts or pinned entries opening the previous version.
- Ensure uninstall configuration does not delete `userData` or `zhengdao.db`.
- Keep macOS and Linux behavior unchanged for tray and close-window flows.

### Docs

- Record Windows tray, overwrite-install, uninstall-recovery risks and verification guards in the default lane artifacts.

## v1.4.0 - 2026-04-23

### Release

- Publish the settings/workspace polish release after `v1.3.1`.

### Added

- Add a system-level genre template library with seed templates, custom templates, copy/edit/delete support, and a configurable default template.
- Add system default daily-goal settings plus per-work follow-system/custom daily-goal modes.
- Add settings panels for genre templates, shortcut settings, backup/migration, and system daily-goal configuration.
- Add shared note state, sandbox layout helpers, AI panel resize-layout guards, and migration coverage for the new settings model.

### Changed

- Split Application Settings and Work Settings so system configuration no longer lives inside project settings.
- Update the new-book wizard and work settings to apply genre templates as snapshots rather than dynamic references.
- Improve the workspace top bar, bottom sandbox rail, right-panel notes badge, AI dock resizing, and several legacy modals to use the current theme tokens.
- Strengthen the renderer content-security policy by removing inline event handlers from the app shell.

### Fixed

- Preserve historical custom daily goals during migration while default 6000-word goals follow the system default.
- Keep the first sandbox plot node visible and separate click/open behavior from drag updates.
- Restore AI global-account status checks for draft and saved provider credentials.

### Docs

- Add the settings-workspace-polish lane artifacts, risk register, release plan, verification matrix, and related change records.
- Record AI dock resize and bottom sandbox/topbar interaction guards in the relevant lane artifacts.

## v1.3.1 - 2026-04-23

### Release

- Publish an updater reliability patch after `v1.3.0`.

### Changed

- Trigger a debounced update check when the packaged app launches, reopens a window, or becomes active, so long-running sessions can still discover new releases.
- Clean GitHub / `electron-updater` release notes into plain text before showing them in Application Settings -> Updates and About.
- On the current unsigned macOS public builds, replace in-app download / install with a direct download-page action until signing and notarization are available.

### Fixed

- Prevent users from missing an available update after reopening the app without quitting it first.
- Avoid rendering raw HTML tags inside the update log panel.
- Avoid ShipIt / Squirrel.Mac signature-validation failures caused by trying to install unsigned macOS builds from inside the app.

### Docs

- Record the updater reopen-check, HTML release-notes cleanup, macOS manual-download fallback, and release verification guards in the lane artifacts.

## v1.3.0 - 2026-04-23

### Release

- Publish the trusted daily writing workbench release after `v1.2.5`, including system settings IA cleanup and release-path native module hardening.

### Added

- Add a workspace daily status bar for today's word count, target gap, writing streak, save state, latest snapshot, local backup, cloud backup and publish readiness.
- Add a chapter review desk with a fixed six-section report covering plot progress, character consistency, foreshadowing, reader-risk points, pacing and actionable revisions.
- Add a platform-neutral publish check package for current-chapter and full-book checks, plain-text preview, copy-to-clipboard and TXT / DOCX / Markdown export.
- Add an Application Settings AI global accounts tab for OpenAI-compatible accounts, Gemini API Key, Gemini CLI, Ollama and custom-compatible providers.

### Changed

- Move theme, desktop account / cloud backup, AI global accounts, updates and about information into Application Settings.
- Remove scattered title-bar system controls so the workspace title bar keeps only workspace actions plus one Application Settings entry.
- Keep project AI settings focused on work-level AI profiles and capability cards while global account management lives at the app level.
- Add `predev` and `pretest` native rebuild hooks so Electron startup and Node-based tests use the correct `better-sqlite3` ABI.

### Fixed

- Resolve system theme handling so the app writes resolved light / dark theme tokens instead of invalid `data-theme="system"`.
- Fix publish-package export failures for user-selected save paths and preserve paragraphs in TXT / DOCX / Markdown output.
- Route update prompts into Application Settings -> Updates and About.

### Docs

- Add v1.3 daily workbench mission, design, tasks, verification, release plan and risk register artifacts.
- Record release guards for publish assets, update metadata and exposed-token rotation.

## v1.2.5 - 2026-04-23

### Release

- Publish an AI assistant hardening and in-app update experience patch after `v1.2.4`.

### Added

- Add a global “应用设置 / 关于” modal that shows update metadata, release notes, download progress and install actions from both bookshelf and workspace.
- Add provider status probing for Gemini API, OpenAI-compatible, Ollama and custom AI accounts alongside the existing Gemini CLI login/status flow.

### Changed

- Change packaged-app updates from automatic download to automatic check plus user-triggered download and install.
- Route active AI entry points through the resolved global account chain so migrated accounts work consistently across assistant, summary, inline completion and analysis flows.
- Make `smart_minimal` AI context include only mentioned characters, foreshadowings and plot nodes, while manual context chips can be explicitly selected.

### Fixed

- Allow users to stop in-flight AI generation without surfacing a failure state, while preserving received partial output.
- Add install watchdog recovery so update install attempts can return to a retryable ready state if the app does not quit.
- Replace the old title-bar-only update action with a reusable prompt and settings entry point.

### Docs

- Document the AI configuration unification and update experience redesign lanes, including release risks and regression guards.
- Update README, SUPPORT and in-app help text for the new manual update flow.

## v1.2.4 - 2026-04-23

### Release

- Publish a stability and workspace polish patch after `v1.2.3`.

### Added

- Add a system-following default theme with a cooler light palette and lower-saturation dark palettes.
- Add persisted left/right workspace panel widths, right-panel tab state, and topbar tool collapse state.
- Add a draggable AI assistant launcher that stays inside the viewport and no longer shows a separate floating close button when the panel is open.

### Changed

- Unify workspace topbar tools, core modals, side panels, AI assistant surfaces, status colors, and common controls around semantic theme variables.
- Move crowded workspace tools into a responsive overflow menu on narrower windows.
- Normalize project AI-OS delivery governance to the v9 shared-root plus lane-artifact layout.

### Fixed

- Fix the character relation graph layout feedback loop that made character labels drift downward.
- Keep AI assistant panel and launcher geometry clamped after window resize.
- Load AI assistant configuration, conversation, messages, and drafts together to reduce transient stale state during project switches.
- Clean up the Gemini CLI service test assertion so it no longer binds an unused runtime argument.

### Docs

- Add or update release planning, risk, verification, lane, and recovery artifacts for the v1.2.4 release path.
- Record the requirement that GitHub Release pages include changelog, package assets, update metadata, notes, validation state, and rollback guidance.

## v1.2.3 - 2026-04-22

### Release

- Fix release packaging native rebuild

### Changed

- Publish the AI creative assistant release as `v1.2.3` after `v1.2.2` exposed an electron-builder packaging rebuild issue in GitHub Actions.
- Keep the AI feature scope unchanged from `v1.2.0`; this patch only changes release packaging infrastructure.

### Fixed

- Disable electron-builder's default all-dependency native rebuild so release jobs use the controlled `better-sqlite3` Electron ABI rebuild that is already verified before packaging.
- Add release config coverage to prevent accidentally re-enabling electron-builder's default native rebuild.

### Docs

- Document why `electron-builder.config.ts` must keep `npmRebuild: false` for release packaging.

## v1.2.2 - 2026-04-22

### Release

- Fix native rebuild scope for release packaging

### Changed

- Publish the AI creative assistant release as `v1.2.2` after `v1.2.1` exposed a native rebuild scope issue in GitHub Actions.
- Keep the AI feature scope unchanged from `v1.2.0`; this patch only changes release infrastructure.

### Fixed

- Limit Electron native rebuilds to `better-sqlite3` with `@electron/rebuild --only better-sqlite3`, avoiding unintended rebuilds of Gemini CLI transitive native modules such as `node-pty`.
- Add release script coverage so the rebuild command cannot regress back to `--which-module`.

### Docs

- Document why release packaging must rebuild only `better-sqlite3`.

## v1.2.1 - 2026-04-22

### Release

- Fix release packaging workflow for AI assistant

### Changed

- Publish the AI creative assistant release as `v1.2.1` after the initial `v1.2.0` tag workflow failed before packaging assets were produced.
- Keep the `v1.2.0` AI feature scope unchanged; this patch only fixes release packaging so GitHub Releases can receive installer and update metadata assets.

### Fixed

- Harden GitHub Actions release dependency installation by pinning npm, skipping unstable install scripts, then explicitly rebuilding Electron and native modules.
- Restore Electron runtime installation before Electron ABI smoke verification in release jobs.

### Docs

- Document the CI native module install sequence used by release builds.

## v1.2.0 - 2026-04-22

### Release

- Add AI creative assistant and Gemini CLI workflow

### Added

- Add the bottom-right AI creative assistant with normal chat, skill cards, conversation history, stream rendering, draggable/resizable panel controls and draft-basket confirmation before writing into novel assets.
- Add global AI account management for Gemini CLI/API-compatible providers and work-level AI profiles for writing prompts, context policy and asset-generation rules.
- Add Gemini CLI login, status detection and default Gemini 3 Pro model routing for CLI-based conversations.

### Changed

- Replace older scattered AI entry buttons with the unified AI assistant and AI capability/profile configuration flow.
- Render structured AI drafts as readable cards for chapters, characters, wiki entries, plot nodes and foreshadowing instead of exposing raw JSON.

### Fixed

- Harden Gemini CLI stream handling for empty/partial stream-json responses and synchronous bridge cleanup.
- Rebuild and verify `better-sqlite3` against the Electron ABI before packaging checks.

### Docs

- Document the AGPL-3.0 license change and AI/Gemini CLI release scope.

## v1.1.5 - 2026-04-21

### Release

- Force Electron ABI rebuild before packaging

### Changed

- Fill in notable user-facing changes before publishing if more detail is needed.

### Fixed

- Fill in important fixes before publishing if applicable.

### Docs

- Update documentation references if this release changed installation or workflow details.

## v1.1.4 - 2026-04-21

### Release

- Fix native module ABI in packaged installers

### Changed

- Fill in notable user-facing changes before publishing if more detail is needed.

### Fixed

- Fill in important fixes before publishing if applicable.

### Docs

- Update documentation references if this release changed installation or workflow details.

## v1.1.3 - 2026-04-21

### Release

- Use ASCII release artifact names

### Changed

- Fill in notable user-facing changes before publishing if more detail is needed.

### Fixed

- Fill in important fixes before publishing if applicable.

### Docs

- Update documentation references if this release changed installation or workflow details.

## v1.1.2 - 2026-04-21

### Release

- Fix unsigned macOS release packaging

### Changed

- Fill in notable user-facing changes before publishing if more detail is needed.

### Fixed

- Fill in important fixes before publishing if applicable.

### Docs

- Update documentation references if this release changed installation or workflow details.

## v1.1.1 - 2026-04-21

### Release

- Fix release CI native module rebuild before packaging

### Changed

- Fill in notable user-facing changes before publishing if more detail is needed.

### Fixed

- Fill in important fixes before publishing if applicable.

### Docs

- Update documentation references if this release changed installation or workflow details.

## v1.1.0 - 2026-04-21

### Release

- Add in-app updates, branded desktop shell, and installer icons

### Changed

- Fill in notable user-facing changes before publishing if more detail is needed.

### Fixed

- Fill in important fixes before publishing if applicable.

### Docs

- Update documentation references if this release changed installation or workflow details.

## v1.0.0 - 2026-04-20

### Added

- First public open-source release of the Zhengdao desktop writing application.
- Immersive editor, role library, setting wiki, plot sandbox, foreshadow board, statistics dashboard, trash and backup workflows.
- GitHub Releases based in-app update flow for packaged builds.

### Docs

- Initial open-source README, contribution guide, security policy, support guide, code of conduct and issue / PR templates.
- Initial maintainer release process and project-level GitHub release skill.

### Release

- Windows x64 installer and macOS Apple Silicon package as the primary public build targets.
- Tagged GitHub Actions release workflow for future packaged releases.

# Changelog

All notable changes to this project will be documented in this file.

The project follows Semantic Versioning for release numbers. Release entries use a simple `Added / Changed / Fixed / Docs / Release` structure so the app package, Git tag, GitHub Release and changelog can stay aligned.

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

- Move desktop account and cloud sync from Google OAuth / Drive credentials to the Zhengdao website account flow.
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

- Move theme, Google account / cloud sync, AI global accounts, updates and about information into Application Settings.
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

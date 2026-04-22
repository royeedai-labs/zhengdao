# 发布计划：v1.2.0 AI 创作助手

## 发布目标

- 版本：`1.2.0`
- 类型：minor
- 交付方式：`npm run release:publish -- minor "Add AI creative assistant and Gemini CLI workflow"` 推送 tag，由 GitHub Actions 构建 GitHub Release 产物。
- 受影响范围：桌面端 AI 创作助手、AI 账号/能力配置、Gemini CLI 工作流、AI 会话与草稿篮。

## 发布输入

- 当前需求基线：`CR-20260422-084513-gemini-3-pro-streaming-experience`
- 发布前补丁：`bridgeStreamComplete` cleanup 加固，覆盖同步完成场景，避免未来 bridge 实现跳过 cleanup。
- 账号/key/CLI 配置保持全局；作品级配置只影响写作能力、提示词、上下文和资产生成约束。

## 验证证据

- RED：`npx vitest run src/renderer/src/utils/ai/__tests__/provider-routing.test.ts`，新增同步完成 cleanup 用例失败，`cleanup` 调用次数为 0。
- GREEN：`npx vitest run src/renderer/src/utils/ai/__tests__/provider-routing.test.ts`，1 file / 6 tests passed。
- AI 目标回归：`npx vitest run src/main/ai/__tests__/gemini-cli-service.test.ts src/renderer/src/utils/ai/__tests__/account-provider.test.ts src/renderer/src/components/ai/__tests__/streaming-message.test.ts`，3 files / 20 tests passed。
- 全量测试：`npm rebuild better-sqlite3` 后 `npm test`，27 files / 105 tests passed。
- 生产构建：`npm run build` passed。
- Electron 原生模块：`node scripts/release/rebuild-electron-native.mjs` Rebuild Complete for Electron 33.4.11 arm64；`node scripts/release/verify-electron-native.mjs` better-sqlite3 Electron ABI smoke passed。
- 静态 diff：`git diff --check` passed。

## Smoke Check

- 打开作品不黑屏。
- AI 面板可打开、拖动、缩放。
- 普通对话可不选择能力卡，输入“你有什么能力”显示 Gemini 3 Pro 等待态，并按 provider chunk 渲染。
- 新建、切换、删除会话正常。
- AI 生成角色/设定展示为可读草稿，不直接暴露 JSON。
- 草稿未确认前不写入正文或资产。

## 回滚方案

- 代码回滚：回退 `v1.2.0` release commit 与 tag，重新发布上一个稳定版本。
- GitHub Release 回滚：将 `v1.2.0` Release 标记为 draft 或删除有问题资产；应用内更新回退到上一版 `latest*.yml`。
- 数据回滚：本次新增 AI 表为兼容新增，不删除旧字段；如需禁用 AI 入口，可发布回滚包恢复旧 UI。

## 风险与注意事项

- macOS 仍按现有配置产出未签名/未公证包，适合公开测试分发，不等于完成正式签名自动更新链路。
- Gemini 3 Pro 首 token 延迟取决于上游 Gemini CLI / 模型；应用侧只保证等待态与真实 chunk 队列渲染。
- 发布前必须提交所有功能改动，让 `release:publish` 的 clean worktree 检查通过。

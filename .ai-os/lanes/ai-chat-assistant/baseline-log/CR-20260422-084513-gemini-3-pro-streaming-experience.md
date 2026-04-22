# CR-20260422-084513-gemini-3-pro-streaming-experience

## 类型

P1 change

## 变更原因

用户确认 Gemini CLI 默认模型不应改为 `gemini-2.5-flash`，应默认使用 Gemini 3 Pro；同时要求继续优化 AI 对话的真实流式体验，避免看起来一次性渲染。

## 变更内容

- Gemini CLI 账号未填写模型时，应用层默认使用 `gemini-3-pro-preview`。
- Gemini CLI 设置页模型输入提示明确默认模型是 `gemini-3-pro-preview`。
- AI 对话首 token 前显示 Gemini 3 Pro 生成等待态，避免用户误以为无响应。
- AI 对话只展示 provider 实际返回的 delta chunk，不拆字伪造 token。
- 当 provider delta 在短时间内 burst 到达时，前端按 chunk 队列逐段渲染，并在队列 drain 后再持久化 assistant message。

## 影响分析

| 维度 | 是否受影响 | 说明 |
|------|------------|------|
| MISSION | 否 | 不改变 AI 助手总体目标 |
| baseline-log | 是 | 追加本 CR |
| spec | 否 | 仍落在 AC-AI-013 流式输出体验 |
| tasks | 是 | 新增 TASK-AI-CHAT-016 |
| tests | 是 | 补 Gemini CLI 默认模型、设置提示、stream chunk queue 测试 |
| acceptance | 是 | 更新当前 baseline 与验证证据 |
| release | 否 | 暂不发布 |
| memory | 否 | 验证稳定后再沉淀 |
| evals | 否 | 当前为交互体验修正，不新增 eval |

## 新增风险

- Gemini 3 Pro 首 token 延迟仍由上游 Gemini CLI / 模型决定，应用只能提供等待态和真实 delta 队列渲染，不能让上游更早产出 token。
- chunk 队列会改善 burst delta 的视觉过程，但不会拆字伪造模型未返回的内容。

## 验收锚点

- AC-AI-013：AI 回复在生成过程中实时渲染，完成后持久化最终 assistant message。

## 计划验证

- RED：Gemini CLI 空模型请求应默认传入 `gemini-3-pro-preview`。
- RED：Gemini CLI 设置页模型 placeholder 应提示 `默认 gemini-3-pro-preview`。
- RED：stream chunk queue 应按 provider chunk 逐段渲染，并支持等待 drain。
- GREEN 后执行目标测试、`npm test`、`npm run build`。

## 验证结果

- RED：`npx vitest run src/main/ai/__tests__/gemini-cli-service.test.ts` 新增用例失败，证明空模型未默认到 Gemini 3 Pro。
- RED：`npx vitest run src/renderer/src/utils/ai/__tests__/account-provider.test.ts` 新增断言失败，证明设置页 placeholder 仍是旧提示。
- RED：`npx vitest run src/renderer/src/components/ai/__tests__/streaming-message.test.ts` 新增用例失败，证明 chunk queue 尚不存在。
- GREEN：`npx vitest run src/main/ai/__tests__/gemini-cli-service.test.ts src/renderer/src/utils/ai/__tests__/account-provider.test.ts src/renderer/src/components/ai/__tests__/streaming-message.test.ts` 通过，3 files / 20 tests passed。
- 回归：`npm test` 通过，27 files / 104 tests passed。
- 构建：`npm run build` 通过。
- 运行态：验证后执行 `node scripts/release/rebuild-electron-native.mjs`，将 `better-sqlite3` 切回 Electron 33.4.11 arm64 ABI。

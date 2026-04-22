# CR-20260422-082618-gemini-cli-stream-empty-response

## 类型

P2 debug

## 触发问题

用户在 AI 对话框输入“你有什么能力”后，没有看到流式输出，也没有错误提示。

## 复现路径

1. 打开作品工作区右下角 AI 对话框。
2. 使用 Gemini CLI 作为默认 AI 账号。
3. 在普通对话模式输入“你有什么能力”。
4. 观察到 assistant 消息没有实时 token，也没有明确失败提示。

## 根因假设

当前 Gemini CLI `stream-json` 解析只识别 `message.role === "assistant"` 且 `content` 为字符串的事件。实际 Gemini CLI 输出可能使用 content parts 数组，例如 `content: [{ type: "text", text: "..." }]`，并且不保证带 `role` 字段。解析器吞掉所有有效文本后，进程以 0 退出，服务层又把空 `fullText` 当成成功完成，导致前端无 token、无错误。

只读追踪后补充第二个根因：renderer 的 Gemini CLI stream bridge 只负责注册 IPC listener 并立即返回，`await aiPromptStream` 没有等待主进程 `onComplete` / `onError`。前端会先持久化空 assistant 消息，后续 token 即使到达也无法正确完成当前发送流程。

## 影响范围

- 影响 Gemini CLI provider 的流式对话输出。
- 主要影响普通对话，也会影响所有走 `aiPromptStream` 的 Gemini CLI skill。
- 不改变全局账号、作品 AI 档案、草稿篮写入规则和非 Gemini CLI provider。

## 修复边界

- 兼容 Gemini CLI `stream-json` 的 content parts 文本结构。
- Gemini CLI 进程成功退出但没有解析到任何正文时，返回明确错误，不再静默完成。
- renderer 侧等待 Gemini CLI 异步 stream bridge 完成后再继续持久化 assistant 消息。
- 前端 AI 对话兜底拒绝保存空 assistant 消息。

## 验收锚点

- AC-AI-013：AI 回复在生成过程中实时渲染，完成后持久化最终 assistant message。
- AC-AI-014：普通问答不创建正文/资产草稿。

## 计划验证

- 先补 `parseGeminiCliStreamJsonLine` content parts 解析失败测试并确认 RED。
- 补 Gemini CLI stream 空响应失败测试并确认 RED。
- 补 renderer Gemini CLI stream bridge 异步完成等待测试并确认 RED。
- 修复后执行目标测试、`npm test`、`npm run build`。

## 验证结果

- RED：`npx vitest run src/main/ai/__tests__/gemini-cli-service.test.ts` 新增 2 个用例失败，证明 content parts 被吞、空响应被静默完成。
- RED：`npx vitest run src/renderer/src/utils/ai/__tests__/provider-routing.test.ts` 新增 1 个用例失败，证明 stream bridge 提前 resolve。
- RED：`npx vitest run src/renderer/src/components/ai/__tests__/streaming-message.test.ts` 新增 1 个用例失败，证明前端缺少空回复兜底。
- GREEN：上述 3 个目标测试文件全部通过。
- 回归：`npm test` 通过，27 files / 102 tests passed。
- 构建：`npm run build` 通过。
- 运行态：验证后执行 `node scripts/release/rebuild-electron-native.mjs`，将 `better-sqlite3` 切回 Electron 33.4.11 arm64 ABI。

# Eval: Gemini CLI Stream Empty Response

- **Failure mode**：Gemini CLI stream-json 返回 content parts 或空流时，应用静默完成并保存空 assistant 消息。
- **Trigger**：升级 `@google/gemini-cli`、修改 `gemini-cli-service.ts`、provider routing 或 streaming message rendering。
- **Expected**：字符串 content 和 content parts 都能解析；不可恢复的空响应显示明确错误，不保存空 assistant 消息。
- **Observed**：历史修复已添加 focused RED/GREEN 测试，覆盖 content parts 被吞、bridge 提前 resolve 和前端空回复兜底。
- **Guard update**：保持 `FM-AI-001`，涉及 Gemini CLI streaming 的改动必须跑 focused tests 与 `npm run build`。

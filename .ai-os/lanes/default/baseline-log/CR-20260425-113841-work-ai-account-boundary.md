# CR-20260425-113841-work-ai-account-boundary

## 背景

用户确认桌面端“作品设置”只需要 AI 作品能力，不需要 AI 账号；AI 账号属于系统级“应用设置”内容。

## 变更范围

### 范围内

- 移除“作品设置 / AI 作品能力”中的 AI 全局账号入口。
- 移除“AI 能力与作品配置”中的账号读取和默认全局账号选择。
- AI 运行时账号解析只使用应用设置中的全局默认账号，不再优先读取作品级账号引用。

### 范围外

- 不改 AI 账号数据库 schema 和账号管理页。
- 不迁移 AI 能力卡、作品提示词、上下文策略、写作禁区。
- 不改变 Gemini CLI、OpenAI 兼容、Ollama 等 provider 的调用协议。

## 验证要求

- `npm test -- src/main/database/__tests__/ai-assistant-repo.test.ts`
- `npm run build`
- 代码审阅确认作品设置和 AI 作品配置不再暴露 AI 账号管理或账号选择入口。

# CR-20260423-010500 AI 配置真理源统一与助手收口

## 背景

- 用户要求基于本轮 AI 功能审计结果，直接实现已确认整改方案。
- 现状存在配置双轨：AI 助手走 `aiGetResolvedConfigForBook`，但章节摘要、行内补全、角色一致性检查、风格分析仍直接消费 `project_config.ai_*`。
- AI Dock 的“手动选择上下文”只有文案，没有真实裁剪；流式生成缺少停止能力；会话标题字段未实际启用。

## 变更目标

1. 统一 renderer 侧 AI 配置真理源，所有活跃 AI 入口都消费解析后的全局账号 / 作品档案结果。
2. 让 AI Dock 的上下文策略真正生效，支持手动勾选上下文。
3. 为 AI Dock 补齐停止生成、会话标题生成 / 重命名、前置校验。
4. 在不破坏兼容迁移的前提下，补 provider 检测、风格分析采样与密钥安全存储。

## 影响范围

- renderer AI 工具层、AI Dock、AI 设置面板、编辑器 AI 入口、风格分析 / 一致性检查模态框。
- main/preload IPC、AI 会话 repository、Gemini CLI stream bridge、provider status probe。
- lane 验证 guard 需新增“旧入口绕过新配置链路”和“手动上下文未真正裁剪”的回归保护。

## 已锁定决策

- `project_config.ai_*` 继续保留，仅作为迁移 fallback，不再作为活跃运行时主链。
- `manual` 上下文策略必须只发送用户显式勾选的 chips。
- 停止流式生成后保留已收到内容，不把它当成错误。
- 会话标题默认取首条用户消息摘要；用户可在会话列表手动重命名。
- OpenAI / Gemini / Ollama 的 provider 状态检测补到现有全局账号 UI，不新开配置入口。

## 验证要求

- focused Vitest：assistant workflow、conversation list、provider routing、gemini cli service、ai repository。
- `npm run build`
- 真实 provider 手工验收仍保留为运行态验证项，不用自动测试替代。

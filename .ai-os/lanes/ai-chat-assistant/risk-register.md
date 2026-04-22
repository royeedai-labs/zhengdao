# AI 创作助手风险登记

| 风险 ID | 描述 | 影响范围 | 触发条件 | 规避措施 | 监测入口 | 审批结论 |
|---|---|---|---|---|---|---|
| R-AI-001 | AI 草稿未经确认写入正文或资产 | 用户作品数据、editor、assets repositories | 草稿解析或应用流程绕过确认层 | 草稿篮确认机制、draft kind 白名单、自动化测试覆盖 | `assistant-workflow.test.ts`、`draft-preview.test.ts` | user-approved-with-guard |
| R-AI-002 | 删除历史会话属于本地数据删除，误删会影响用户回溯 | AI conversation repository、UI 会话列表 | 删除动作没有二次确认或 fallback 会话错误 | 删除确认弹窗、删除后 fallback 会话选择测试 | `conversation-list.test.ts`、UI manual check | approval-required-at-action |
| R-AI-003 | Gemini CLI stream-json 格式变化导致空响应静默完成 | Gemini CLI service、provider routing、message rendering | 上游 CLI 输出 content parts、空流或非预期 JSON | 解析字符串 content 与 content parts；空响应转显式错误 | `gemini-cli-service.test.ts`、`streaming-message.test.ts` | accepted-with-regression |
| R-AI-004 | Release native rebuild 被 `node-pty` 污染，导致 GitHub Release 缺资产 | release workflow、electron-builder、native modules | electron-builder 默认 rebuild 或 rebuild 脚本扫描全依赖 | `npmRebuild: false`；受控 rebuild `better-sqlite3`；ABI smoke | `release-plan.md`、release workflow logs | accepted-with-release-guard |
| R-AI-005 | 真实 provider / 模型输出仍需人工体验验证 | AI Dock、Gemini CLI 登录、模型输出体验 | 自动测试通过但真实 Google 登录或模型流式体验异常 | Ship 阶段明确待人工验证，不把代码状态写成运行态全完成 | `STATE.md`、manual UAT | pending-manual-validation |
| R-AI-006 | 旧 AI 入口继续读取 `project_config.ai_*`，导致迁移到全局账号后功能局部失效 | InlineComplete、章节摘要、风格分析、一致性检查 | 旧入口未切到 resolved config | 统一 renderer 侧 resolved-config 入口并补 focused tests | `provider-routing.test.ts`、legacy AI manual smoke | accepted-with-guard |
| R-AI-007 | `manual` 上下文策略只有文案没有真实裁剪，导致 prompt 泄露超出用户意图的上下文 | AI Dock、assistant workflow | chips 不可开关或 compose 阶段忽略 enabled 状态 | manual chips 开关、prompt 组合测试、UI 手工验收 | `assistant-workflow.test.ts`、AI Dock manual UI check | accepted-with-guard |
| R-AI-008 | 用户中止流式生成后，Gemini CLI / fetch stream 以失败收口或丢失已收到内容 | AI Dock、provider routing、Gemini CLI stream bridge | stop 只中断 listener，不中断底层请求；或 abort 被当成错误 | request abort、IPC cancel、partial-content 保留策略 | `gemini-cli-service.test.ts`、`provider-routing.test.ts`、manual UI check | accepted-with-guard |
| R-AI-009 | provider 检测对 OpenAI / Gemini / Ollama 给出假阳性或误导性提示 | AI 设置、provider status probe | 只看本地字段，不做真实请求；或错误映射不清晰 | 扩展 provider probe IPC，保留 clear error message | `AiSettings` manual probe、focused tests where applicable | accepted-with-manual-validation |

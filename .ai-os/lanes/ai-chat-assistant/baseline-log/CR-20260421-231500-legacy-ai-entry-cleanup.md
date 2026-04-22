# 变更请求：legacy AI 入口清理与 Gemini CLI 登录迁移

- **提出时间**：2026-04-21 23:15 Asia/Shanghai
- **变更原因**：用户确认旧 BottomPanel 的 `生成章节` / `AI 补全` 已不符合新的 AI 助手架构；同时 Gemini CLI 授权登录必须在新的全局账号配置中完成，不能继续依赖旧项目设置页。
- **优先级**：P1
- **基线 ID**：CR-20260421-231500-legacy-ai-entry-cleanup

## 变更内容

- 下线 BottomPanel 中 legacy AI 章节生成和剧情补全入口，只保留手动剧情节点维护操作。
- 旧“项目设置 -> AI 配置”收口为桥接说明，不再暴露 per-book provider 表单与 Gemini CLI 登录按钮。
- 在“AI 能力与作品配置 -> 全局账号”中补齐 Gemini CLI 状态检测与 Google 登录入口。

## 影响分析

| 维度 | 是否受影响 | 说明 |
| --- | --- | --- |
| MISSION | 是 | 补充 legacy AI 入口下线和 Gemini CLI 登录迁移约束 |
| baseline-log | 是 | 新增本 CR |
| spec | 是 | 新增 legacy 入口下线和 Gemini CLI 全局账号验收 |
| tasks | 是 | 新增清理与迁移任务 |
| tests | 是 | 新增账号 provider UI 能力测试 |
| acceptance | 是 | 重新打开实现质量门和交付质量门 |
| release | 否 | 无新增发布动作 |
| memory | 否 | 暂无稳定长期约定 |
| evals | 否 | 本轮未形成新的稳定 failure mode |

## 新增风险 / blocker

- 删除旧入口后，若新 AI 助手在某条创作路径上能力缺口明显，会直接暴露为功能回退，需要人工体验确认。
- `project_config` 仍作为 fallback 保留，UI 收口后不应误导用户继续依赖旧配置。

## 后续动作

- 更新 AI 账号配置 UI，使 `gemini_cli` provider 显示状态检测和启动登录。
- 移除 BottomPanel 旧 AI 行为和旧项目设置页中的重复 AI provider 表单。
- 运行定向测试与构建验证，并人工确认工作区和 AI 配置入口可用。

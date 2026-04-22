# Parity Map

## 原始参考清单

- 证道既有写作工作区、BottomPanel 和 modal / confirm 交互
- 证道既有 AI provider routing
- Gemini CLI stream-json 输出行为

## 字段级 / 行为级对照

| 原始字段 / 行为 | 本项目实现 | 差异 | 结论 |
|---|---|---|---|
| 旧 BottomPanel AI 入口 | 右下角 AI Assistant Dock | 旧入口下线，避免双入口混乱 | aligned |
| 能力卡生成正文 | 显式能力卡 + 草稿确认 | 普通会话不默认触发正文草稿 | aligned |
| Gemini CLI stream-json | 主进程解析 + renderer chunk queue | 不伪造 token，只渲染真实 delta | aligned |
| 会话历史 | 右侧会话列表 | 删除需要二次确认 | aligned |

## 结论

本 lane 不是 reverse-spec 项目；parity map 用于记录旧入口 / 旧行为与新 AI Dock 行为的替换关系。

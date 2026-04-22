# Parity Map

## 原始参考清单

- Gemini API Key 免费层
- Gemini CLI Google 登录
- 证道既有 OpenAI / Ollama provider routing

## 字段级 / 行为级对照

| 原始字段 / 行为 | 本项目实现 | 差异 | 结论 |
|---|---|---|---|
| API Key 调用 | Gemini REST adapter | 免费层额度由 Google API 控制 | aligned |
| Google 登录调用 | Gemini CLI service | 采用终端式登录，不复刻私有 OAuth | aligned |
| provider 状态 | AI 设置 / 项目设置提示 | CLI 登录和 API Key 状态分开呈现 | aligned |

## 结论

本 lane 不是 reverse-spec 项目；parity map 仅记录两条 Gemini 使用路径与本项目 provider routing 的对照。

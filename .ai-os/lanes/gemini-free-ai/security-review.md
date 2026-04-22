# 安全与全链路自审：Gemini 免费使用双通道

## 安全结论

- **P0 阻塞漏洞**：未发现。
- **P1 剩余风险**：Windows 原生打包与真实 Google 登录仍需人工 / CI 验证；Gemini CLI 自带本地工具能力，后续升级 CLI 时需复查 settings 限制是否仍生效。

## 已确认防线

- Gemini CLI 调用只在主进程执行，renderer 只能通过 `ai:complete` IPC 请求 `gemini_cli` provider。
- CLI cwd 固定为应用 userData 下的 `gemini-cli` 工作目录，不使用作品目录或数据库目录。
- 初始化 `.gemini/settings.json`，禁用 usage statistics，并将 `tools.core` 设置为空数组以限制核心工具。
- CLI 调用不启用 `--yolo`，测试已断言命令参数不包含 `--yolo`。
- 不读取、不存储 Gemini CLI 的 Google 登录凭据；登录状态由官方 CLI 自行管理。
- 不复用 Google Drive OAuth token。

## 全链路检查

| 维度 | 结果 | 证据 |
|------|------|------|
| 页面入口 | 通过 | 项目设置新增 Gemini API Key 免费层与 Gemini CLI（Google 登录）选项 |
| IPC / 主进程 | 通过 | `ai:complete`、`ai:getProviderStatus`、`ai:setupGeminiCli` 已注册 |
| provider routing | 通过 | focused vitest 7 tests passed |
| 持久化 | 通过 | 复用 `project_config.ai_provider` TEXT，无迁移 |
| 打包 | 部分通过 | macOS dir + packaged CLI version smoke passed；Windows cross smoke blocked |
| 失败路径 | 通过 | auth、403/quota、非 JSON、timeout 均有稳定错误 |

## 待验证

- 在 Windows runner / Windows 真机执行 NSIS 打包 smoke。
- 使用真实 Google 账号完成 Gemini CLI 登录后执行一次写作 AI 请求。

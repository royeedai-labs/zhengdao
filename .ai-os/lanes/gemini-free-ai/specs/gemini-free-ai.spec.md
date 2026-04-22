# Gemini 免费使用双通道 Spec

## 1. 功能需求

- **FR-GEMINI-001**：当项目配置 `ai_provider=gemini` 时，所有现有写作 AI 功能必须使用 Gemini REST API 请求格式，不再走 OpenAI Chat Completions。
- **FR-GEMINI-002**：Gemini API Key 模式允许 endpoint 为空；为空时使用 `https://generativelanguage.googleapis.com/v1beta`。
- **FR-GEMINI-003**：当项目配置 `ai_provider=gemini_cli` 时，写作 AI 请求必须通过 preload IPC 交给主进程 CLI service 执行，不在 renderer 直接 spawn 进程。
- **FR-GEMINI-004**：Gemini CLI service 必须使用应用自有 cwd 与最小 `.gemini/settings.json`，不使用作品目录作为 cwd，不启用 `--yolo`。
- **FR-GEMINI-005**：设置页必须提供「Gemini API Key 免费层」和「Gemini CLI（Google 登录）」两个可选项，并对 API 额度边界给出说明。
- **FR-GEMINI-006**：CLI 未登录、quota / 403、超时、非 JSON 输出等失败路径必须返回稳定中文错误。

## 2. 接口与配置契约

- `AiProvider = openai | gemini | gemini_cli | ollama | custom`
- `ProjectConfig.ai_provider` 保持 TEXT 字段，不迁移数据库。
- 新增 preload IPC：
  - `aiComplete(request)`：主进程执行 provider 请求，目前用于 `gemini_cli`。
  - `aiGetProviderStatus(provider)`：返回 provider 可用性。
  - `aiSetupGeminiCli()`：启动 Gemini CLI 终端式登录流程。
- `gemini` provider 使用 `ai_api_key`，可选 `ai_api_endpoint`，可选 `ai_model`。
- `gemini_cli` provider 不要求 `ai_api_key` 或 `ai_api_endpoint`，可选 `ai_model`。

## 3. 数据流

1. 用户在项目设置选择 AI provider 并保存到 `project_config`。
2. 写作 AI 功能从 config store 读取 provider、key、endpoint、model。
3. `utils/ai/index.ts` 根据 provider 路由：
   - `openai/custom` -> OpenAI-compatible adapter
   - `gemini` -> Gemini REST adapter
   - `ollama` -> Ollama adapter
   - `gemini_cli` -> preload IPC
4. 主进程 Gemini CLI service 将 system/user prompt 合并为纯文本，调用 bundled CLI headless JSON 输出。
5. service 解析 `.response` 并返回统一 `AiResponse`。

## 4. 异常与安全边界

- API Key 缺失：仅对 `openai/custom/gemini` 报配置缺失；`ollama/gemini_cli` 不因 key 为空失败。
- CLI 未安装 / 未打包 / 未登录：返回引导用户完成 Gemini CLI 登录的错误。
- CLI 进程超时：终止进程并返回超时错误。
- CLI stderr / JSON error：映射为中文错误，保留最短必要诊断。
- 不通过 CLI 读取作品目录，不向 CLI 暴露用户数据库路径。

## 5. 验收标准

- **AC-GEMINI-001**：Gemini API Key 模式 endpoint 为空也能构造 Gemini REST 请求。
- **AC-GEMINI-002**：Gemini CLI 模式通过 IPC 调主进程，并能解析 headless JSON `.response`。
- **AC-GEMINI-003**：设置页中 API Key 模式与 CLI 登录模式字段、提示和校验不同。
- **AC-GEMINI-004**：打包配置包含 Gemini CLI unpack 规则，并记录包体积风险。
- **AC-GEMINI-005**：未登录、403/quota、非 JSON、超时均有稳定错误。

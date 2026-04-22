# Gemini 免费使用双通道风险登记

| ID | 风险 | 等级 | 缓解 |
|----|------|------|------|
| R-GEMINI-001 | Gemini CLI 具备本地工具能力，若 cwd 配置错误可能扩大文件访问面 | high | 使用 app-owned cwd，写入最小 settings，禁用/限制 core tools，不启用 yolo |
| R-GEMINI-002 | CLI 登录 / quota / 地区限制由 Google 控制，用户可能误认为证道故障 | medium | 错误映射为清晰中文提示，并说明用户需完成 Gemini CLI 登录 |
| R-GEMINI-003 | `@google/gemini-cli` 包体积约 111MB，增加安装包 | medium | release-plan 记录体积风险，打包 smoke 后记录实际影响 |
| R-GEMINI-004 | Gemini API Key 免费层与网页版会员权益混淆 | medium | 设置页和帮助文案明确两套额度体系 |
| R-GEMINI-005 | 打包后 asar / 路径差异导致 CLI 找不到 | medium | electron-builder `asarUnpack`，新增 provider status 和 packaged smoke |

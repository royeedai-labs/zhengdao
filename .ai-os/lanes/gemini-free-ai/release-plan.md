# Gemini 免费使用双通道交付计划

## 1. 交付前检查

- [x] 需求基准已更新到 `CR-20260421-212847-gemini-free-ai`
- [x] provider routing 测试通过
- [x] Gemini CLI service 测试通过
- [x] `npm test` 通过
- [x] `npm run build` 通过
- [x] macOS dir 打包 smoke 结果已记录
- [x] 安全审计已完成
- [ ] Windows x64 NSIS smoke 在 Windows 环境完成

## 2. 发布影响

- Node 引擎要求提升到 `>=20`。
- 新增 `@google/gemini-cli@0.38.2` 运行依赖，安装包体积会增加。
- macOS `dir` 包中 Gemini CLI unpack 目录约 107M，app 目录约 746M。
- 不新增数据库迁移。
- 不发布新版本，除非用户单独确认 release。

## 3. 回滚触发条件

- 打包后 Gemini CLI 无法定位或无法启动。
- CLI 调用可访问作品目录或出现非预期本地文件副作用。
- OpenAI / Ollama / Gemini API Key 既有路径回归。
- `npm run build` 或核心 AI 单元测试失败。
- Windows 原生环境中 `node-pty` rebuild 或 CLI 启动失败。

## 4. 需人工验证

- 使用真实 Google 账号完成 Gemini CLI 终端式登录。
- 在真实 Windows / macOS 安装包中验证 bundled CLI 可用性。
- 在 Windows runner 或 Windows 真机执行 NSIS packaged smoke。

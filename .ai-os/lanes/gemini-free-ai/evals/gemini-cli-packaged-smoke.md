# Eval: Gemini CLI Packaged Smoke

- **Failure mode**：开发态能调用 Gemini CLI，但打包后 `asar` 路径或 native 依赖导致 CLI 不可定位 / 不可启动。
- **Trigger**：修改 `@google/gemini-cli` 依赖、`electron-builder.config.ts`、asar unpack、release native rebuild 流程。
- **Expected**：打包产物中 `app.asar.unpacked/node_modules/@google/gemini-cli/bundle/gemini.js` 存在，版本 smoke 可输出 `0.38.2` 或清晰记录环境 blocker。
- **Observed**：macOS dir package smoke 已通过；Windows x64 NSIS cross smoke 在 macOS 环境被 `node-pty` cross-compilation 限制阻塞。
- **Guard update**：保留 `verification-matrix.yaml` 中 `FM-GEMINI-001` / `FM-GEMINI-003`，Windows 放行前必须补真实环境 smoke。

# 变更记录：Gemini CLI runtime 解析修复

- **基线 ID**：CR-20260422-003500-gemini-cli-runtime-resolution-fix
- **时间**：2026-04-22 00:35
- **类型**：change / bugfix
- **影响级别**：P2

## 背景

用户在“AI 能力与作品配置 -> 全局账号 -> Gemini CLI”中点击“检测”和“启动登录”时，仍然出现：

- `Electron: bad option: --max-external-pointer-table-size=268435456`
- 无法进入 Gemini CLI 的正常登录/探测流程

此前已经清理了 `NODE_OPTIONS`，但问题仍然存在。

## 根因

- 开发态 Gemini CLI 仍通过 `process.execPath` 启动，即 Electron binary。
- 即使清空 `NODE_OPTIONS`，Electron runtime 在 Gemini CLI 授权探测链路中仍会命中不兼容参数。
- 当前 Electron 开发进程环境里已存在真实 Node 路径：`process.env.NODE` / `process.env.npm_node_execpath`，但代码没有优先使用它。

## 本次基线调整

1. 新增 Gemini CLI runtime 解析规则：
   - 优先 `process.env.NODE`
   - 其次 `process.env.npm_node_execpath`
   - 最后才回退 `process.execPath`
2. `complete()` 与登录脚本生成统一走同一套 runtime 解析。
3. 保持此前 `NODE_OPTIONS` 清理逻辑不变，作为配套防护继续保留。

## 影响范围

- `src/main/ai/gemini-cli-service.ts`
- `src/main/ipc-handlers.ts`
- `src/main/ai/__tests__/gemini-cli-service.test.ts`

## 验证

- `npx vitest run src/main/ai/__tests__/gemini-cli-service.test.ts`
- `npm test`
- `npm run build`
- `git diff --check`

## 备注

- 该修复只解决开发态 Gemini CLI 被 Electron runtime 错误执行的问题。
- 用户侧仍需人工完成 Google 授权与“检测”回刷验证。

# Release Plan

## Scope

- 修复启动 / 重开 / 激活应用时未主动检查更新。
- 修复 HTML 更新日志直出。
- macOS 未签名公开测试包降级到手动下载，避免 ShipIt 自动安装失败。

## Verification Gates

- [x] `npx vitest run src/shared/__tests__/update.test.ts src/main/updater/__tests__/updater-controller.test.ts src/renderer/src/utils/__tests__/update-prompt.test.ts` -> 3 files / 12 tests passed
- [x] `npm run build` -> passed
- [x] `git diff --check` -> passed
- [x] `npm test` -> 36 files / 146 tests passed

## Rollback Conditions

- Windows 自动更新无法从 `available` 进入 `downloading`。
- macOS 更新页仍展示应用内下载 / 安装按钮并可能触发 ShipIt。
- 更新日志仍展示 HTML 标签。
- 启动后反复弹出同一版本更新页。

## Manual Checks

- macOS 公开测试包：发现更新后应显示手动下载入口。
- Windows 安装版：发现更新后仍可下载并安装。

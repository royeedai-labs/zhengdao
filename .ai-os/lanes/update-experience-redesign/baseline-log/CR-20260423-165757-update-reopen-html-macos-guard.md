# CR-20260423-165757-update-reopen-html-macos-guard

> 当前变更记录：修复更新检查触发时机、更新日志 HTML 展示和 macOS 未签名包 ShipIt 安装失败。

- **Type**: bugfix-change
- **Status**: confirmed
- **Confirmed At**: 2026-04-23
- **Approval**: 用户已确认“可执行”
- **Risk Tier**: high
- **Summary**: 应用启动 / 重新打开时必须主动检查更新；更新日志必须展示可读纯文本；当前未签名 macOS 公测包不得继续触发 ShipIt 自动安装。
- **Reason**: 用户反馈点击“关于”才检查更新，导致未关闭应用的已安装用户收不到提示；更新提示日志展示 HTML；重新安装时报 `Code signature ... did not pass validation`。

## 根因

| 问题 | 根因 | 影响 |
|---|---|---|
| 启动或重新打开不检查更新 | updater service 只在首个窗口 `ready-to-show` 后启动一次，`started` 阻止后续窗口 / 激活触发检查 | 长时间未退出应用的用户可能错过新版本提示 |
| 更新日志展示 HTML | shared `releaseNotes` 直接按字符串展示，未处理 GitHub / updater 传来的 HTML | 用户看到不可读日志 |
| macOS 重装 / 更新安装失败 | 当前 release workflow 明确产出未签名公开测试包，但客户端仍允许 Squirrel.Mac / ShipIt 自动安装 | ShipIt 校验签名失败，用户无法通过应用内安装完成更新 |

## 影响分析

| 维度 | 是否受影响 | 说明 |
|---|---|---|
| MISSION | 是 | 更新体验 lane 追加启动 / 重开检查、日志清洗、macOS 门控目标 |
| DESIGN | 是 | 需要补生命周期检查和 macOS 手动下载降级策略 |
| tasks | 是 | 新增 high-risk 修复任务与验证任务 |
| risk-register | 是 | macOS 自动安装涉及签名 / 发布链路，必须登记 |
| release-plan | 是 | 后续发布前必须确认 Windows 自动更新与 macOS 手动下载口径 |
| verification-matrix | 是 | 新增重开检查、HTML 日志、未签名 macOS 自动安装失败 guard |
| code | 是 | `src/shared/update.ts`、`src/main/updater/service.ts`、renderer 更新设置入口 |

## 已确认方案

- 打包版启动和重新打开 / 激活应用时触发去抖更新检查，检查 / 下载 / 安装中不重复触发。
- 更新日志统一清洗为可读纯文本，保留换行和列表语义。
- 当前 macOS 未签名公开测试包发现新版本后只提示手动下载，不再允许应用内下载 / 安装触发 ShipIt。
- Windows NSIS 自动更新路径保持可下载、可安装。

## 验证要求

- `npx vitest run src/shared/__tests__/update.test.ts src/main/updater/__tests__/updater-controller.test.ts src/renderer/src/utils/__tests__/update-prompt.test.ts`
- `npm run build`
- `git diff --check`

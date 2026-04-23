# Risk Register

## R-UPD-001: macOS 未签名包触发 ShipIt 自动安装失败

- **Severity**: high
- **Status**: mitigated
- **Source**: CR-20260423-165757-update-reopen-html-macos-guard
- **Risk**: 当前 GitHub Actions 产出未签名公开测试包，macOS 应用内安装会触发 Squirrel.Mac / ShipIt 签名校验并失败。
- **Impact**: 用户看到“代码不含资源，但签名指示这些资源必须存在”等安装错误，更新链路不可恢复。
- **Mitigation**: 签名 / 公证链路完成前，macOS 发现新版本后降级到手动下载，不允许应用内下载 / 安装。
- **Guard**: `verification-matrix.yaml` 中 `FM-UPD-005`；`npm test` 36 files / 146 tests passed。

## R-UPD-002: 生命周期自动检查过于频繁

- **Severity**: medium
- **Status**: mitigated
- **Source**: CR-20260423-165757-update-reopen-html-macos-guard
- **Risk**: 启动、窗口重开和激活都触发检查，若没有去抖会造成重复网络请求和重复状态广播。
- **Impact**: 更新页反复弹出、用户误以为卡住或网络异常。
- **Mitigation**: 主进程增加生命周期检查去抖，检查 / 下载 / 安装中不重复触发。
- **Guard**: updater focused tests；`npm test` 36 files / 146 tests passed。

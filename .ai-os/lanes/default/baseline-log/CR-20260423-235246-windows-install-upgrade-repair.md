# 变更请求

- **变更标题**：Windows 卸载完整性错误与覆盖安装路径收口
- **提出时间**：2026-04-23 23:52:46 +08:00
- **变更原因**：用户反馈 Windows 卸载时报 `Installer integrity check has failed`，覆盖安装后打开仍是老版本。排查显示 NSIS 完整性错误发生在安装/卸载脚本执行前，通常意味着当前运行的 installer / uninstaller 二进制损坏；覆盖安装仍为老版的主要配置风险是 assisted installer 允许用户修改安装目录，导致新版安装到另一目录而旧快捷方式 / 固定入口仍指向旧目录。
- **优先级**：P0
- **治理档位**：high-risk

## 变更内容

- [变更] Windows NSIS assisted installer 不再允许修改安装目录，覆盖安装必须复用既有注册表安装路径或默认路径
- [新增] 显式保留用户数据，不在卸载时删除 `userData` / 数据库
- [新增] 稳定卸载显示名，避免控制面板按版本号生成多义入口
- [新增] 安装器配置测试 guard 与发布说明中的 Windows 覆盖安装 / 卸载恢复检查项

## 影响分析

| 维度 | 是否受影响 | 说明 |
|------|------------|------|
| MISSION | 是 | 当前目标扩展为 Windows 安装 / 卸载 / 覆盖安装可靠性 |
| DESIGN | 是 | 安装目录策略从“用户可选”收口为“覆盖安装路径固定” |
| spec | 是 | 补安装器目录、卸载显示名、用户数据保留契约 |
| tasks | 是 | 新增 high-risk 安装器修复任务 |
| risk-register | 是 | 记录安装目录分叉、旧卸载器损坏、用户数据保护风险 |
| release-plan | 是 | 补 Windows installer 实机验收和回滚条件 |
| tests | 是 | 补 electron-builder NSIS 配置 guard |
| memory | 否 | 当前不回写共享 memory |

## 新增风险 / blocker

- 旧版本控制面板卸载器如果已经损坏，新版安装器无法修复那个旧的坏 `Uninstall*.exe`；需要人工删除旧安装目录和卸载注册表残留，或使用系统安装疑难解答工具清理条目
- 如果用户此前同时装过 per-user 与 per-machine 两份证道，仍需先人工确认实际启动入口指向哪份安装
- 必须明确不删除用户数据，避免卸载恢复步骤误删作品数据库

## 后续动作

- 更新当前 lane Mission / Design / spec / tasks / risk register / release plan / verification matrix / STATE
- 修改 `electron-builder.config.ts` 的 NSIS 安装目录与卸载显示策略
- 补 `scripts/release/electron-builder-config.test.ts`
- 跑配置测试、相关桌面壳层测试、生产构建与 `git diff --check`

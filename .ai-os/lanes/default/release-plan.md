# 证道发布计划

## Windows 安装 / 覆盖安装修复计划

> 本节记录 2026-04-23 的 `CR-20260423-235246-windows-install-upgrade-repair`。该修复属于 high-risk，因为它影响 Windows 安装目录、卸载入口和用户数据保护。

### 1. 交付前检查

- [x] 用户确认 Windows 卸载错误与覆盖安装仍为老版问题可执行
- [x] high-risk CR 已记录：`CR-20260423-235246-windows-install-upgrade-repair`
- [x] 风险登记已补：安装目录分叉、旧卸载器损坏、用户数据保护
- [x] `electron-builder.config.ts` 已禁止修改安装目录
- [x] `deleteAppDataOnUninstall` 明确为 `false`
- [x] `npm test -- scripts/release/electron-builder-config.test.ts` 已通过
- [x] `npm run build` 已通过
- [x] `git diff --check` 已通过
- [ ] Windows 覆盖安装实机 smoke 完成
- [ ] Windows 旧损坏卸载器恢复路径人工确认

### 2. 发布步骤

1. [AI 已执行] 排查 NSIS 完整性错误与覆盖安装路径风险。
2. [AI 已执行] 收口 NSIS 安装目录、快捷方式和卸载显示配置。
3. [AI 已执行] 补安装器配置测试与发布说明恢复步骤。
4. [AI 已执行] 运行 `npm test -- scripts/release/electron-builder-config.test.ts`。
5. [AI 已执行] 运行 `npm run build` 与 `git diff --check`。
6. [需人工执行] 在 Windows 上用新版安装包覆盖安装旧版，确认开始菜单 / 桌面快捷方式打开新版本。
7. [需人工执行] 对旧损坏卸载器场景按 `RELEASING.md` 恢复步骤清理，不删除用户数据。

### 3. 回滚触发条件

- 新版 Windows installer 无法正常安装。
- 覆盖安装后快捷方式仍指向旧目录。
- 卸载流程误删用户数据目录或 `zhengdao.db`。

---

## v1.2.4 本地未提交改动发布收口

> 本节记录 2026-04-23 的 `v1.2.4` patch release。该版本纳入当前已验证的本地未提交改动：AI-OS v9 交付治理迁移、工作区与主题视觉收口、AI 助手入口拖动、关系图谱布局修复和发布说明补齐。

### 1. 交付前检查

- [x] 用户明确要求发新版 Release
- [x] high-risk 发布 CR 已记录：`CR-20260423-001100-v1.2.4-release-local-changes`
- [x] 风险登记已补：大量 dirty worktree 发布、Release 正文缺失风险
- [x] 版本号已准备升至 `1.2.4`
- [x] `CHANGELOG.md` 已补 `v1.2.4` 更新日志
- [x] `npm test` 已通过：32 files / 125 tests
- [x] `npm run build` 已通过
- [x] `npm run lint` 已通过
- [x] `git diff --check` 已通过
- [x] Git commit 已创建：`e0e57c3 release: v1.2.4`
- [x] `v1.2.4` tag 已创建并推送
- [x] GitHub Actions release workflow 已通过：`build-macos`、`build-windows`、`publish-release-notes`
- [x] GitHub Release 正文和 8 个发布资产已远端复核

### 2. 本次发布范围

- AI-OS v9 canonical layout：根共享 `.ai-os/MISSION.md` / `.ai-os/memory.md` + lane 工件，旧 `.agents/` / `.cursor/` 分发工件移除。
- 默认跟随系统主题、冷白浅色、低饱和深色和语义色 token。
- 工作区顶栏工具折叠、左右栏宽度、右侧 tab、本地 UI 偏好持久化。
- 核心弹窗、侧栏、底栏、AI 助手等 UI 表面接入主题变量。
- AI 助手悬浮入口可拖动，展开态移除独立浮动关闭按钮。
- 关系图谱 canvas 尺寸反馈循环修复。

### 3. 发布步骤

1. [AI 已执行] 审计本地 dirty worktree 并按变更组归类。
2. [AI 已执行] 补 high-risk CR、risk register、verification matrix、release plan。
3. [AI 已执行] 更新 `package.json`、`package-lock.json`、`CHANGELOG.md` 到 `v1.2.4`。
4. [AI 已执行] 运行 `npm test` 与 `npm run build`。
5. [AI 已执行] 运行 `npm run lint` 与 `git diff --check`。
6. [AI 已执行] 提交 `release: v1.2.4`。
7. [AI 已执行] 创建并推送 `v1.2.4` tag。
8. [AI 已执行] 等待 GitHub Actions release workflow 产出安装包与自动更新元数据。
9. [AI 已执行] 复核 GitHub Release 正文和资产清单。

### 6. 发布后远端证据

- Release URL: `https://github.com/royeedai/zhengdao/releases/tag/v1.2.4`
- Actions run: `https://github.com/royeedai/zhengdao/actions/runs/24789432868`
- Release 正文：`bodyLength=1956`，`hasRequiredBody=true`
- 资产复核：`assetsComplete=true`
- 资产清单：
  - `zhengdao-1.2.4-x64-setup.exe`
  - `zhengdao-1.2.4-x64-setup.exe.blockmap`
  - `zhengdao-1.2.4-arm64.dmg`
  - `zhengdao-1.2.4-arm64.dmg.blockmap`
  - `zhengdao-1.2.4-arm64.zip`
  - `zhengdao-1.2.4-arm64.zip.blockmap`
  - `latest.yml`
  - `latest-mac.yml`

### 4. 回滚触发条件

- `npm test` 或 `npm run build` 失败且无法在本次范围内修复。
- GitHub Actions release workflow 未产出 Windows installer、macOS dmg / zip 或 `latest*.yml`。
- GitHub Release 正文缺少更新日志、安装包清单、自动更新元数据、验证状态或回滚提示。
- 新版安装包启动失败或自动更新元数据明显异常。

### 5. 需人工执行

- 撤销或轮换此前在对话中暴露的 GitHub token。
- 在真实 Windows 安装环境确认顶栏、DPI、开始菜单 / 快捷方式图标和安装器观感。

---

# 证道 Windows 壳层 / 图标收口发布计划

> 当前文件聚焦 Windows 安装版的桌面壳层和品牌图标收口。目标是让 Windows 正式包看起来像正式客户端，而不是默认 Electron 样例程序。

## 1. 交付前检查

- [x] 需求基准已更新到 `CR-20260421-000000-windows-shell-brand-polish`
- [x] 当前代码主链路验证证据已存在：`npm test`、`npm run build`
- [x] 项目原生静态校验证据已记录：`npm run build`
- [x] Windows 主窗口壳层已收口
- [x] Windows / Linux 菜单移除已生效
- [x] 品牌标题已统一为 `证道`
- [x] `icon.ico` / `icon.icns` 已生成并接入 builder
- [x] Windows / macOS 打包 smoke 已通过

## 2. 变更范围与依赖

- 本次交付覆盖：
  - Windows 主窗口壳层
  - 应用菜单移除策略
  - 顶栏品牌头收口
  - 应用命名统一
  - 正式图标资源与打包配置
- 本次明确不包含：
  - Linux 自定义标题栏
  - macOS 窗口壳层重做
  - 品牌官网 / 宣传素材
- 依赖：
  - Electron 平台窗口能力
  - 本地图标处理命令
  - `electron-builder`

## 3. 发布步骤

1. [AI 已执行] 写失败测试，锁定平台壳层配置、菜单策略和品牌标题规则
2. [AI 已执行] 实现 Windows 主窗口壳层与菜单移除
3. [AI 已执行] 收口书架页和工作区顶栏品牌头
4. [AI 已执行] 生成并接入正式图标资源
5. [AI 已执行] 执行 `npm test`、`npm run build` 与打包 smoke
6. [AI 已执行] 发布 `v1.1.5` 到 GitHub Releases，并确认 Windows / macOS 构建 job 通过
7. [需人工执行] 在真实 Windows 安装版上人工确认任务栏、开始菜单和安装器图标显示

## 4. 运行态验证

- [x] `npm test` 通过
- [x] `npm run build` 通过
- [x] Windows 壳层配置测试通过
- [x] Windows / macOS 打包 smoke 通过
- [x] GitHub Actions `release` workflow 通过：`v1.1.5` macOS / Windows jobs 均为 success
- [x] GitHub Release `v1.1.5` 已上传 Windows 安装包、macOS dmg/zip、blockmap、`latest.yml`、`latest-mac.yml`
- [x] `v1.1.5` macOS zip 已下载抽检，包内 `better-sqlite3` 可被 Electron runtime 加载并完成内存 SQLite 查询
- [x] `v1.1.5` macOS dmg 已下载并只读挂载抽检，DMG 内 app 的 `better-sqlite3` 可被 Electron runtime 加载并完成内存 SQLite 查询
- [ ] Windows 安装版人工视觉回归完成
- [x] fallback 证据未被误当正式结论：源码实现通过不等于正式安装包观感已放行

## 5. 回滚触发条件

- Windows 顶栏操作区被原生窗口按钮覆盖
- Windows 安装后仍出现默认 Electron 图标
- Windows 仍显示默认菜单栏
- macOS 窗口交互因壳层改动出现回退

## 6. 交付说明与移交

- AI 已完成：
  - 在线更新和正式打包能力已具备
  - GitHub Release `v1.1.5` 已发布，下载包和自动更新元数据已上传
- AI 待完成：
  - 等待真实 Windows 安装环境人工视觉确认
- 需人工执行：
  - 在真实 Windows 安装版上确认任务栏 / 开始菜单 / 桌面快捷方式图标
- 已知风险和后续待办：
  - macOS 仍只同步图标与命名，不调整当前窗口壳层
  - macOS 自动更新正式上线仍需要签名与公证链路
  - 早期失败 tag / release（`v1.1.0`、`v1.1.1`、`v1.1.2`、`v1.1.4`）如需清理，应单独确认后再删除

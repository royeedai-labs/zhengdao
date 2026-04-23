# Windows 安装版桌面壳层与品牌图标 Spec

## 1. 模块概述

- **模块目标**：把 Windows 安装版证道从默认 Electron 外观收口为正式客户端，并补齐正式品牌图标资源
- **所属阶段**：build / verify / ship
- **关联 Mission / Design**：`MISSION.md` 当前基线 `CR-20260421-000000-windows-shell-brand-polish`
- **关联需求点 ID / 标题**：
  - `REQ-SHELL-001` Windows 主窗口壳层与菜单移除
  - `REQ-SHELL-002` 品牌标题统一
  - `REQ-SHELL-003` 顶栏视觉收口
  - `REQ-SHELL-004` 图标与打包资源接入
  - `REQ-SHELL-005` Windows 系统托盘图标与显式退出路径
  - `REQ-SHELL-006` Windows 覆盖安装路径固定与卸载恢复

## 2. 业务规则与目标

- **核心规则**：
  - Windows 主窗口不再显示 `File / Edit / View / Window / Help`
  - Windows 顶栏视觉改由应用自己承接，但必须保留原生窗口行为
  - 应用对外名称统一为 `证道`
  - 品牌图标必须产出 `svg + ico + icns`
  - Windows 运行态必须创建系统托盘图标，且托盘菜单提供显示、隐藏和退出
  - Windows 覆盖安装不得允许用户改到另一个安装目录，卸载恢复不得删除用户作品数据
  - macOS 只同步图标和命名，不改现有 `hiddenInset` 方案
- **必须优先保证的正确性**：Windows 窗口行为不回退、安装后图标生效、顶栏操作区不与原生窗口按钮冲突
- **允许延后处理的细节**：更完整品牌体系、Linux 自定义标题栏、官网宣传素材
- **本轮非目标 / 禁止越界项**：不做裸 `frame:false` 无边框实现，不改业务交互逻辑

## 3. 界面 / 接口 / 命令清单

- **交互模式**：native-window + app-owned title chrome
- **推荐模式理由**：保持 Windows 原生窗口行为，同时把标题栏视觉交给应用统一控制
- **拒绝的交互模式**：裸 `frame:false` 自己重造整套窗口系统

| 编号 | 类型 | 名称 | 描述 | 验收点 |
|------|------|------|------|--------|
| I-SHELL-001 | 主进程窗口配置 | main window options | Windows 使用隐藏标题栏与 overlay，macOS 保持 `hiddenInset` | AC-SHELL-001 |
| I-SHELL-002 | 菜单策略 | application menu removal | Windows / Linux 移除默认菜单，macOS 保留 | AC-SHELL-001 |
| I-SHELL-003 | UI | 书架页 / 工作区顶栏 | 正式品牌头、Windows 原生按钮留白、无 `Pro` 标识 | AC-SHELL-003 |
| I-SHELL-004 | 命名 | `title` / HTML title / productName | 应用对外名称统一为 `证道` | AC-SHELL-002 |
| I-SHELL-005 | 打包资源 | `icon.svg` / `icon.ico` / `icon.icns` | 正式品牌图标资源 | AC-SHELL-004 |
| I-SHELL-006 | Builder 配置 | `electron-builder.config.ts` | 应用、安装器、卸载器与快捷方式图标统一 | AC-SHELL-004 |
| I-SHELL-007 | 主进程托盘 | Electron `Tray` | Windows 通知区域显示证道图标，菜单可显示 / 隐藏 / 退出 | AC-SHELL-005 |
| I-SHELL-008 | NSIS 安装策略 | `electron-builder.config.ts` | 固定覆盖安装路径、稳定卸载入口、不删除用户数据 | AC-SHELL-006 |

## 4. 关键流程与状态流转

1. 主进程根据平台生成主窗口壳层配置
2. Windows 主窗口使用隐藏标题栏与 overlay，让 renderer 顶栏承接视觉 chrome
3. 应用创建窗口时，在 Windows / Linux 统一移除默认应用菜单
4. renderer 顶栏根据平台给左 / 右留白，避免与 mac 红绿灯或 Windows 系统按钮冲突
5. 书架页和工作区品牌头统一为正式品牌头，去掉 `Pro`
6. 打包前生成 `svg + ico + icns` 图标资源，`electron-builder` 与 BrowserWindow 同步接入
7. Windows 运行态创建托盘图标，关闭主窗口隐藏到托盘，用户通过托盘菜单显式退出
8. Windows 覆盖安装复用既有安装路径，快捷方式指向升级后的安装目录
9. 构建正式产物后验证窗口标题、菜单、图标、托盘入口和覆盖安装路径都已生效

## 5. 数据与契约

- **契约基准**：
  - 应用名：`证道`
  - Windows 主窗口菜单：隐藏
  - Windows 系统托盘：运行态创建，关闭主窗口隐藏到托盘，显式退出才真正退出
  - Windows NSIS 覆盖安装：不展示目录选择页，不删除用户数据，卸载显示名稳定为 `证道`
  - 图标资源：`resources/icon.svg`、`resources/icon.ico`、`resources/icon.icns`
- **输入**：
  - 当前平台
  - 主窗口 preload 路径
  - 图标资源路径
- **输出**：
  - 平台化主窗口壳层配置
  - 顶栏留白规则
  - 托盘菜单与窗口显示 / 隐藏 / 退出规则
  - 安装器路径和卸载恢复规则
  - 安装包与应用图标资源
- **关键字段 / 状态枚举**：
  - `platform`: `darwin | win32 | linux`
  - `title`: `证道`
  - `stripNativeMenu`: boolean
  - `trayEnabled`: boolean
  - `allowToChangeInstallationDirectory`: false
  - `deleteAppDataOnUninstall`: false
- **字段映射/适配说明**：
  - Windows：`titleBarStyle: hidden` + overlay
  - macOS：`titleBarStyle: hiddenInset`
  - Linux：保留原生窗口，但移除应用菜单
- **共享层 / 包装层副作用审计**：
  - 不新增业务 IPC
  - 只扩展窗口配置与 renderer 顶栏留白逻辑
- **集成触点**：
  - `src/main/index.ts`
  - `src/main/desktop-tray.ts`
  - `src/main/ipc-handlers.ts`
  - `src/renderer/src/components/layout/TopBar.tsx`
  - `src/renderer/src/components/bookshelf/BookshelfPage.tsx`
  - `src/renderer/index.html`
  - `electron-builder.config.ts`
- **路由 / 入口契约对照**：无新增页面路由
- **Schema / 存储一致性说明**：不新增数据库 schema
- **持久化 / 外部依赖**：本地图像处理命令、Electron 平台窗口能力
- **受影响模块 / 文件边界**：主进程窗口配置、renderer 顶栏、打包资源、builder 配置

## 6. 边界条件与异常处理

- Windows overlay 顶栏若留白不足：顶栏按钮会被原生窗口按钮覆盖
- 只移除主窗口菜单：辅助窗口仍可能露出开发味菜单
- 只替换 HTML 标题不替换窗口 title：任务栏与窗口标题不一致
- 只替换 SVG 不生成 `ico/icns`：安装后仍显示默认 Electron 图标
- 只配置窗口 / 安装器图标但不创建 `Tray`：Windows 右下角通知区域不会显示应用图标
- 托盘菜单没有退出入口：用户关闭窗口后无法明确退出后台进程
- 允许修改安装目录：覆盖安装可能写到新目录，旧快捷方式或固定入口仍打开老版本
- 旧卸载器损坏：NSIS 完整性校验在脚本运行前失败，需要手动恢复而不是删除用户数据
- macOS：只同步命名和图标，不改变现有窗口交互

## 7. 验收与证据

- **关键用户任务 / 运营任务验证**：
  - Windows 安装版启动后不再显示默认应用菜单
  - 窗口顶部不再出现白色系统菜单条与深色内容区割裂
  - 任务栏 / 快捷方式 / 安装器显示正式品牌图标
  - Windows 运行后右下角通知区域显示证道托盘图标，关闭主窗口后可从托盘恢复或退出
  - Windows 覆盖安装后开始菜单 / 桌面快捷方式打开新版本，卸载恢复说明保护用户数据库
- **设计一致性证据**：书架页和工作区顶栏品牌头一致，无 `Pro` 标识
- **逻辑正确性证据**：平台壳层配置测试、菜单移除测试、品牌标题与 inset 规则测试
- **工程质量证据**：`npm test`、`npm run build`
- **运行态证据**：Windows / macOS 最小打包 smoke
- **异常/空数据证据**：Windows / macOS 平台差异、无图标资源、窗口按钮留白冲突
- **最小验证步骤**：
  - `npm test`
  - `npm run build`
  - Windows 打包 smoke
  - macOS 打包 smoke
- **回归范围**：主窗口创建、辅助窗口菜单、顶栏交互、打包图标资源

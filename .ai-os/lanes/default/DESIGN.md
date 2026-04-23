# Windows 壳层与默认交付线 Design

> 当前追加产品交付基线：`CR-20260423-125929-system-settings-ia`。
> 该基线只收口系统级设置入口，不改变主进程窗口壳层、数据库 schema 或同步 / 更新底层语义。
>
> 历史壳层基线：`CR-20260421-000000-windows-shell-brand-polish`。
> `CR-20260422-213129-ai-os-v9-upgrade` 只升级 AI-OS 交付治理工件，不改变产品需求或业务源码。
> 2026-04-23 bugfix 基线：`CR-20260423-232158-windows-tray-icon` 补齐 Windows 运行态系统托盘图标，不做任务栏自动固定。
> 2026-04-23 high-risk bugfix 基线：`CR-20260423-235246-windows-install-upgrade-repair` 固定 Windows 覆盖安装路径，并记录卸载器完整性错误恢复步骤。

## 1. 设计目标

- **本轮设计目标**：Windows 安装版摆脱默认 Electron 外观，移除默认菜单，统一窗口标题为 `证道`，补齐正式图标资源，并保持 macOS 窗口行为不回退。
- **需要先锁定的关键页面 / 交互**：Windows 主窗口 chrome、renderer 顶栏安全区、书架页与工作区品牌头、打包图标资源。
- **必须用户确认的核心设计决策**：Windows 使用隐藏标题栏 + 自定义顶栏，不走裸 `frame:false`；macOS 只同步图标和命名。
- **允许 AI 自行处理的非核心细节**：CSS 变量、图标资源路径、构建脚本校验、测试断言组织。
- **允许后补的细节**：Windows 实机 DPI 观感、开始菜单 / 快捷方式图标最终人工验收。

## 2. 信息架构

- **入口与导航骨架**：Electron 主窗口承载书架页与写作工作区；顶栏负责品牌、导航和窗口拖拽区域。
- **一级 / 二级结构**：书架入口、工作区入口、顶部操作区、系统窗口按钮安全区。
- **关键上下文切换点**：书架页进入作品、工作区内顶部操作、窗口平台差异。
- **关键信息优先级**：正式品牌识别 > 原生窗口行为稳定 > 顶栏操作可用性 > 平台一致性。

## 3. 关键页面与交互

| 页面 / 入口 | 目标 | 关键元素 | 关键操作 | 是否核心决策 | 确认状态 |
|-------------|------|----------|----------|--------------|----------|
| Windows 主窗口 | 移除默认菜单和白色标题栏割裂感 | BrowserWindow 配置、菜单策略、窗口标题 | 启动、最大化、拖拽、缩放 | yes | confirmed |
| 书架页顶栏 | 展示正式品牌头 | 应用名、顶部操作、拖拽区域 | 新建作品、打开作品、帮助 | yes | confirmed |
| 工作区顶栏 | 保持操作可用且避开系统按钮 | `drag-region` / `no-drag`、右侧安全区 | 保存、更新、帮助、窗口拖拽 | yes | confirmed |
| 打包资源 | 安装器、任务栏、快捷方式使用正式图标 | `resources/icon.*`、builder config | Windows / macOS package smoke | yes | confirmed |
| Windows 系统托盘 | 运行态在通知区域显示证道入口 | Electron `Tray`、托盘菜单、关闭隐藏规则 | 显示、隐藏、退出 | yes | confirmed |
| Windows 覆盖安装 | 避免新旧安装目录分叉 | NSIS 安装目录、快捷方式、卸载显示名 | 覆盖安装、卸载恢复 | yes | confirmed |

## 4. 关键流程

1. 用户启动 Windows 安装版。
2. 主进程创建隐藏标题栏窗口，移除 Windows / Linux 默认菜单，并设置正式标题与图标。
3. renderer 顶栏提供品牌、操作按钮和拖拽区域，同时为原生窗口按钮预留安全区。
4. Windows 主进程创建系统托盘图标；关闭主窗口默认隐藏到托盘，托盘菜单提供显式退出。
5. Windows 安装器复用既有注册表安装路径，不展示目录选择页；卸载配置不删除用户数据。
6. 打包流程把 `ico` / `icns` / PNG 资源写入安装器与应用包；macOS 保留既有窗口行为。

## 5. 视觉方向

- **视觉参考**：正式桌面创作工具，而不是默认 Electron 开发壳。
- **信息密度 / 布局原则**：顶栏紧凑、操作明确、保留足够拖拽区域。
- **组件与交互风格**：沿用现有深色主题和按钮体系，不引入新 UI 框架。
- **明确不采用的风格**：裸无边框全自绘窗口、营销式大标题、破坏现有工作区布局的重做。
- **与既有设计系统或参考对象的差异**：只收口壳层和品牌，不重构业务面板。

## 6. 设计确认记录

- 2026-04-21：用户确认 Windows 壳层、品牌标题和图标资源收口方案，可按 P1 change 进入实现。
- 2026-04-22：用户确认 AI-OS v9 官方升级和全量 lane 规范化；该确认只影响交付治理工件，不改变 Windows 壳层产品基线。
- 2026-04-23：用户确认系统级入口收口方案：应用设置承接外观、Google 账号 / 云同步、更新 / 关于；快捷键、备份与迁移暂不迁移。
- 2026-04-23：用户补充确认 AI 全局账号也应进入应用设置；作品级 AI 配置不再承载全局账号管理。
- 2026-04-23：用户确认 Windows 右下角通知区域缺失 bug 可执行修复；本轮只补系统托盘，不做 Windows 任务栏自动固定。
- 2026-04-23：用户确认 Windows 卸载 NSIS 完整性错误与覆盖安装仍为老版问题可执行修复；本轮不删除用户数据，先收口安装目录分叉风险并补恢复说明。

## 6.1 系统设置入口设计

| 页面 / 入口 | 目标 | 关键元素 | 关键操作 | 确认状态 |
|-------------|------|----------|----------|----------|
| 应用设置 / 外观 | 恢复主题入口 | `THEME_IDS`、当前主题、主题标签 | 切换并持久化主题 | confirmed |
| 应用设置 / 账号与云同步 | 承接 Google 账号和云备份 | 登录表单、账号卡、同步开关、手动上传、云端列表 | 登录、退出、上传、刷新 | confirmed |
| 应用设置 / AI 全局账号 | 承接所有 AI provider 账号 | OpenAI 兼容、Gemini API Key、Gemini CLI、Ollama、自定义兼容 | 新建、编辑、删除、检测、启动登录 | confirmed |
| 应用设置 / 更新与关于 | 保留现有更新能力 | 当前版本、更新状态、更新日志、下载 / 安装按钮 | 检查、下载、安装 | confirmed |
| 工作区标题栏 | 只保留工作区操作和系统设置入口 | 云状态只读提示、应用设置按钮 | 打开应用设置 | confirmed |

- **共享层副作用**：`AppSettingsModal` 会消费 `ui-store` 主题状态、`auth-store` 账号状态、AI 账号 IPC 和 `update-store` 更新状态；不新增 IPC。
- **状态流转**：更新自动弹窗通过 `openModal('appSettings', { tab: 'updates' })` 进入更新页；常规应用设置入口默认进入外观页。
- **边界**：项目设置继续承载当前作品题材、AI 入口、日更、快捷键、备份与迁移；AI 能力与作品配置继续承载作品 AI 档案与能力卡；AI 全局账号进入应用设置。

## 7. 差异与待确认项

- **相对参考对象的明确差异**：macOS 不跟随 Windows 做壳层重写，仅同步图标和命名。
- **仍待确认的设计项**：真实 Windows 安装环境下 125% / 150% DPI 的顶栏按钮与系统按钮是否重叠。
- **执行边界与非目标**：不做 Linux 壳层、官网品牌页、签名 / notarization 自动化。

## 8. 方案选型依据

- **为什么选择当前方案**：隐藏标题栏保留系统窗口按钮和平台行为，风险低于全自绘无边框窗口。
- **备选方案与放弃原因**：裸 `frame:false` 会增加拖拽、缩放、吸附和系统按钮重建成本，本轮不采用。
- **与需求基准的对应关系**：对应 `REQ-SHELL-001` 到 `REQ-SHELL-004`，验收入口见下方从旧 `acceptance.yaml` 合并的门禁。

## 9. 核心约束

- **必须遵守的技术 / 产品约束**：不破坏窗口拖拽、最大化、缩放、更新按钮、帮助入口和书架 / 工作区主路径。
- **共享基础设施约定**：BrowserWindow、Electron Tray、renderer 顶栏、HTML title、builder icon 配置、NSIS 安装 / 卸载策略属于共享面；改动后必须跑项目原生构建。
- **共享层 / 通用抽象副作用清单**：影响主窗口创建、菜单策略、托盘生命周期、顶栏布局、打包资源、Windows 安装路径与快捷方式更新策略。
- **路由 / 入口契约对照**：书架进入作品和显式总览入口不应受壳层改造影响。
- **Schema / 存储一致性说明**：本 lane 不改数据库 schema。
- **同仓正常实现对照**：现有 macOS `hiddenInset` 行为保留；现有 `drag-region` / `no-drag` 模式继续使用。
- **不可越过的范围边界**：不顺手重构业务逻辑或全站视觉体系。
- **依赖前提**：Electron 平台窗口能力、`electron-builder` 图标注入、本地图标资源生成工具链。

## 10. 风险与注意事项

- **主要风险**：系统窗口按钮与应用按钮重叠；图标只在源码生效但安装器未生效；macOS 窗口行为被误改；关闭窗口隐藏到托盘后必须保留显式退出入口；Windows 覆盖安装路径分叉；旧卸载器损坏导致控制面板卸载失败。
- **注意事项**：Windows 实机观感仍需人工验收；打包后 native module ABI 状态需单独确认。
- **触发升级到 change-request / review 的条件**：需要重做窗口 chrome、引入签名 / notarization 自动化、改变作品入口或 AI provider 行为。

## 验收标准（从 lanes/default/acceptance.yaml 合并）

```yaml
version: 4
baseline_id: "CR-20260421-000000-windows-shell-brand-polish"
scope:
  mode: "change"
  focus: "windows-shell"
  baseline_source: "MISSION.md + specs/example.spec.md"
  change_control: "all requirement changes must go through /change-request"
  quality_tier: "standard"
  primary_spec: "specs/example.spec.md"
  confirmed_stack_decisions: "Electron desktop app + Windows hidden title bar shell + packaged icon resources"
  target_runtime: "packaged Windows desktop app with formal shell and brand icon"
  dev_fallback: "local build and package smoke"

required_special_reviews: []

gates:
  - id: design-confirmation
    title: "设计确认门"
    status: completed
    checks:
      - "Windows 壳层、品牌命名和正式图标已纳入基线"
      - "Windows 走隐藏标题栏，不走裸 frame:false 已确认"
      - "macOS 只同步图标和命名，不重做窗口壳层"
    evidence:
      - "CR-20260420-232439-open-source-release-hardening"
      - "MISSION.md"
      - "specs/example.spec.md"

  - id: logic-confirmation
    title: "逻辑确认门"
    status: completed
    checks:
      - "Windows / Linux 菜单移除、macOS 保留菜单的策略已锁定"
      - "品牌标题统一为证道已锁定"
      - "图标资源必须补齐 ico / icns 已锁定"
      - "Windows 顶栏需要为原生按钮留白已确认"
    evidence:
      - "specs/example.spec.md"
      - "MISSION.md"

  - id: implementation-quality
    title: "实现质量门"
    status: completed
    checks:
      - "Windows 壳层配置和品牌标题规则具备自动化测试"
      - "主窗口壳层、菜单移除和顶栏视觉已实现"
      - "图标资源与 builder 接入已完成"
      - "项目原生静态校验已完成"
      - "最小打包 smoke 已通过"
    evidence:
      - "npm test"
      - "npm run build"
      - "src/main/index.ts"
      - "src/renderer/src/components/layout/TopBar.tsx"
      - "resources/icon.ico"

  - id: delivery-readiness
    title: "交付质量门"
    status: in_progress
    checks:
      - "Windows 安装版启动后不再出现默认菜单"
      - "Windows 窗口标题已统一为证道"
      - "Windows 安装器与任务栏图标已替换"
      - "macOS 窗口行为未回退"
      - "顶栏按钮与原生窗口按钮无冲突"
    evidence:
      - "windows package smoke"
      - "release-plan.md"
      - "artifact proof"

  - id: parity-gate
    title: "对照一致性门"
    status: not_applicable
    checks:
      - "非 reverse-spec 任务"
    evidence: []

result:
  design_locked: passed
  logic_locked: passed
  implementation_ready: passed
  delivery_ready: pending
  blockers:
    - "Windows 安装版视觉与图标仍待新的打包验证"
  advisories:
    - "macOS 只同步图标与命名，不改变当前窗口交互"
  user_confirmation_blockers: []
```

# 应用更新体验重构 Design

> 当前 lane 的交付基线为 `CR-20260423-013500-update-experience-redesign`。

## 1. 设计目标

- **本轮设计目标**：消除“更新中…”卡死感，把更新流程改成用户可理解、可重试、可重新进入的完整闭环。
- **需要锁定的关键页面 / 交互 / 接口**：全局“应用设置 / 关于”模态页、shared update 状态机、main updater service / controller、preload / IPC。
- **核心设计决策**：自动检查但手动下载；更新入口从标题栏按钮迁移到全局模态页；安装失败 15 秒回退到可重试状态。
- **确认状态**：confirmed。

## 2. 信息架构

- **全局入口**：书架页和工作区标题栏新增“应用设置 / 关于”入口。
- **模态页内容**：应用品牌 / 当前版本、手动检查更新、状态驱动的下载 / 安装动作、更新日志和错误反馈。
- **状态来源**：主进程 `autoUpdater` 事件驱动 shared snapshot，renderer 只消费 `UpdateSnapshot`。

## 3. 关键流程

1. 应用启动后在打包版后台自动检查更新，开发态保持不触发在线更新。
2. 若发现新版本，shared snapshot 进入 `available`，renderer 自动打开“应用设置 / 关于”并展示更新详情。
3. 用户点击“下载更新”后，snapshot 进入 `downloading`，关闭模态页不影响后台下载。
4. 下载完成后 snapshot 进入 `ready`，用户可在同一入口执行“立即安装”。
5. 安装时 snapshot 进入 `installing`；若 15 秒后进程仍存活，则回退成 `ready + errorMessage`，提示用户手动关闭应用后重试。

## 4. 共享基础设施审计

- **受影响共享面**：`src/shared/update.ts`、`src/main/updater/*`、`src/main/ipc-handlers.ts`、`src/preload/index.ts`、renderer modal / store / top bar、README / SUPPORT / Help 文案。
- **共享契约变化**：`UpdateStatus` 新增 `available` 和 `installing`；preload / IPC 新增 `checkForUpdates`、`downloadUpdate`、`getAppVersion`。
- **持久化决策**：自动弹框去重版本写入 `app_state.update_prompted_version`，不写 `localStorage`。
- **副作用清单**：打包版更新行为改变；工作区与书架页标题栏入口调整；帮助和支持文案需要同步改口径。

## 5. 风险与验证

- **主要风险**：`autoUpdater` 事件顺序与手动下载切换不一致；安装失败后 UI 仍留在不可恢复状态；书架页缺少全局入口。
- **验证 guard**：`quitAndInstall()` 未触发退出时，15 秒后 UI 必须恢复为可重试状态；同版本自动弹框只触发一次。

## 6. 验收标准

```yaml
baseline_id: "CR-20260423-013500-update-experience-redesign"
gates:
  design_confirmation:
    status: passed
    evidence:
      - "用户确认发现即弹框、手动下载、全局应用设置入口和 15 秒安装回退策略"
  logic_confirmation:
    status: passed
    evidence:
      - "shared update 状态机扩展为 idle/checking/available/downloading/ready/installing/error"
      - "autoUpdater 改为 autoDownload=false，downloadUpdate 由用户动作显式触发"
      - "update_prompted_version 写入 app_state，避免同版本重复自动弹框"
  implementation_quality:
    status: passed
    evidence:
      - "npx vitest run src/shared/__tests__/update.test.ts src/main/updater/__tests__/updater-controller.test.ts src/renderer/src/utils/__tests__/install-update.test.ts src/renderer/src/utils/__tests__/update-prompt.test.ts"
      - "npm test -> 32 files / 127 tests passed"
      - "npm run build passed"
  delivery_quality:
    status: passed
    evidence:
      - "README / SUPPORT / Help 文案已改为“自动检查 + 手动下载 + 应用设置 / 关于安装”口径"
      - "新增 update-experience-redesign lane 工件、baseline-log 和 verification-matrix"
risks:
  - "macOS 自动更新上线仍受签名 / 公证约束，本轮只保持现有提示，不解决平台签名问题。"
  - "GitHub Releases 元数据若缺失 release notes，模态页只能展示空日志占位。"
```

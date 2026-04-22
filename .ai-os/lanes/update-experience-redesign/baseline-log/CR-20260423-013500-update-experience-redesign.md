# CR-20260423-013500-update-experience-redesign

> 当前变更记录用于把“在线更新能力”从旧的标题栏按钮语义升级为完整的应用内更新体验。需求真理源仍以 lane `MISSION.md + DESIGN.md + tasks.yaml` 为准。

- **Type**: change-request
- **Status**: confirmed
- **Summary**: 重构在线更新体验：后台自动检查、发现新版本立即弹出全局更新页、用户手动下载与安装、安装失败 15 秒回退重试
- **Reason**: 用户反馈现有更新按钮只在下载完成后出现，点击后“更新中”无反馈，难以判断是否卡死；同时希望弹框展示版本号和更新日志。
- **Confirmed At**: 2026-04-23

## 现状问题

1. 现有更新按钮只在 `ready` 时显示，用户看不到“发现新版本 -> 下载中 -> 可安装”的完整过程。
2. 点击 `更新` 后 renderer 只进入本地 `installing=true` 并直接调用 `quitAndInstall()`；若应用未退出，界面会长期停留在“更新中…”而没有回退和重试入口。

## 影响分析

| 维度 | 是否受影响 | 说明 |
| --- | --- | --- |
| MISSION | 是 | 新建独立 lane 记录本轮更新体验重构目标 |
| DESIGN | 是 | 需要锁定全局更新入口、状态机、安装回退与持久化提示策略 |
| tasks | 是 | 需要拆分 shared/main/preload/renderer/doc 验证任务 |
| tests | 是 | 需要覆盖状态机、controller watchdog、自动弹框去重与安装前 flush |
| docs | 是 | README / SUPPORT / Help 更新口径需要同步 |
| default lane | 否 | 当前 `default` lane 继续承载 `v1.2.4` 发布收口，不混入本轮交付 |

## 确认决策

- 更新源继续采用 `GitHub Releases`
- `electron-updater` 改为 `autoDownload = false`
- 新版本发现后立即自动打开“应用设置 / 关于”
- 用户手动点击“下载更新”后才开始下载
- 安装失败 15 秒内回退成 `ready + errorMessage`
- 同版本自动弹框只触发一次，去重版本写入 `app_state.update_prompted_version`

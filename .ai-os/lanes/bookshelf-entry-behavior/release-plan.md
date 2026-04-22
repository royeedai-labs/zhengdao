# 发布计划：作品入口行为收口

## 发布策略

- **策略**：随下一次桌面端补丁版本发布。
- **目标环境**：Electron 桌面端 renderer。
- **回滚负责人**：当前维护者。

## 发布步骤

1. 保持 `workspace-entry` 行为测试通过。
2. 运行项目原生 `npm run build`。
3. 在发布说明中标注“进入作品不再自动弹总览，总览改为显式触发”。

## 回滚条件

- 已有作品无法进入工作区。
- 首次 onboarding 不再出现。
- 显式总览入口不可用。

## 回滚步骤

1. 回退 `workspace-entry` 相关 renderer 变更。
2. 复跑 focused test 与 `npm run build`。
3. 在 release notes 中说明入口行为回滚。

# Parity Map

## 原始参考清单

- Windows 正式安装版壳层需求
- 现有 macOS `hiddenInset` 窗口行为
- AI-OS v9 canonical layout 文档

## 字段级对照

| 原始字段 / 行为 | 本项目实现 | 差异 | 结论 |
|---|---|---|---|
| Windows 默认 Electron 菜单 | Windows / Linux 移除默认菜单 | macOS 保留系统菜单 | aligned |
| Windows 标题栏 | 隐藏标题栏 + renderer 顶栏安全区 | 不采用裸 `frame:false` | aligned |
| 应用标题 | 用户可见名称统一为 `证道` | 不再使用旧英文标题 | aligned |
| 桌面图标 | `resources/icon.*` + builder 配置 | 真实 Windows 快捷方式仍需人工验收 | partial |
| AI-OS v7 lane layout | v9 shared root + lane 工件 | 旧 `.agents` workflow / skill 体系已移除 | aligned |

## 结论

本 lane 不是 reverse-spec 项目；此 parity map 用于保留平台壳层行为与 AI-OS v9 布局迁移的关键对照。

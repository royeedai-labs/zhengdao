# Desktop UX Overhaul Design

## Design Principles

- **写作主路径优先**：编辑器和章节导航是主工作面；AI、资料、沙盘和弹窗都不能抢走长期焦点。
- **任务分区明确**：导航、编辑、AI、资料、审阅、设置分别有稳定入口；同一动作不在多个地方以不同语义出现。
- **命令中心为动作真理源**：按钮、菜单和快捷键都应能映射到命令元数据；高频动作可见，低频动作可搜索。
- **上下文操作优先**：对某个章节、角色、设定、草稿的操作靠近对象出现；复杂次级动作收进上下文菜单或命令面板。
- **状态完整**：每个 surface 必须考虑空数据、有数据、loading、error、权限/配置缺失、文本溢出和键盘路径。
- **AI 可控**：AI 可以建议和生成，但写入作品前必须预览和用户确认。

## Reference Patterns

- Linear: contextual command menu、Peek preview、display options、可保存视图。
- Raycast: root search、action panel、favorites/aliases、键盘优先。
- Notion: slash command 降低输入摩擦，内容编辑中触发操作。
- Arc: Spaces / Sidebar / Command Bar，以任务上下文分区而不是堆功能。

完整映射见 `research/competitive-pattern-map.md`。

## Information Architecture

- **App shell**：只决定进入书架或工作区，并承载全局更新、主题和弹窗层。
- **Bookshelf**：作品库 + 新建作品 + AI 起书；不是营销页。
- **Workspace**：四区工作台，中心编辑器最高优先级；左侧结构，右侧 AI/辅助，底部审阅或沙盘。
- **Command/Search**：命令面板找动作，全局搜索找内容，两者不能混淆。
- **Settings**：应用设置处理系统级事项；作品设置处理作品属性；AI 设置处理作品 AI 能力。
- **Modals**：所有弹窗统一 shell、标题层级、主次操作、危险操作样式和键盘退出规则。

## Rollout Order

1. **Inventory gate**：生成 surface ledger、命令清单、modal coverage，发现遗漏先补 ledger。
2. **Navigation and command**：TopBar、CommandPalette、GlobalSearch、Bookshelf 的入口层级先收口。
3. **Writing workspace**：WorkspaceLayout、OutlineTree、EditorArea、SplitEditor、BlackRoomMode、DailyWorkbench。
4. **AI workflow**：AiAssistantDock、AI 起书、草稿篮、章节审稿、导演主链、一致性检查。
5. **Assets and panels**：角色、设定、Canon Pack、伏笔、剧情、引用、沙盘。
6. **Settings and low-frequency modals**：应用设置、作品设置、AI 设置、导出、备份、MCP、团队、视觉资产等。
7. **Visual and keyboard polish**：统一组件 shell、focus ring、快捷键提示、文本溢出和截图矩阵。

## Shared Impact

- 默认不改数据库 schema、IPC、AI provider routing 或同步语义。
- 允许新增 renderer 内部 UI helper / metadata，但必须先让现有入口对齐。
- 若某批改造触及写入、删除、账号、同步、更新或 AI provider，任务风险升级并补单独 guard。

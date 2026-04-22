# Eval: Bookshelf Entry Does Not Auto Open Overview

- **Failure mode**：用户点击已有作品后，工作区仍自动弹出总览 modal，打断进入作品主路径。
- **Trigger**：修改 `workspace-entry` helper、书架卡片点击、`WorkspaceLayout` 或 `TopBar` 总览入口。
- **Expected**：已有作品主体点击直接进入工作区；总览只能由显式入口触发；onboarding 首次规则不回退。
- **Observed**：历史修复已通过 focused entry behavior test 与 build。
- **Guard update**：涉及入口行为时运行 `workspace-entry.test.ts` 和 `npm run build`。

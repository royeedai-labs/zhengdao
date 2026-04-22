# Eval: License Metadata Drift

- **Failure mode**：`LICENSE` 已经是 AGPL，但 README、package metadata 或 release 文案仍写 MIT / 空泛旧口径。
- **Trigger**：发布新版本、改 README、改 package metadata、生成 GitHub Release 正文。
- **Expected**：当前项目顶层授权统一为 `AGPL-3.0-only`，Release 正文包含更新日志、资产、验证状态和回滚提示。
- **Observed**：历史 v1.2.3 Release 正文缺少更新日志，已沉淀为根 memory `EC-002`。
- **Guard update**：授权变更必须跑 top-level metadata scan；发布前必须执行 Release body checklist。

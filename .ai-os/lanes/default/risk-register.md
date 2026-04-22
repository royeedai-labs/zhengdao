# 默认 lane 风险登记

> 当前 lane 为 standard 档。此文件保留真实已知风险，供 verify / ship 阶段核对。

| 风险 ID | 描述 | 影响范围 | 触发条件 | 规避措施 | 监测入口 | 审批结论 |
|---|---|---|---|---|---|---|
| R-DEF-001 | Windows 隐藏标题栏后，应用按钮可能与原生窗口按钮在高 DPI 下重叠 | renderer 顶栏、Windows 安装版观感 | 125% / 150% DPI 或小窗口宽度 | 顶栏保留系统按钮安全区，人工 Windows smoke | `STATE.md` 待确认项、Windows 实机验收 | accepted-with-manual-check |
| R-DEF-002 | AI-OS v9 升级移除旧 `.agents` workflow / skill 体系，旧 IDE 指针失效 | 交付治理与协作入口 | AI 仍引用旧 slash workflow 文件 | 根 `AGENTS.md` 与轻量 `CLAUDE.md` / `GEMINI.md` 改为 v9 指针 | `doctor --json`、root `AGENTS.md` review | user-approved |
| R-DEF-003 | 当前仓库存在未提交业务源码改动，AI-OS 升级可能与业务改动混淆 | git review、交付说明 | 直接用全仓 diff 判断本轮改动 | 只修改 AI-OS 工件与 IDE 指针，最终状态按路径拆分说明 | `git status --short` | accepted |
| R-DEF-004 | `v1.2.4` 发布会把大量本地未提交改动一次性纳入正式 Release | Git history、GitHub Release、自动更新源 | 未分组审计就全量 stage / tag / push | 按变更组写 CR、changelog、release plan 和验证证据，验证通过后再提交 tag | `git diff --stat`、`npm test`、`npm run build`、GitHub Release 复核 | user-approved |
| R-DEF-005 | GitHub Release 可能有安装包但缺少正文更新日志或必要发布说明 | 用户下载页、自动更新发布可信度 | release workflow 未同步正文或同步失败 | release workflow 保留 release-notes job，发布后用 GitHub API 复核正文必要字段 | `scripts/release/update-github-release-notes.mjs`、远端 Release body check | user-approved |

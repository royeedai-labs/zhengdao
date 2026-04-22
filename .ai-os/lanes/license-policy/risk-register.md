# 许可证策略风险登记

| 风险 ID | 描述 | 影响范围 | 触发条件 | 规避措施 | 监测入口 | 审批结论 |
|---|---|---|---|---|---|---|
| R-LIC-001 | 顶层授权口径在 LICENSE、README、package 元数据中不一致 | 分发、用户预期、法律说明 | 修改任一授权相关顶层文件 | 同步检查所有顶层授权文件 | `verification-matrix.yaml`、`rg` scan | user-approved |
| R-LIC-002 | 把 AGPL 误描述为 MIT、source-available 或禁止商用 | README、Release、贡献说明 | 更新对外说明或发布文案 | 使用 SPDX `AGPL-3.0-only`，避免口语化误写 | `README.md` review、release notes review | user-approved |
| R-LIC-003 | 误改第三方依赖许可证或历史版本授权事实 | package metadata、release history | 批量替换 license 文案 | 只更新本项目顶层授权，不改第三方依赖许可证条目 | path-scoped diff review | accepted |
| R-LIC-004 | GitHub Release 缺少更新日志或必要说明，造成用户误解版本状态 | GitHub Releases、自动更新 | 发布脚本生成空泛正文 | Release 正文必须同步 CHANGELOG、资产、验证和回滚提示 | 根 memory `EC-002` | active-guard |

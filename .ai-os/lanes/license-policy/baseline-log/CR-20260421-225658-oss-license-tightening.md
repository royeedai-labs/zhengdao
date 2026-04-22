# 变更请求

- **变更标题**：开源许可证收紧为强 copyleft
- **提出时间**：2026-04-21 22:56:58 +0800
- **变更原因**：用户要求“加一个最严格的开源协议”。当前仓库顶层授权为 `MIT`，与“严格”目标不符，需要切换到更强约束但仍保持开源属性的许可。
- **优先级**：P1

## 变更内容

- [修改] 仓库顶层许可证从 `MIT` 调整为 `AGPL-3.0-only`
- [修改] README 许可说明同步为强 copyleft 开源协议
- [修改] `package.json` 与 `package-lock.json` 根包许可证字段统一为 `AGPL-3.0-only`
- [补充约束] 本轮只处理仓库自身授权口径，不改第三方依赖许可证
- [补充约束] 本轮不引入非开源 source-available 许可

## 影响分析

| 维度 | 是否受影响 | 说明 |
|------|------------|------|
| MISSION | 是 | 当前交付目标新增“仓库授权口径收紧” |
| baseline-log | 是 | 需要新增本条 CR 记录 |
| spec | 是 | 需要定义许可证切换文件边界与验证口径 |
| tasks | 是 | 需要新增顶层许可证与元数据统一任务 |
| tests | 否 | 无新增业务测试，但需要最小元数据校验与构建校验 |
| acceptance | 是 | 需要新增法律口径一致性与元数据一致性放行标准 |
| release | 是 | 后续发版与对外发布说明的授权口径会受影响 |
| memory | 否 / 待确认 | 只有在用户确认后才适合提升为长期项目记忆 |
| evals | 否 | 当前无需新增长期 eval 工件 |

## 新增风险 / blocker

- `AGPL-3.0-only` 是强 copyleft，但如果用户真实目标是“限制商用 / 禁止 SaaS”，则它可能不满足预期
- 许可证切换不会自动消除历史版本按 MIT 发布的既有法律事实
- 工作区内 `package.json` / `package-lock.json` 已有未提交改动，正式执行时必须做最小字段级更新

## 后续动作

- 新建独立 lane `license-policy` 承载本次授权口径变更
- 更新 `MISSION.md`、`specs/license-policy.spec.md`、`tasks.yaml`、`acceptance.yaml`、`release-plan.md`
- 向用户同步建议许可为 `AGPL-3.0-only` 的原因、边界与风险
- 待用户明确确认后，再修改 `LICENSE`、`README.md`、`package.json`、`package-lock.json`

## 用户确认

- **确认时间**：2026-04-21
- **确认结论**：确认按 `AGPL-3.0-only` 执行

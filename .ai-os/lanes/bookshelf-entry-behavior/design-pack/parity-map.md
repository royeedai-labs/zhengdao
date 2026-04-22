# Parity Map

## 原始参考清单

- Existing bookshelf card behavior
- Existing workspace overview modal
- Existing onboarding flow

## 字段级 / 行为级对照

| 原始字段 / 行为 | 本项目实现 | 差异 | 结论 |
|---|---|---|---|
| Click book body | Enter workspace | No automatic overview modal | aligned |
| Overview access | Explicit TopBar / workspace entry | Not part of implicit open flow | aligned |
| First-run onboarding | Preserved priority | Can still appear when required | aligned |

## 结论

本 lane 不是 reverse-spec 项目；parity map 仅记录旧隐式总览行为与新显式入口行为的差异。

# Eval: AI-OS v9 Lane Normalization

- **Failure mode**：官方 upgrade 只让 default lane 通过 doctor，但其他现有 lane 仍停留在旧 `acceptance.yaml` 结构。
- **Trigger**：项目存在多条 lane，且只执行 `create-ai-os upgrade .` 后立即收口。
- **Expected**：所有 lane 都具备 v9 `DESIGN.md`、`risk-register.md`、`release-plan.md`、`verification-matrix.yaml`、`design-pack/`、`evals/`；旧 `acceptance.yaml` 内容迁入 `DESIGN.md`。
- **Observed**：官方 upgrade 后 `doctor --json` 对 default 放行，但非 default lane 仍需人工补齐。
- **Guard update**：执行 lane artifact completeness check，并在 `verification-matrix.yaml` 记录 `FM-DEF-001`。

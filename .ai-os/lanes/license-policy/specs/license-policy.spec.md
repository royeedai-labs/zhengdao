# 开源许可证收紧与授权口径统一 Spec

## 1. 模块概述

- **模块目标**：把仓库对外授权从 `MIT` 收紧为 `AGPL-3.0-only`，并统一所有顶层元数据
- **所属阶段**：change-request / plan / build / verify
- **关联 Mission**：`MISSION.md` 当前基线 `CR-20260421-225658-oss-license-tightening`
- **关联需求点 ID / 标题**：
  - `REQ-LIC-001` 顶层许可证切换
  - `REQ-LIC-002` README / npm 元数据统一
  - `REQ-LIC-003` 明确开源强 copyleft 边界

## 2. 业务规则与目标

- **核心规则**：
  - 许可证选择使用 SPDX 标识 `AGPL-3.0-only`
  - `LICENSE` 文件使用 GNU AGPL v3 正式文本，不自造摘要版法律文本
  - `README.md` 的“许可”章节必须与 `LICENSE`、`package.json` 一致
  - `package-lock.json` 只更新根包许可证字段，不触碰第三方依赖条目
- **必须优先保证的正确性**：
  - 法律口径一致
  - 不把 AGPL 误写成 MIT、GPL 或 source-available
  - 不覆盖用户现有无关修改
- **允许延后处理的细节**：
  - 每文件版权头
  - 贡献者入站授权补充
  - 双许可或商业许可模型
- **本轮非目标 / 禁止越界项**：
  - 不重写第三方依赖许可证
  - 不修改应用运行时逻辑

## 3. 界面 / 接口 / 命令清单

| 编号 | 类型 | 名称 | 描述 | 验收点 |
|------|------|------|------|--------|
| I-LIC-001 | 文件 | `LICENSE` | 顶层正式 AGPLv3 文本 | AC-LIC-001 |
| I-LIC-002 | 文档 | `README.md` | 许可章节统一为 `AGPL-3.0-only` 并说明强 copyleft | AC-LIC-002 |
| I-LIC-003 | 元数据 | `package.json` | 根包 `license` 字段改为 SPDX `AGPL-3.0-only` | AC-LIC-002 |
| I-LIC-004 | 锁文件 | `package-lock.json` | 根包 `license` 字段同步为 `AGPL-3.0-only` | AC-LIC-002 |

## 4. 关键流程与状态流转

1. 先完成 change-request，锁定许可证选择与边界
2. 用户明确确认采用 `AGPL-3.0-only`
3. 替换顶层 `LICENSE`
4. 同步更新 README 与 npm 元数据
5. 运行最小校验，确认未残留 MIT 顶层声明
6. 输出交付说明，显式提示历史版本授权与 source-available 非本轮范围

## 5. 数据与契约

- **契约基准**：
  - 顶层许可证：`AGPL-3.0-only`
  - README 许可文案：指向 `LICENSE`，明确强 copyleft
  - npm 元数据：`package.json` 与 `package-lock.json` 根包一致
- **输入**：
  - 当前仓库顶层文件
  - 用户对“最严格开源协议”的确认
- **输出**：
  - 更新后的 `LICENSE`
  - 一致的 README / npm 元数据
- **共享层 / 包装层副作用审计**：
  - 无运行时代码副作用
  - 会影响后续发布与协作的法律口径
- **受影响模块 / 文件边界**：
  - `LICENSE`
  - `README.md`
  - `package.json`
  - `package-lock.json`

## 6. 边界条件与异常处理

- 如果用户其实想“禁止商用”或“禁止 SaaS”，需要回到许可策略重新确认，因为这通常不再是 OSI 开源
- 如果工作区里 `package.json` / `package-lock.json` 还有用户未提交改动，只做最小字段级更新
- 如果后续决定采用 `AGPL-3.0-or-later` 或双许可，需要重新走 change-request

## 7. 验收与证据

- **关键验证**：
  - `LICENSE` 已是 GNU AGPL v3 正式文本
  - `README.md` 许可章节已不再声明 MIT
  - `package.json` / `package-lock.json` 根包许可证字段一致
- **工程质量证据**：
  - `rg -n "MIT License|\\\"license\\\": \\\"MIT\\\"|本项目采用 \\[MIT License\\]" LICENSE README.md package.json package-lock.json`
  - `npm run build`
- **回归范围**：
  - 顶层文档
  - npm 元数据

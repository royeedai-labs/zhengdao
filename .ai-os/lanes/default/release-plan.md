# 证道 开源首发 / 持续发布计划

> 当前文件已从“在线更新能力发布计划”升级为“开源仓库首发 + GitHub Releases + 后续持续版本治理计划”。GitHub Releases 同时承担用户下载入口和应用内更新元数据源。

## 1. 交付前检查

- [x] 需求基准已更新到 `CR-20260420-232439-open-source-release-hardening`
- [x] 当前代码主链路验证证据已存在：`npm test`、`npm run build`
- [x] 项目原生静态校验证据已记录：`npm run build`
- [x] 在线更新实现已接入并具备 GitHub Releases 兼容前提
- [x] 开源仓库核心文档与模板已补齐
- [x] 版本治理脚本与项目级 release skill 已补齐
- [x] Git 仓库已初始化并准备推送
- [ ] GitHub 远端仓库已创建
- [ ] 首个 GitHub Release 已创建
- [ ] macOS 签名 / 公证已完成

## 2. 变更范围与依赖

- 本次交付覆盖：
  - README 与公开仓库元数据
  - LICENSE、CHANGELOG、CONTRIBUTING、SECURITY、CODE_OF_CONDUCT、SUPPORT
  - issue / PR 模板
  - 自动版本号 / CHANGELOG 治理脚本
  - 项目级 GitHub 发布 skill
  - GitHub 仓库首发与首个 Release
  - 与应用内更新衔接的下载说明
- 本次明确不包含：
  - 品牌图标补齐
  - Linux 正式发布
  - macOS 证书申请、签名和 notarization 全流程
  - beta / alpha 渠道
- 依赖：
  - GitHub API / GitHub Releases / GitHub Actions
  - 有效 GitHub token
  - `GH_OWNER` / `GH_REPO` / `GH_TOKEN`
  - macOS 签名与 notarization secrets

## 3. 发布步骤

1. [AI 已完成] 重写仓库首页 README，明确当前能力、平台安装方式、应用内更新和开发说明
2. [AI 已完成] 补齐开源治理文件与 issue / PR 模板
3. [AI 已完成] 补 release 脚本与项目级 GitHub 发布 skill
4. [AI 已完成] 初始化 Git 仓库并提交首版代码到本地 `main`
5. [AI 受阻] 通过 GitHub API 创建远端仓库并 push 默认分支；当前用户提供 token 返回 `401`
6. [AI / GitHub Actions 待执行] 远端凭据恢复后，触发 Release 构建并确认 Release 中存在安装包、`latest.yml`、`latest-mac.yml`
7. [需人工执行] 提供有效 GitHub token，并在签名后验证 macOS 端自动更新

## 4. 运行态验证

- [x] `npm test` 通过
- [x] `npm run build` 通过
- [x] `node scripts/release/prepare-release.mjs ... --dry-run` 通过
- [ ] GitHub API 仓库创建成功
- [ ] `git push` 成功
- [ ] GitHub Release 首发成功
- [ ] Release 中的安装包与 blockmap / latest 元数据可下载
- [x] fallback 证据未被误当正式结论：若 token 无效，只能证明本地首发准备完成，不能写成“已发布”

## 5. 回滚触发条件

- README 或 Release 页面写错下载 / 更新方式
- 版本号、tag、CHANGELOG 三者不一致
- Release 元数据指向错误安装包或缺失 `latest*.yml`
- push / release 因无效 token 失败却仍把首发写成成功

## 6. 交付说明与移交

- AI 已完成：
  - 在线更新基础链路与 GitHub Releases workflow 已接入
  - 正式安装包打包能力已验证
  - 本次开源首发与版本治理基线已落到工件
  - 开源仓库文档、版本脚本、issue / PR 模板和项目级 release skill 已补齐
  - 本地 Git 仓库已初始化并完成首个基线提交 `c52b72e`
- AI 待完成：
  - 远端 GitHub 仓库创建、首版推送和首个 Release
- 需人工执行：
  - 若当前 token 无效，提供一个具有 repo 创建 / push / release 权限的有效 GitHub token
  - 配置 macOS 签名与 notarization secrets
  - 对 Windows / macOS 已安装包做真实升级验证
- 已知风险和后续待办：
  - macOS 自动更新在未签名 / 未公证前不能作为正式可用能力承诺
  - 当前仍使用默认 Electron 图标
  - 若用户 GitHub 账号已有同名仓库，仓库名需要回退到候选名

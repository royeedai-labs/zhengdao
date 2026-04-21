# Releasing

本仓库的发布目标是：

- 让版本号、tag、`CHANGELOG.md`、GitHub Release 保持一致
- 让 GitHub Releases 继续作为应用内更新的数据源
- 避免靠手工改版本号和手工上传安装包

## 先决条件

- 代码已经合入或你当前分支就是准备发布的分支
- 当前 git worktree 是干净的
- 本地可以执行：

```bash
npm test
npm run build
```

- 远端仓库已经配置 GitHub Actions
- 如需 macOS 正式自动更新，还需要：
  - `CSC_LINK`
  - `CSC_KEY_PASSWORD`
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`

当前 GitHub Actions 默认设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`，用于产出未签名的公开测试包。
配置完上述签名 / 公证凭据后，应再调整 release workflow 启用签名链路。

## 常用命令

### 仅准备版本号与 changelog

```bash
npm run release:prepare -- patch "简短发布摘要"
```

这个命令会：

- 自动计算下一个版本号
- 更新 `package.json`
- 更新 `package-lock.json`
- 在 `CHANGELOG.md` 顶部插入一个新版本条目

### 一键发布

```bash
npm run release:publish -- patch "简短发布摘要"
```

这个命令会：

1. 检查 git 仓库和 worktree 是否干净
2. 自动准备版本号和 changelog
3. 运行 `npm test`
4. 运行 `npm run build`
5. 创建 `release: vX.Y.Z` commit
6. 创建 `vX.Y.Z` tag
7. 推送当前分支和 tag

推送 tag 后，`.github/workflows/release.yml` 会自动构建并上传安装包到 GitHub Releases。

## 版本号规则

- `patch`: bugfix、文档修正、小范围稳定性改进
- `minor`: 新功能但保持兼容
- `major`: 破坏性变更

## 产物约定

- Windows x64：`证道-<version>-x64-setup.exe`
- macOS Apple Silicon：`证道-<version>-arm64.dmg`
- 自动更新元数据：`latest.yml`、`latest-mac.yml`

## 发布后检查

发布后至少确认：

- GitHub Release 存在且不是 draft
- Release 中能看到安装包和 `latest*.yml`
- `package.json` 版本、Git tag 和 `CHANGELOG.md` 顶部版本一致
- Windows 打包版能正常拉到更新元数据

## CI 原生模块注意事项

`npm ci` 会触发 `postinstall -> electron-builder install-app-deps`，这会把 `better-sqlite3`
重编到 Electron ABI。GitHub Actions 中测试运行在 Node.js 下，所以 release workflow 会在
`npm ci` 后、`npm test` 前执行一次 `npm rebuild better-sqlite3`，把测试阶段恢复到 Node ABI。
打包阶段仍由 `electron-builder` 自动重新构建 Electron ABI。

## 直接本地上传 Release

如果不想依赖 tag workflow，也可以在本地配置：

- `GH_OWNER`
- `GH_REPO`
- `GH_TOKEN`

然后执行：

```bash
npm run release:github
```

但默认推荐还是使用 `release:publish` 推 tag，让 GitHub Actions 统一产出和上传。

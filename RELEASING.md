# Releasing

本仓库的发布目标是：

- 让版本号、tag、`CHANGELOG.md`、GitHub Release 保持一致
- 让 GitHub Release 正文包含本版本更新日志和必要发布说明
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
两个平台构建都完成后，workflow 会自动把 `CHANGELOG.md` 中对应版本条目同步到 GitHub
Release 正文；如果正文缺少更新日志，本次发布不算完成。

## 版本号规则

- `patch`: bugfix、文档修正、小范围稳定性改进
- `minor`: 新功能但保持兼容
- `major`: 破坏性变更

## 产物约定

- Windows x64：`zhengdao-<version>-x64-setup.exe`
- macOS Apple Silicon：`zhengdao-<version>-arm64.dmg`
- 自动更新元数据：`latest.yml`、`latest-mac.yml`

## 发布后检查

发布后至少确认：

- GitHub Release 存在且不是 draft
- GitHub Release 正文包含本版本更新日志，不能只有 tag、commit message 或自动生成占位内容
- Release 中能看到安装包和 `latest*.yml`
- `package.json` 版本、Git tag 和 `CHANGELOG.md` 顶部版本一致
- Windows 打包版能正常拉到更新元数据
- Windows 覆盖安装会复用旧安装路径，开始菜单 / 桌面快捷方式打开的是新版本
- Windows 控制面板只保留稳定的“证道”卸载入口，卸载不会删除用户作品数据库

## Windows 安装 / 卸载恢复

Windows NSIS 报 `Installer integrity check has failed` 时，错误发生在安装 / 卸载脚本运行前，通常表示当前运行的 installer 或旧安装目录中的 uninstaller 二进制已经损坏。先重新下载 GitHub Release 里的完整安装包，并核对 `latest.yml` 中的文件大小；不要继续使用微信、浏览器缓存或中断下载得到的旧文件。

如果控制面板卸载旧版仍报完整性错误，按以下顺序恢复：

1. 退出证道，包括托盘中的后台进程。
2. 备份用户数据目录中的 `zhengdao.db`。
3. 删除旧安装目录中损坏的程序文件，不删除用户数据目录。
4. 如控制面板仍残留旧条目，使用 Windows “程序安装和卸载疑难解答”清理损坏卸载项。
5. 运行新版 `zhengdao-<version>-x64-setup.exe`，不要改安装目录。

`electron-builder.config.ts` 中的 Windows NSIS 配置必须保持 `allowToChangeInstallationDirectory: false`，避免覆盖安装时装到新目录而旧快捷方式仍打开老版本。

## GitHub Release 正文必要内容

每个正式 Release 的正文至少包含：

- 本版本面向用户的更新日志，来源于 `CHANGELOG.md` 对应版本条目
- 安装包清单：macOS DMG / ZIP、Windows installer
- 自动更新元数据：`latest-mac.yml`、`latest.yml` 和对应 `.blockmap`
- 发布注意事项：macOS 签名 / 公证状态、兼容性或已知限制
- 验证状态：release workflow、安装包、更新元数据和 Release 正文四项是否完成
- 回滚提示：发现启动、数据库 ABI、更新元数据或安装包问题时回退到上一条已验证 Release

`scripts/release/update-github-release-notes.mjs` 负责把这些内容写入 GitHub Release 正文。
不要把只有 tag、commit message 或空泛摘要的 Release 标记为已完成。

## CI 原生模块注意事项

release workflow 会先把 npm 固定到 `10.9.8`，规避部分 Node 20 runner 自带 npm 在
`npm ci` 结束阶段触发 `Exit handler never called` 的问题。随后使用
`npm ci --ignore-scripts` 安装依赖，避免 `postinstall -> electron-builder install-app-deps`
提前把原生模块切到 Electron ABI。

跳过安装脚本后，release workflow 会显式执行 `npm rebuild electron` 恢复 Electron runtime。
GitHub Actions 中测试运行在 Node.js 下，所以 workflow 随后会在 `npm test` 前执行一次
`npm rebuild better-sqlite3`，把测试阶段恢复到 Node ABI。
测试和构建完成后，release workflow 必须在打包前执行
`node scripts/release/rebuild-electron-native.mjs <arch>`，强制把 `better-sqlite3`
切回 Electron ABI；随后执行 `node scripts/release/verify-electron-native.mjs`，用 Electron runtime
实际加载 `better-sqlite3` 并跑一次内存库查询。否则 DMG / NSIS 中可能打入 Node ABI 模块，
安装后启动时会报 `NODE_MODULE_VERSION` 不匹配。

`scripts/release/rebuild-electron-native.mjs` 必须用 `@electron/rebuild --only better-sqlite3`。
不要改回 `--which-module`，否则 `@google/gemini-cli` 依赖树中的 `node-pty` 也会被扫描并在
GitHub runner 的 Python 环境中触发 `distutils` / `node-gyp` 失败。

`electron-builder.config.ts` 必须保持 `npmRebuild: false`。release workflow 已经在打包前
显式完成并验证了 `better-sqlite3` 的 Electron ABI；如果让 electron-builder 默认再次 rebuild，
它会重新扫描所有 native 依赖，并在 CI 中再次触发 `node-pty` rebuild。

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

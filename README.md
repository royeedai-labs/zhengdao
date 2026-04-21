# 证道 / Zhengdao

> 面向长篇网文作者的本地优先桌面创作工具。

证道是一个基于 Electron + React + SQLite 的桌面写作应用，重点解决长篇创作里的正文编辑、角色管理、设定维基、剧情沙盘、伏笔追踪、统计分析、备份恢复和后续版本更新问题。

## 当前状态

- 当前公开版本：见 GitHub Releases
- 下载入口：GitHub Releases
- 应用内更新：正式打包版会基于 GitHub Releases 后台检查和下载更新；下载完成后标题栏会出现 `更新`
- 主要目标平台：Windows x64
- macOS 说明：当前可产出 `dmg`，但自动更新对外可用仍依赖签名和 notarization

## 当前已实现能力

### 写作与编辑

- 沉浸式正文编辑器
- 打字机模式、段落聚焦、小黑屋模式、分屏编辑
- 自动保存、手动保存、文本查找替换
- 正文批注、敏感词高亮、人物 `@` 提及
- 章节模板、新建卷 / 章节、拖拽排序

### 人物、设定与剧情

- 角色总库、角色关系图、出场时间线、角色对比
- 设定维基、角色里程碑、当前章节活跃角色
- 剧情块 / 爽点沙盘、剧情线、毒点预警
- 伏笔看板与状态流转

### 数据、恢复与管理

- 写作数据中心、热力图、成就、番茄钟
- 全局搜索、回收站、章节快照与恢复
- 全量数据导出 / 导入、数据库备份与自动备份
- TXT / DOCX 导入，PDF 导出

### AI 与同步

- OpenAI 兼容、Gemini、Ollama Provider 配置入口
- 风格分析、一致性检查等 AI 功能入口
- Google 登录与 Google Drive 云同步链路

### 交付与更新

- Windows / macOS 安装包构建
- 基于 GitHub Releases 的应用内在线更新
- 发布后下载完成才显示标题栏 `更新` 按钮
- Windows 正式壳层、品牌标题与安装包图标已收口

## 路线图

以下项目不在当前首版公开发布范围内，但已经明确为后续迭代方向：

- 完整品牌图标与安装包品牌资源
- macOS 签名、notarization 与正式自动更新放行
- beta / alpha 发布渠道
- Linux 正式安装包
- 更完整的版本更新日志展示

## 下载与安装

正式安装包会发布在 GitHub Releases。常用下载建议如下：

- Windows x64：`zhengdao-<version>-x64-setup.exe`
- Windows ARM64：`zhengdao-<version>-arm64-setup.exe` 或等价 ARM64 安装包
- macOS Apple Silicon：`zhengdao-<version>-arm64.dmg`

如果你已经安装过正式版：

1. 应用会在后台检查 GitHub Releases 上的新版本。
2. 下载完成前不会出现醒目的更新按钮。
3. 下载完成后，标题栏会出现 `更新`。
4. 点击 `更新` 会先 flush 当前未保存内容，再重启进入安装流程。

注意：

- 开发模式不会触发在线更新。
- Windows 是当前优先验证的平台。
- macOS 若仍未签名 / 未公证，安装和自动更新会受到系统限制。

## 开发

### 环境要求

- Node.js >= 18
- npm >= 9

### 本地启动

```bash
npm install
npm run dev
```

### 测试与构建

```bash
npm test
npm run build
```

### 目录概览

- `src/main`: Electron 主进程、数据库、打包 / 更新 / 同步逻辑
- `src/preload`: 预加载桥接
- `src/renderer`: React 界面
- `src/shared`: 跨层共享类型与纯逻辑
- `scripts/release`: 版本治理与发布脚本
- `.github/workflows`: GitHub Actions 工作流
- `.agents/skills`: 项目级 AI skill

## 版本发布

维护者请优先使用仓库内置发布命令，而不是手工改版本号：

```bash
npm run release:prepare -- patch "简短发布摘要"
npm run release:publish -- patch "简短发布摘要"
```

- `release:prepare`：自动 bump 版本号并预置 `CHANGELOG.md` 新版本条目
- `release:publish`：在 clean git worktree 下执行 prepare、跑测试 / 构建、提交 release commit、创建 tag、推送分支和 tag
- GitHub Actions 会监听 `v*` tag 并发布安装包到 GitHub Releases

详细维护流程见 [RELEASING.md](./RELEASING.md)。

## 贡献

欢迎提交 issue 和 pull request。开始前请先阅读：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [SUPPORT.md](./SUPPORT.md)

## 许可

本项目采用 [MIT License](./LICENSE)。

# Client Performance Overhaul 2026Q2 Mission

## Goal

降低 Zhengdao Electron 客户端在书架、进书、写作、AI 侧栏和重弹窗中的同步阻塞、重复 IPC、重复渲染和大 payload 传输，优先保证作者写作主路径不卡顿且不丢稿。

## Success Criteria

- 书架 `getBooks()` 不再把封面文件编码成 `data:image` payload。
- 工作区首次加载只读取卷章目录元数据，章节正文按选章读取。
- 编辑器输入路径不在每个 transaction 同步序列化整章 HTML 或写 `localStorage`。
- AI 面板打开不重复拉取同一套 skills/profile/conversation/messages/drafts。
- 工作区拖拽布局不在每次变化中同步写多份 `localStorage`。
- 性能相关变更保留自动保存、切章前 flush、更新安装前 flush、小黑屋保存和 AI 写入确认语义。

## Scope

In scope:

- Renderer 写作主路径、书架、工作区 shell、AI 面板、弹窗加载方式和热区状态订阅。
- Main/preload IPC payload 收敛、封面渲染协议、目录元数据接口。
- 聚焦单测和项目原生验证。

Out of scope:

- 同步语义、AI provider 路由、支付/权益、打包发布链路和数据库 schema 重构。
- 大面积视觉重设计；视觉 UX 已由 `desktop-ux-overhaul-2026q2` lane 承接。

## Baseline

- Baseline ID: `CR-20260501-client-performance-overhaul`
- Date: 2026-05-01
- User preference: 全客户端覆盖，允许一批较大的架构级重构，验收采用体感 + 预算。

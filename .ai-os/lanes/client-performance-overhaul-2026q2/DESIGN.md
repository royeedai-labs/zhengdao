# Client Performance Design

## Principles

- **输入优先**：键入、选章和自动保存不能被 AI、封面、弹窗或全书统计阻塞。
- **按需加载**：首屏和进书只拉当前页面真实需要的数据；正文、封面字节和重弹窗延后到使用时。
- **小 payload**：IPC 默认传元数据，只有导出、发布、备份等明确需要正文的路径才传全量正文。
- **幂等状态**：保存状态、布局状态和拖拽位置重复写同值时不得触发无意义重渲染或同步存储。
- **可回归**：新增接口和安全边界用单测覆盖，性能预算记录到 verification matrix。

## Implementation Shape

- Main process 新增 `getVolumesWithChapterMeta`，保留 `getVolumesWithChapters` 给全量正文场景。
- 书籍封面改为 `zhengdao-cover://book/<id>?v=<updated_at>`，由主进程协议安全读取 app data 下的封面文件。
- Renderer 章节 store 使用目录元数据接口；选章才调用 `getChapter`。
- 编辑器将草稿落盘和正文保存的整章 HTML 序列化移到 debounce/idle 阶段。
- UI store 对保存状态做幂等短路，并对高频布局/位置持久化做 debounce。
- AI 面板只在 bookId 初始加载和显式会话切换时刷新，不再由 conversationId effect 重复拉取。
- 低频 modal 使用 lazy import，热列表组件 memo 化。

## Performance Budgets

- `getBooks()` payload 中不得出现 `data:image`。
- `getVolumesWithChapterMeta()` 返回章节不得包含 `content` 字段。
- 1000 章目录加载应维持元数据级 payload，不因正文长度线性膨胀。
- 连续输入期间，同步 transaction 路径不执行 `getHTML()` + `localStorage.setItem()`。

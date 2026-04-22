# Change Request: Gemini CLI 状态检测、作品账号路由与 AI 输入交互修复

- 时间：2026-04-21 23:48
- lane：`ai-chat-assistant`
- 类型：P2 bugfix
- 关联问题：
  1. Gemini CLI “检测”只检查二进制存在，不检查认证可用性。
  2. Gemini CLI “启动登录”后终端窗口很快消失，用户无法确认登录是否真正发生。
  3. 已迁移作品仍固定引用 legacy 全局账号，导致 AI 对话继续走旧 OpenAI 兼容 endpoint 并报 `404`。
  4. AI 对话框仅支持 `Ctrl/⌘ + Enter`，不符合中文创作场景的常规回车发送预期。

## 根因

1. `gemini-cli-service.ts` 的 `getStatus()` 只做 CLI 文件存在性检查，未读取 app-owned workspace 的 auth 选择，也未识别全局 `~/.gemini` 登录痕迹。
2. macOS 登录脚本执行后立即结束，Terminal 按当前系统行为直接关闭窗口，用户无法看到 CLI 输出。
3. v15 迁移把空白作品档案的 `default_account_id` 固定到当时的首个 legacy 账号，后续即使新增全局默认账号，作品仍继续命中旧 provider。
4. AI 助手输入框键盘处理只监听 `Ctrl/⌘ + Enter`。

## 变更

1. Gemini CLI workspace 初始化显式写入 `security.auth.selectedType = oauth-personal`。
2. Gemini CLI 状态检测改为：
   - 快速状态：CLI 是否存在、workspace auth 类型是否正确、`~/.gemini` 是否存在登录痕迹；
   - 手动“检测”：在快速状态通过后执行一次真实 CLI 探测。
3. 登录脚本执行结束后保留终端窗口，便于用户查看 Gemini CLI 输出。
4. 新增 migration v16，把空白且仍绑定 legacy 账号的作品档案恢复为“跟随全局默认账号”。
5. 新建作品 AI 档案默认 `default_account_id = NULL`，不再把首次默认账号写死。
6. AI 对话框改为 `Enter` 发送、`Shift + Enter` 换行，并屏蔽 IME 组合输入时的误发送。

## 验证

- `npx vitest run src/main/ai/__tests__/gemini-cli-service.test.ts`
- `npx vitest run src/main/database/__tests__/migrations.test.ts`
- `npx vitest run src/renderer/src/components/ai/__tests__/input-behavior.test.ts`
- `npm test`
- `npm run build`
- `git diff --check`

## 待人工验证

1. 现有全局 `~/.gemini` 登录态下，应用内 Gemini CLI “检测”是否显示可用。
2. 首次未登录场景下，“启动登录”后的终端窗口是否保留并能完成浏览器授权。
3. 当前作品在未手动指定账号时，AI 对话是否改为走新的全局默认 Gemini CLI 账号。

#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const laneDir = path.join(repoRoot, '.ai-os/lanes/desktop-ux-overhaul-2026q2')
const mdOut = path.join(laneDir, 'surface-ledger.md')
const jsonOut = path.join(laneDir, 'surface-ledger.json')

const rel = (absolutePath) => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/')
const readRepoFile = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8')

const fixedSurfaces = [
  {
    id: 'SURF-APP-001',
    kind: 'shell',
    title: '应用壳层与路由入口',
    component: 'App',
    source: 'src/renderer/src/App.tsx',
    entry: '应用启动后根据 currentBookId 在书架页和工作区之间切换',
    userTask: '恢复上次创作上下文、进入作品或回到书架',
    states: '无作品、有当前作品、主题解析、更新启动、全局弹窗叠加',
    issue: '应用级入口需要明确书架/工作区/弹窗/更新之间的优先层级',
    pattern: 'Arc Spaces: 按上下文分区；Raycast Root Search: 全局入口一致',
    priority: 'P0'
  },
  {
    id: 'SURF-BOOK-001',
    kind: 'page',
    title: '书架页',
    component: 'BookshelfPage',
    source: 'src/renderer/src/components/bookshelf/BookshelfPage.tsx',
    entry: '无 currentBookId 时展示；应用启动、关闭作品后进入',
    userTask: '查找作品、排序、切换网格/列表、新建作品、用 AI 起书、删除作品',
    states: '空书架、有作品、搜索无结果、网格、列表、删除确认、AI 起书 Dock 打开',
    issue: '作品管理、AI 起书和系统入口同屏竞争，需要重新梳理主操作和次级操作',
    pattern: 'Raycast Root Search: 空状态给高频入口；Linear Display Options: 视图偏好可保存',
    priority: 'P0'
  },
  {
    id: 'SURF-WORK-001',
    kind: 'workspace',
    title: '四区写作工作区',
    component: 'WorkspaceLayout',
    source: 'src/renderer/src/components/layout/WorkspaceLayout.tsx',
    entry: '打开任一作品后进入',
    userTask: '在目录、编辑器、AI、沙盘之间保持写作流',
    states: '默认布局、专注布局、审阅布局、设定布局、自定义布局、紧凑宽度、小黑屋',
    issue: '功能区很多但缺少任务导向的布局解释和逐页一致的入口规则',
    pattern: 'Arc Spaces: 不同任务区保持上下文；Linear Display Options: 视图配置持久化',
    priority: 'P0'
  },
  {
    id: 'SURF-NAV-001',
    kind: 'navigation',
    title: '工作区顶栏',
    component: 'TopBar',
    source: 'src/renderer/src/components/layout/TopBar.tsx',
    entry: '工作区顶部固定区域',
    userTask: '返回书架、打开总览、切换面板、选择布局、进入作品工具和设置',
    states: '工具区展开/折叠、布局菜单、保存自定义布局、窄屏更多菜单、拖拽安全区',
    issue: '当前顶栏同时承载导航、布局、工具、系统入口，需要压缩为更清楚的信息架构',
    pattern: 'Linear Contextual Command Menu: 上下文入口；Raycast Action Panel: 次级操作集中',
    priority: 'P0'
  },
  {
    id: 'SURF-EDIT-001',
    kind: 'editor',
    title: '主编辑器',
    component: 'EditorArea',
    source: 'src/renderer/src/components/editor/EditorArea.tsx',
    entry: '工作区中心主区域',
    userTask: '选择章节、写作、保存、插入引用、文本分析、AI 选区操作、快照',
    states: '无章节、有章节、保存中/已保存、选区菜单、引用操作、敏感词、空章节',
    issue: '编辑器需要把创作动作、分析动作和资产动作拆清，避免干扰正文输入',
    pattern: 'Notion Slash Commands: 输入中触发；Linear Peek: 不跳转预览详情',
    priority: 'P0'
  },
  {
    id: 'SURF-EDIT-002',
    kind: 'editor',
    title: '分屏编辑器',
    component: 'SplitEditor',
    source: 'src/renderer/src/components/editor/SplitEditor.tsx',
    entry: '工作区开启 splitView 后显示',
    userTask: '并排查看/编辑参考章节或第二章节',
    states: '未选择章节、已选择章节、保存、滚动、窄屏禁用',
    issue: '分屏需要明确何时帮助对照写作，何时应被专注模式隐藏',
    pattern: 'Arc Split View: 保持同一任务内的并排上下文',
    priority: 'P1'
  },
  {
    id: 'SURF-EDIT-003',
    kind: 'focus',
    title: '小黑屋模式',
    component: 'BlackRoomMode',
    source: 'src/renderer/src/components/editor/BlackRoomMode.tsx',
    entry: '命令面板或快捷键进入',
    userTask: '屏蔽干扰进行限时/目标写作',
    states: '进入、全屏、退出、保存、目标达成、异常中断',
    issue: '专注体验需要强化退出、保存和目标反馈，避免变成另一个复杂界面',
    pattern: '专业写作工具专注模式；Raycast keyboard-first',
    priority: 'P1'
  },
  {
    id: 'SURF-LEFT-001',
    kind: 'navigation',
    title: '左侧目录树',
    component: 'OutlineTree',
    source: 'src/renderer/src/components/sidebar-left/OutlineTree.tsx',
    entry: '工作区左侧面板',
    userTask: '管理卷章、切换章节、新建卷章、进入角色/设定',
    states: '空作品、有卷章、右键菜单、拖拽/排序、删除确认、面板收起',
    issue: '目录既是导航也是结构编辑器，需要更强的层级和上下文操作',
    pattern: 'Arc Sidebar: 左侧承载结构；Linear context menu: 对选中项操作',
    priority: 'P0'
  },
  {
    id: 'SURF-RIGHT-001',
    kind: 'assistant',
    title: '右侧 AI 面板容器',
    component: 'RightPanel',
    source: 'src/renderer/src/components/sidebar-right/RightPanel.tsx',
    entry: '工作区右侧面板',
    userTask: '在写作时查看 AI、角色、伏笔与速记辅助信息',
    states: '打开、收起、AI tab、窄屏隐藏、警告入口替代',
    issue: '右侧当前主要变成 AI 容器，需要定义辅助面板和 Dock 的边界',
    pattern: 'Arc Sidebar: 上下文常驻；Linear Peek: 侧边预览不打断主任务',
    priority: 'P0'
  },
  {
    id: 'SURF-AI-001',
    kind: 'assistant',
    title: 'AI 创作助手 Dock',
    component: 'AiAssistantDock',
    source: 'src/renderer/src/components/ai/AiAssistantDock.tsx',
    entry: '书架和工作区常驻 Dock / 命令面板打开',
    userTask: '发起 AI 对话、选择能力、生成草稿、预览并确认写入',
    states: '关闭、打开、书架起书、作品对话、流式中、失败、草稿列表、反馈',
    issue: 'AI 能力多，需要任务化分组、明确等待态和确认写入边界',
    pattern: 'Raycast Action Panel: 所选对象的动作；Notion Slash: 低摩擦输入',
    priority: 'P0'
  },
  {
    id: 'SURF-BOTTOM-001',
    kind: 'workbench',
    title: '底部创世沙盘',
    component: 'TerminalArea',
    source: 'src/renderer/src/components/terminal/TerminalArea.tsx',
    entry: '工作区底部面板',
    userTask: '查看剧情/沙盘/终端型辅助输出并拖拽调整高度',
    states: '打开、收起、拖拽高度、空数据、有节点、节点编辑',
    issue: '底部区域需要明确是审阅区、沙盘区还是工具输出区，避免和弹窗抢任务',
    pattern: 'Linear Peek: 底部/侧边辅助信息不抢主编辑器焦点',
    priority: 'P1'
  },
  {
    id: 'SURF-WORKBENCH-001',
    kind: 'workbench',
    title: '日更工作台',
    component: 'DailyWorkbench',
    source: 'src/renderer/src/components/workbench/DailyWorkbench.tsx',
    entry: '工作区内任务提醒/工作台入口',
    userTask: '查看今日目标、审稿、发布前检查、伏笔提醒',
    states: '目标未达成、目标达成、提醒、审稿入口、发布检查入口',
    issue: '日更任务需要和写作主路径形成清晰的今日待办，而不是额外噪声',
    pattern: 'Linear Inbox: 聚合需要处理的事项',
    priority: 'P1'
  },
  {
    id: 'SURF-CMD-001',
    kind: 'command',
    title: '命令面板',
    component: 'CommandPalette',
    source: 'src/renderer/src/components/shared/CommandPalette.tsx',
    entry: '键盘快捷键或 modal 打开',
    userTask: '跨页面搜索并执行导航、编辑、AI、视图和主题命令',
    states: '空查询、有查询、无结果、requiresBook 过滤、键盘上下选择、执行后关闭',
    issue: '命令面板应成为全局操作真理源，补齐上下文动作和可发现性',
    pattern: 'Raycast Root Search + Action Panel；Linear Command Menu',
    priority: 'P0'
  },
  {
    id: 'SURF-SEARCH-001',
    kind: 'search',
    title: '全局搜索',
    component: 'GlobalSearchModal',
    source: 'src/renderer/src/components/modals/GlobalSearchModal.tsx',
    entry: '快捷键或命令面板打开',
    userTask: '跨章节、设定、角色、剧情资产查找内容',
    states: '空查询、搜索中、有结果、无结果、打开结果、错误',
    issue: '搜索需要和命令面板分工：找内容 vs 找动作',
    pattern: 'Raycast Search Bar: 内容与动作分流；Linear Search',
    priority: 'P0'
  },
  {
    id: 'SURF-TOAST-001',
    kind: 'feedback',
    title: 'Toast 与全局反馈',
    component: 'ToastContainer',
    source: 'src/renderer/src/components/shared/ToastContainer.tsx',
    entry: '全局状态变化、保存、失败、迁移提示',
    userTask: '理解操作结果并知道是否需要处理',
    states: 'info、success、warning、danger、堆叠、自动消失、手动关闭',
    issue: '全局反馈需要定义信息等级和可操作错误，不应只做短文案提示',
    pattern: 'Linear: 明确错误状态与高亮状态',
    priority: 'P2'
  }
]

const modalMetadata = {
  newBook: {
    title: '新建作品向导 / AI 起书',
    userTask: '从灵感创建作品，预览章节、人物、设定后确认创建',
    states: '手动创建、AI 起书、流式等待、方案预览、错误、确认创建',
    issue: '必须保持步骤感和确认写入边界，避免用户不知道 AI 下一步会做什么',
    priority: 'P0'
  },
  bookOverview: {
    title: '书籍总览',
    userTask: '查看作品概况、近期进度、资产健康度和下一步建议',
    states: '空数据、有章节、有角色、有提醒、跳转到具体工具',
    issue: '总览应成为作品 home，不是指标堆叠',
    priority: 'P0'
  },
  aiSettings: {
    title: 'AI 能力与作品配置',
    userTask: '配置作品 AI 档案、上下文策略、能力卡和题材约束',
    states: '默认配置、题材模板、字段过载、保存、失败',
    issue: '字段较多，需要分组、默认值和任务化入口',
    priority: 'P0'
  },
  appSettings: {
    title: '应用设置',
    userTask: '管理外观、账号、AI 全局账号、更新和关于',
    states: '外观、账号云同步、AI 全局账号、更新、保存/检测失败',
    issue: '系统级设置需要和作品级设置边界清楚',
    priority: 'P0'
  },
  projectSettings: {
    title: '作品设置',
    userTask: '设置作品题材、日更目标、模板和作品级偏好',
    states: '默认、题材模板、自定义题材、保存、跳转 AI 设置',
    issue: '作品设置应只承载作品属性，不混入全局账号',
    priority: 'P0'
  },
  commandPalette: {
    title: '命令面板',
    userTask: '用键盘搜索并执行动作',
    states: '空查询、有结果、无结果、执行',
    issue: '应扩展为动作真理源，与按钮/菜单共用 metadata',
    priority: 'P0'
  },
  globalSearch: {
    title: '全局搜索',
    userTask: '搜索作品内容和资产',
    states: '空、搜索中、有结果、无结果、错误',
    issue: '需要和命令面板明确分工',
    priority: 'P0'
  },
  fullCharacters: {
    title: '角色总库',
    userTask: '浏览、筛选、编辑角色与关系',
    states: '空角色、有角色、筛选、关系图、编辑跳转',
    issue: '角色资料和可视化关系需要从列表任务出发',
    priority: 'P1'
  },
  character: {
    title: '角色编辑',
    userTask: '创建或编辑角色资料',
    states: '新建、编辑、校验、保存、删除/关闭',
    issue: '表单字段需要按作者决策顺序组织',
    priority: 'P1'
  },
  settings: {
    title: '设定维基',
    userTask: '管理世界观、地点、术语和设定条目',
    states: '空设定、有分类、搜索、编辑、删除确认',
    issue: '维基需要降低条目创建和归类成本',
    priority: 'P1'
  },
  canonPack: {
    title: '可视化 Canon Pack',
    userTask: '查看关系图谱、时间线、组织架构和角色卡',
    states: '关系图、时间线、组织架构、空数据、跳转编辑',
    issue: '可视化需要服务写作判断，避免只做展示',
    priority: 'P1'
  },
  chapterReview: {
    title: '章节审稿',
    userTask: '审阅当前章节问题并进入修改',
    states: '未选择章节、分析中、问题列表、建议、失败',
    issue: '审稿输出需要结构化为可处理待办',
    priority: 'P1'
  },
  publishCheck: {
    title: '发布前检查',
    userTask: '检查章节发布风险、敏感词、伏笔和格式',
    states: '未选择章节、检查中、风险、通过、失败',
    issue: '发布检查需要用严重级别和可处理动作收口',
    priority: 'P1'
  },
  directorPanel: {
    title: '自动导演主链',
    userTask: '规划章节推进并以草稿篮确认生成内容',
    states: '输入目标、运行中、草稿预览、确认/拒绝、失败',
    issue: '长链 AI 需要强步骤感和强确认边界',
    priority: 'P1'
  },
  worldConsistency: {
    title: '世界一致性检查',
    userTask: '检查角色、设定、伏笔和剧情矛盾',
    states: '选择范围、检查中、问题列表、证据、失败',
    issue: '问题证据和修复路径需要比单纯结果更突出',
    priority: 'P1'
  },
  visualStudio: {
    title: '视觉资产工作室',
    userTask: '生成/管理封面和视觉资产',
    states: '配置、生成中、预览、保存、失败',
    issue: '视觉资产属于低频高价值工作流，需要减少干扰写作主路径',
    priority: 'P2'
  },
  mcpSettings: {
    title: 'MCP 设置',
    userTask: '配置外部工具/服务连接',
    states: '空配置、已配置、检测、失败',
    issue: '技术配置需要错误可解释和默认安全',
    priority: 'P2'
  },
  confirm: {
    title: '确认弹窗',
    userTask: '确认危险操作或不可逆操作',
    states: '普通确认、危险确认、处理中、取消',
    issue: '危险操作需统一文案、按钮色级和默认焦点',
    priority: 'P0'
  }
}

const modalFallback = (name) => ({
  title: name,
  userTask: '完成该弹窗承载的作品管理、分析或设置任务',
  states: '入口、空数据、有数据、编辑、保存、错误、关闭',
  issue: '需要按统一 Dialog shell、主次操作和状态反馈重新审计',
  priority: 'P2'
})

function extractModalTypes(typesSource) {
  const match = typesSource.match(/export type ModalType =([\s\S]*?)\n\nexport interface/)
  if (!match) return []
  return [...match[1].matchAll(/\|\s*'([^']+)'/g)].map((item) => item[1])
}

function extractModalCases(modalManagerSource) {
  const imports = new Map()
  for (const item of modalManagerSource.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g)) {
    imports.set(item[1], item[2])
  }

  const cases = new Map()
  for (const item of modalManagerSource.matchAll(/case\s+'([^']+)':\s+return\s+<(\w+)/g)) {
    const [, modalName, component] = item
    let source = imports.get(component) ?? ''
    if (source.startsWith('./')) source = `src/renderer/src/components/modals/${source.slice(2)}.tsx`
    if (source.startsWith('@/')) source = `src/renderer/src/${source.slice(2)}.tsx`
    cases.set(modalName, { component, source })
  }
  return cases
}

function extractCommands(commandPaletteSource) {
  const commandBlocks = commandPaletteSource
    .split(/\n\s*\{\n\s*id:\s+'/)
    .slice(1)
    .map((chunk) => `id: '${chunk}`)

  return commandBlocks
    .map((block) => {
      const id = block.match(/id:\s+'([^']+)'/)?.[1]
      const label = block.match(/label:\s+'([^']+)'/)?.[1]
      const category = block.match(/category:\s+'([^']+)'/)?.[1]
      if (!id || !label || !category) return null
      return {
        id,
        label,
        category,
        requiresBook: /requiresBook:\s*true/.test(block),
        source: 'src/renderer/src/components/shared/CommandPalette.tsx'
      }
    })
    .filter(Boolean)
}

function buildModalSurfaces(modalTypes, modalCases) {
  return modalTypes.map((modalName, index) => {
    const mapped = modalCases.get(modalName)
    const meta = modalMetadata[modalName] ?? modalFallback(modalName)
    return {
      id: `SURF-MODAL-${String(index + 1).padStart(3, '0')}`,
      kind: 'modal',
      title: meta.title,
      modal: modalName,
      component: mapped?.component ?? 'UNMAPPED',
      source: mapped?.source ?? 'UNMAPPED',
      entry: `openModal('${modalName}') / pushModal('${modalName}')`,
      userTask: meta.userTask,
      states: meta.states,
      issue: meta.issue,
      pattern: 'Unified Dialog shell + Raycast Action Panel + Linear contextual actions',
      priority: meta.priority
    }
  })
}

function buildCommandInventory(commands) {
  const byCategory = new Map()
  for (const command of commands) {
    const list = byCategory.get(command.category) ?? []
    list.push(command)
    byCategory.set(command.category, list)
  }
  return [...byCategory.entries()].map(([category, items]) => ({ category, items }))
}

function renderMarkdown({ surfaces, commands, modalTypes, modalCases }) {
  const missingModalCases = modalTypes.filter((modal) => !modalCases.has(modal))
  const extraModalCases = [...modalCases.keys()].filter((modal) => !modalTypes.includes(modal))
  const lines = []
  lines.push('# Zhengdao Desktop UX Surface Ledger')
  lines.push('')
  lines.push('Generated by: `node scripts/ux/generate-surface-ledger.mjs`')
  lines.push('')
  lines.push('This file is generated from renderer entrypoints. Do not hand-edit ledger rows; edit `scripts/ux/generate-surface-ledger.mjs` or the source entrypoints, then regenerate.')
  lines.push('')
  lines.push('## Coverage Summary')
  lines.push('')
  lines.push(`- Total UX surfaces: ${surfaces.length}`)
  lines.push(`- Fixed workspace/page surfaces: ${fixedSurfaces.length}`)
  lines.push(`- Modal surfaces from ModalType: ${modalTypes.length}`)
  lines.push(`- ModalManager mapped cases: ${modalCases.size}`)
  lines.push(`- CommandPalette commands: ${commands.length}`)
  lines.push(`- Missing ModalManager cases: ${missingModalCases.length ? missingModalCases.join(', ') : 'none'}`)
  lines.push(`- Extra ModalManager cases: ${extraModalCases.length ? extraModalCases.join(', ') : 'none'}`)
  lines.push('')
  lines.push('## Audit Rules')
  lines.push('')
  lines.push('- Every row must move through `not_started -> audited -> designed -> implemented -> verified`.')
  lines.push('- A row is not `verified` until it has before/after screenshot evidence for 1440x900, 1280x800, and 1024-wide viewports in light and dark theme where applicable.')
  lines.push('- Every row must cover empty, populated, loading, error, keyboard, text-overflow, and dangerous-action states when that state can exist.')
  lines.push('- AI write paths must keep preview and explicit user confirmation before writing body text or work assets.')
  lines.push('')
  lines.push('## Surface Ledger')
  lines.push('')
  lines.push('| ID | Priority | Kind | Surface | Source | Entry | User task | Required states | Current UX risk | Reference pattern | Status | Evidence |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const surface of surfaces) {
    lines.push(
      [
        surface.id,
        surface.priority,
        surface.kind,
        surface.title,
        surface.source,
        surface.entry,
        surface.userTask,
        surface.states,
        surface.issue,
        surface.pattern,
        'not_started',
        'before: required; after: required'
      ]
        .map((value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' '))
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    )
  }

  lines.push('')
  lines.push('## Command Inventory')
  lines.push('')
  for (const group of buildCommandInventory(commands)) {
    lines.push(`### ${group.category}`)
    lines.push('')
    lines.push('| Command ID | Label | Requires book | Source | Audit note |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const command of group.items) {
      lines.push(
        `| ${command.id} | ${command.label} | ${command.requiresBook ? 'yes' : 'no'} | ${command.source} | should map to a visible UI entry or documented keyboard path |`
      )
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const [typesSource, modalManagerSource, commandPaletteSource] = await Promise.all([
    readRepoFile('src/renderer/src/types/index.ts'),
    readRepoFile('src/renderer/src/components/modals/ModalManager.tsx'),
    readRepoFile('src/renderer/src/components/shared/CommandPalette.tsx')
  ])

  const modalTypes = extractModalTypes(typesSource)
  const modalCases = extractModalCases(modalManagerSource)
  const commands = extractCommands(commandPaletteSource)
  const modalSurfaces = buildModalSurfaces(modalTypes, modalCases)
  const surfaces = [...fixedSurfaces, ...modalSurfaces]
  const payload = {
    generatedFrom: [
      'src/renderer/src/App.tsx',
      'src/renderer/src/components/layout/WorkspaceLayout.tsx',
      'src/renderer/src/components/layout/TopBar.tsx',
      'src/renderer/src/types/index.ts',
      'src/renderer/src/components/modals/ModalManager.tsx',
      'src/renderer/src/components/shared/CommandPalette.tsx'
    ],
    counts: {
      surfaces: surfaces.length,
      fixedSurfaces: fixedSurfaces.length,
      modalTypes: modalTypes.length,
      modalCases: modalCases.size,
      commands: commands.length
    },
    surfaces,
    commands
  }
  const markdown = renderMarkdown({ surfaces, commands, modalTypes, modalCases })
  const json = `${JSON.stringify(payload, null, 2)}\n`

  if (checkOnly) {
    const existingMarkdown = existsSync(mdOut) ? await readFile(mdOut, 'utf8') : ''
    const existingJson = existsSync(jsonOut) ? await readFile(jsonOut, 'utf8') : ''
    if (existingMarkdown !== markdown || existingJson !== json) {
      console.error('UX surface ledger is stale. Run: node scripts/ux/generate-surface-ledger.mjs')
      process.exit(1)
    }
    console.log(`UX surface ledger is current: ${rel(mdOut)}, ${rel(jsonOut)}`)
    return
  }

  await Promise.all([writeFile(mdOut, markdown), writeFile(jsonOut, json)])
  console.log(`Wrote ${rel(mdOut)}`)
  console.log(`Wrote ${rel(jsonOut)}`)
  console.log(`Surfaces: ${surfaces.length}; modals: ${modalTypes.length}; commands: ${commands.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

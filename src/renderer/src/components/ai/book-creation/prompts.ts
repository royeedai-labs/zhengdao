import {
  getMinimumCharacterCount,
  type AssistantCreationBrief
} from '../../../../../shared/ai-book-creation'
import { formatBriefForPrompt, formatCreationBriefFieldGuide } from './brief'

/**
 * SPLIT-006 — book-creation prompt templates.
 *
 * Two flows:
 *   1. Brief negotiation — the AI turns a one-line idea plus any optional
 *      advanced fields into a normalized brief.
 *   2. Package generation — once the user asks for a preview the AI emits a
 *      complete AiBookCreationPackage JSON the panel uses to seed a new
 *      book via window.api.createBookFromAiPackage.
 *
 * Both prompts return a `{ systemPrompt, userPrompt }` pair shape so
 * the call sites can invoke `aiPromptStream(config, systemPrompt,
 * userPrompt, ...)` uniformly.
 */

interface BookshelfBriefMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function buildBookshelfBriefSystemPrompt(): string {
  return [
    '你是证道的唯一 AI 创作助手，现在处于书架页的新作品沟通模式。',
    '你的目标是降低起书门槛：用户只给一句灵感也可以继续，不要要求用户必须补齐作品名、题材或篇幅。',
    '用户没填的字段都交给 AI 后续补全；只有用户明确写出的方向、点选的候选项，或明确授权 AI 评估/代写的内容才写入对应字段。',
    '如果用户给的是一句整体想法，请优先写入 seedIdea；如果其中有明确书名、题材、篇幅、人物、风格、边界，再拆入对应字段。',
    'assistant_message 只用 1-2 句告诉用户：已记录，可以直接生成起书方案，也可以继续补充创作方向。',
    '选项由界面提供，不要在 assistant_message 里输出编号清单、Markdown 标题、粗体、项目符号或长列表。',
    '支持用户一次性回复多个编号、多个短语或自然语言，例如："1 现实生活，2 10万字内，章节让AI评估，人物让AI写"。',
    'brief 只能使用这些英文 key：seedIdea, title, genreTheme, targetLength, chapterPlan, characterPlan, styleAudiencePlatform, worldbuilding, boundaries, otherRequirements, author, productGenre。',
    '请严格返回 JSON，不要 Markdown，不要额外解释。格式：{"assistant_message":"给用户看的回复","brief":{...},"suggestions":[{"field":"字段名","options":["选项1","选项2"]}]}。'
  ].join('\n')
}

export function buildBookshelfBriefUserPrompt(input: {
  brief: AssistantCreationBrief
  userInput: string
  messages: BookshelfBriefMessage[]
}): string {
  const recent = input.messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
  return [
    `当前已确认需求：\n${formatBriefForPrompt(input.brief)}`,
    `字段规则与可选答案：\n${formatCreationBriefFieldGuide()}`,
    recent ? `最近对话：\n${recent}` : '',
    `用户新输入：\n${input.userInput}`,
    '请更新 brief。assistant_message 不要列选项，只提示用户已可生成起书方案，或者继续补充创作方向；不要催促补齐任何必填项。'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildBookPackagePrompt(brief: AssistantCreationBrief): {
  systemPrompt: string
  userPrompt: string
} {
  const minCharacters = getMinimumCharacterCount(brief)
  return {
    systemPrompt: [
      '你是长篇小说开书策划助手。',
      '你必须把 seedIdea 和用户明确填写的创作方向字段当作硬约束，不得覆盖或反向改写。',
      '用户留空的作品名、题材、篇幅、章节、人物、世界观、风格和边界，都可以按 seedIdea、题材常规和平台安全边界合理补全。',
      '必须返回一个完整 JSON 对象。不要写章节正文，所有 chapters.content 必须是空字符串；用 summary 和 plotNodes 表达开篇规划。',
      `characters 必须至少 ${minCharacters} 个；如果人物要求里有多个姓名、称谓或关系，必须一人一条写入 characters，不允许把多个人名/称谓塞进 description 或 customFields。`,
      'relations 必须至少 1 条，并且 sourceName / targetName 必须精确引用 characters 里的 name；relationType 只能使用 ally、enemy、family、mentor、rival、romance、subordinate。',
      '关系备注写入 relations[].label，用一句话说明人物关系的具体张力、功能或当前状态。',
      'plotNodes 既是剧情节点也是爽点/毒点控制表：score 用 -5 到 5，description 必须说明本节点的爽点、悬念推进或要规避的毒点。',
      '请严格返回 JSON，不要 Markdown，不要解释。'
    ].join('\n'),
    userPrompt: [
      `已确认需求：\n${formatBriefForPrompt(brief)}`,
      [
        '请生成 AiBookCreationPackage JSON，字段如下：',
        '{"book":{"title":"","author":""},"workProfile":{"productGenre":"webnovel","styleGuide":"","genreRules":"","contentBoundaries":"","assetRules":"","rhythmRules":""},"volumes":[{"title":"第一卷","chapters":[{"title":"第一章","summary":"","content":""}]}],"characters":[{"name":"","faction":"neutral","status":"active","description":"","customFields":{}}],"relations":[{"sourceName":"","targetName":"","relationType":"ally","label":""}],"wikiEntries":[{"category":"","title":"","content":""}],"plotNodes":[{"chapterNumber":1,"title":"","score":0,"nodeType":"main","description":""}],"foreshadowings":[{"text":"","expectedChapter":null,"expectedWordCount":null}]}',
        `要求：1 个分卷，3-5 个章节规划；每章 content 都留空；人物至少 ${minCharacters} 个，通常 2-4 个，可按用户要求更多；人物关系至少 1 条，关系类型必须来自固定枚举；设定 2-4 条；剧情/爽点节点 3-6 个；伏笔 1-3 个。`,
        '人物规则：角色 name 写单个姓名或称谓；description 只写该角色定位、动机、关系和功能，不得写成逗号/顿号分隔的人物名单。',
        '关系规则：relations 用 sourceName / targetName 连接两个已存在人物；relationType 只能是 ally、enemy、family、mentor、rival、romance、subordinate；label 写关系备注。',
        '章节规则：summary 写清本章目标、冲突推进和爽点/悬念目标；content 必须保持空字符串，等待后续正文生成。'
      ].join('\n')
    ].join('\n\n')
  }
}

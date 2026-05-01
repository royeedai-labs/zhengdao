import { coerceGenre } from '../../shared/genre'
import { generateAutoCoverForBook, mapBookCoverUrl } from '../book-cover-service'
import {
  AI_BOOK_CREATION_CHARACTER_FIELDS,
  AI_BOOK_CREATION_EMOTION_LABELS,
  AI_BOOK_CREATION_FACTION_LABELS,
  AI_BOOK_CREATION_STATUS_LABELS,
  getAiBookCreationRequirements,
  normalizeCreationRelations,
  normalizeCreationBrief,
  stripBookCreationChapterContent,
  validateBookCreationPackage,
  type AiBookCreationPackage,
  type AssistantCreationBrief
} from '../../shared/ai-book-creation'
import { getDb } from './connection'

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function toHtml(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/<\/?[a-z][^>]*>/i.test(trimmed)) return trimmed
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) =>
      `<p>${paragraph
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

function countWordsFromHtml(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
}

function clampScore(value: unknown): number {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.max(-5, Math.min(5, Math.round(score)))
}

function readSystemDailyGoal(): number {
  const row = getDb().prepare("SELECT value FROM app_state WHERE key = 'system_default_daily_goal'").get() as
    | { value?: string }
    | undefined
  const parsed = Number(row?.value)
  if (!Number.isFinite(parsed)) return 6000
  return Math.max(500, Math.min(50000, Math.round(parsed)))
}

function aiWorkProfileColumns(): Set<string> {
  return new Set(
    (getDb().prepare('PRAGMA table_info(ai_work_profiles)').all() as Array<{ name: string }>).map((column) => column.name)
  )
}

function insertAiWorkProfile(bookId: number, pkg: AiBookCreationPackage, brief: AssistantCreationBrief): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO ai_work_profiles (
      book_id, default_account_id, style_guide, genre_rules, content_boundaries,
      asset_rules, rhythm_rules, context_policy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(book_id) DO UPDATE SET
      style_guide = excluded.style_guide,
      genre_rules = excluded.genre_rules,
      content_boundaries = excluded.content_boundaries,
      asset_rules = excluded.asset_rules,
      rhythm_rules = excluded.rhythm_rules,
      context_policy = excluded.context_policy,
      updated_at = datetime('now','localtime')`
  ).run(
    bookId,
    null,
    cleanText(pkg.workProfile?.styleGuide, brief.styleAudiencePlatform || ''),
    cleanText(pkg.workProfile?.genreRules, [brief.genreTheme, brief.coreConflict].filter(Boolean).join('\n')),
    cleanText(pkg.workProfile?.contentBoundaries, brief.boundaries || ''),
    cleanText(pkg.workProfile?.assetRules, brief.characterPlan || ''),
    cleanText(pkg.workProfile?.rhythmRules, brief.chapterPlan || ''),
    'smart_minimal'
  )

  const columns = aiWorkProfileColumns()
  if (columns.has('genre')) {
    db.prepare("UPDATE ai_work_profiles SET genre = ?, updated_at = datetime('now','localtime') WHERE book_id = ?").run(
      coerceGenre(pkg.workProfile?.productGenre || brief.productGenre),
      bookId
    )
  }
}

export function createBookFromAiPackage(input: {
  brief: AssistantCreationBrief
  package: AiBookCreationPackage
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string; metadata?: unknown }>
}) {
  const requirements = getAiBookCreationRequirements(input.brief)
  const validation = validateBookCreationPackage(input.package, {
    minCharacters: requirements.minCharacters,
    minChapters: requirements.totalChapters,
    minWikiEntries: requirements.minWikiEntries,
    minPlotNodes: requirements.minPlotNodes,
    minForeshadowings: requirements.minForeshadowings
  })
  if (!validation.ok) {
    throw new Error(validation.errors.join('；'))
  }

  const brief = normalizeCreationBrief(input.brief)
  const pkg = stripBookCreationChapterContent(input.package)
  const db = getDb()
  const tx = db.transaction(() => {
    const dailyGoal = readSystemDailyGoal()
    const bookResult = db
      .prepare('INSERT INTO books (title, author) VALUES (?, ?)')
      .run(cleanText(pkg.book.title, brief.title || 'AI 新作品'), cleanText(pkg.book.author, brief.author || ''))
    const bookId = Number(bookResult.lastInsertRowid)

    db.prepare(
      `INSERT INTO project_config (
        book_id, genre, character_fields, faction_labels, status_labels, emotion_labels,
      daily_goal, daily_goal_mode, sensitive_list,
      editor_font, editor_font_size, editor_line_height, editor_width
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bookId,
      'AI 起书',
      JSON.stringify(AI_BOOK_CREATION_CHARACTER_FIELDS),
      JSON.stringify(AI_BOOK_CREATION_FACTION_LABELS),
      JSON.stringify(AI_BOOK_CREATION_STATUS_LABELS),
      JSON.stringify(AI_BOOK_CREATION_EMOTION_LABELS),
      dailyGoal,
      'follow_system',
      'default',
      'serif',
      19,
      2.2,
      'standard'
    )

    insertAiWorkProfile(bookId, pkg, brief)

    let firstChapterId: number | null = null
    pkg.volumes.forEach((volume, volumeIndex) => {
      const volumeResult = db
        .prepare('INSERT INTO volumes (book_id, title, sort_order) VALUES (?, ?, ?)')
        .run(bookId, cleanText(volume.title, `第${volumeIndex + 1}卷`), volumeIndex)
      const volumeId = Number(volumeResult.lastInsertRowid)
      volume.chapters.forEach((chapter, chapterIndex) => {
        const html = toHtml(cleanText(chapter.content))
        const chapterResult = db
          .prepare(
            'INSERT INTO chapters (volume_id, title, content, word_count, summary, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(
            volumeId,
            cleanText(chapter.title, `第${chapterIndex + 1}章`),
            html,
            countWordsFromHtml(html),
            cleanText(chapter.summary),
            chapterIndex
          )
        firstChapterId ??= Number(chapterResult.lastInsertRowid)
      })
    })
    if (firstChapterId == null) throw new Error('缺少章节草稿')

    const characterIdsByName = new Map<string, number>()
    pkg.characters.forEach((character) => {
      const name = cleanText(character.name, '未命名角色')
      const result = db.prepare(
        `INSERT INTO characters (book_id, name, faction, status, custom_fields, description)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        bookId,
        name,
        cleanText(character.faction, 'neutral'),
        cleanText(character.status, 'active'),
        JSON.stringify(character.customFields || {}),
        cleanText(character.description)
      )
      if (!characterIdsByName.has(name)) characterIdsByName.set(name, Number(result.lastInsertRowid))
    })

    normalizeCreationRelations(pkg.relations, Array.from(characterIdsByName.keys())).forEach((relation) => {
      const sourceId = characterIdsByName.get(relation.sourceName)
      const targetId = characterIdsByName.get(relation.targetName)
      if (!sourceId || !targetId) return
      db.prepare(
        `INSERT INTO character_relations (book_id, source_id, target_id, relation_type, label)
         VALUES (?, ?, ?, ?, ?)`
      ).run(bookId, sourceId, targetId, relation.relationType, relation.label)
    })

    pkg.wikiEntries.forEach((entry, index) => {
      db.prepare(
        'INSERT INTO settings_wiki (book_id, category, title, content, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(bookId, cleanText(entry.category, 'AI 设定'), cleanText(entry.title, '未命名设定'), cleanText(entry.content), index)
    })

    pkg.plotNodes.forEach((node, index) => {
      db.prepare(
        `INSERT INTO plot_nodes (book_id, chapter_number, title, score, node_type, description, sort_order, plotline_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        bookId,
        Number.isFinite(Number(node.chapterNumber)) ? Number(node.chapterNumber) : 0,
        cleanText(node.title, '剧情节点'),
        clampScore(node.score),
        node.nodeType === 'branch' ? 'branch' : 'main',
        cleanText(node.description),
        index,
        null
      )
    })

    pkg.foreshadowings.forEach((item) => {
      db.prepare(
        'INSERT INTO foreshadowings (book_id, chapter_id, text, expected_chapter, expected_word_count) VALUES (?, ?, ?, ?, ?)'
      ).run(
        bookId,
        firstChapterId,
        cleanText(item.text, 'AI 伏笔'),
        item.expectedChapter == null ? null : Number(item.expectedChapter),
        item.expectedWordCount == null ? null : Number(item.expectedWordCount)
      )
    })

    const conversationResult = db
      .prepare('INSERT INTO ai_conversations (book_id, title) VALUES (?, ?)')
      .run(bookId, 'AI 起书会话')
    const conversationId = Number(conversationResult.lastInsertRowid)
    const messages = input.messages?.length
      ? input.messages
      : [{ role: 'system' as const, content: '本会话由书架页 AI 起书流程转存。' }]
    messages.forEach((message) => {
      db.prepare('INSERT INTO ai_messages (conversation_id, role, content, metadata) VALUES (?, ?, ?, ?)').run(
        conversationId,
        message.role,
        message.content,
        JSON.stringify(message.metadata || {})
      )
    })
    db.prepare("UPDATE books SET updated_at = datetime('now','localtime') WHERE id = ?").run(bookId)
    return {
      book: db.prepare('SELECT * FROM books WHERE id = ?').get(bookId),
      firstChapterId,
      conversationId,
      genre: coerceGenre(pkg.workProfile?.productGenre || brief.productGenre)
    }
  })

  const result = tx() as {
    book: { id: number; title: string; author: string }
    firstChapterId: number
    conversationId: number
    genre: ReturnType<typeof coerceGenre>
  }
  generateAutoCoverForBook(result.book.id, {
    title: result.book.title,
    author: result.book.author,
    genre: result.genre,
    touchUpdatedAt: false
  })
  return {
    firstChapterId: result.firstChapterId,
    conversationId: result.conversationId,
    book: mapBookCoverUrl(db.prepare('SELECT * FROM books WHERE id = ?').get(result.book.id) as any)
  }
}

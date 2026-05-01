import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { basename, extname, isAbsolute, join, relative } from 'path'
import { app, dialog } from 'electron'
import { coerceGenre, type Genre } from '../shared/genre'
import { getDb } from './database/connection'

export interface BookCoverBook {
  id: number
  title: string
  author?: string | null
  cover_path?: string | null
  genre?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

export interface BookCoverPickerResult {
  path: string
  name: string
  url: string
}

export const BOOK_COVER_PROTOCOL = 'zhengdao-cover'
const COVER_WIDTH = 768
const COVER_HEIGHT = 1024
const AUTO_COVER_FILE = 'auto-cover.svg'
const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const COVER_TEMPLATES: Record<Genre, { background: string; panel: string; accent: string; text: string; muted: string }> = {
  webnovel: {
    background: '#18233a',
    panel: '#243c64',
    accent: '#d5a84d',
    text: '#fff8e7',
    muted: '#d7dfef'
  },
  script: {
    background: '#242222',
    panel: '#3a3530',
    accent: '#d85f4b',
    text: '#fff3ea',
    muted: '#d7cbc0'
  },
  fiction: {
    background: '#24362f',
    panel: '#345142',
    accent: '#c9d7a2',
    text: '#f7fbf0',
    muted: '#d2ddcf'
  },
  academic: {
    background: '#f4f1e8',
    panel: '#d9e4e7',
    accent: '#27546d',
    text: '#172b34',
    muted: '#5f7178'
  },
  professional: {
    background: '#f1f3f5',
    panel: '#d8dee6',
    accent: '#2c5f8f',
    text: '#182532',
    muted: '#5c6875'
  }
}

export function getCoverRoot(): string {
  return join(app.getPath('userData'), 'book-covers')
}

function getBookCoverDir(bookId: number): string {
  return join(getCoverRoot(), `book-${bookId}`)
}

function cleanTitle(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || '未命名作品'
}

function cleanAuthor(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function splitTitleLines(title: string): string[] {
  const chars = Array.from(cleanTitle(title))
  const maxLines = 4
  const maxCharsPerLine = chars.length <= 8 ? 4 : chars.length <= 14 ? 5 : 6
  const lines: string[] = []
  for (let index = 0; index < chars.length && lines.length < maxLines; index += maxCharsPerLine) {
    lines.push(chars.slice(index, index + maxCharsPerLine).join(''))
  }
  if (chars.length > maxLines * maxCharsPerLine) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(1, maxCharsPerLine - 1))}…`
  }
  return lines
}

export function buildAutoCoverSvg(input: { title: string; author?: string | null; genre?: Genre | string | null }): string {
  const genre = coerceGenre(input.genre)
  const template = COVER_TEMPLATES[genre]
  const titleLines = splitTitleLines(input.title)
  const author = cleanAuthor(input.author)
  const titleFontSize = titleLines.length <= 2 ? 76 : titleLines.length === 3 ? 64 : 56
  const lineHeight = Math.round(titleFontSize * 1.2)
  const titleBlockHeight = (titleLines.length - 1) * lineHeight
  const titleStartY = Math.round(COVER_HEIGHT * 0.42 - titleBlockHeight / 2)
  const authorY = titleStartY + titleBlockHeight + 120

  const titleText = titleLines
    .map((line, index) => {
      const y = titleStartY + index * lineHeight
      return `<text x="${COVER_WIDTH / 2}" y="${y}" text-anchor="middle" class="title">${escapeXml(line)}</text>`
    })
    .join('\n    ')
  const authorText = author
    ? `<text x="${COVER_WIDTH / 2}" y="${authorY}" text-anchor="middle" class="author">${escapeXml(author)}</text>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}" role="img" aria-label="${escapeXml(cleanTitle(input.title))}">
  <style>
    .title { font-family: "Noto Serif CJK SC", "Songti SC", "PingFang SC", serif; font-size: ${titleFontSize}px; font-weight: 800; fill: ${template.text}; }
    .author { font-family: "PingFang SC", "Noto Sans CJK SC", sans-serif; font-size: 28px; font-weight: 600; fill: ${template.muted}; }
  </style>
  <rect width="100%" height="100%" fill="${template.background}"/>
  <rect x="64" y="72" width="640" height="880" rx="18" fill="${template.panel}" opacity="0.55"/>
  <rect x="108" y="116" width="552" height="792" rx="8" fill="none" stroke="${template.accent}" stroke-width="3" opacity="0.78"/>
  <rect x="152" y="164" width="464" height="8" rx="4" fill="${template.accent}" opacity="0.85"/>
  <rect x="220" y="852" width="328" height="6" rx="3" fill="${template.accent}" opacity="0.7"/>
  <g>
    ${titleText}
  </g>
  ${authorText}
</svg>
`
}

export function coverPathToPreviewDataUrl(coverPath: string | null | undefined): string | null {
  if (!coverPath || !existsSync(coverPath)) return null
  const ext = extname(coverPath).toLowerCase()
  if (ext === '.svg') {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(readFileSync(coverPath, 'utf8'))}`
  }
  const mimeType =
    ext === '.webp' ? 'image/webp' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        'image/png'
  return `data:${mimeType};base64,${readFileSync(coverPath).toString('base64')}`
}

export function createBookCoverProtocolUrl(book: Pick<BookCoverBook, 'id' | 'cover_path' | 'updated_at'>): string | null {
  if (!book.cover_path) return null
  const version = typeof book.updated_at === 'string' ? book.updated_at : ''
  return `${BOOK_COVER_PROTOCOL}://book/${book.id}?v=${encodeURIComponent(version)}`
}

export function mapBookCoverUrl<T extends BookCoverBook>(book: T): T & { cover_url: string | null } {
  return {
    ...book,
    cover_url: createBookCoverProtocolUrl(book)
  }
}

function isInsideCoverRoot(filePath: string): boolean {
  const coverRoot = realpathSync(getCoverRoot())
  const realFilePath = realpathSync(filePath)
  const rel = relative(coverRoot, realFilePath)
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel)
}

export function getCoverMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.svg') return 'image/svg+xml; charset=utf-8'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return 'image/png'
}

export function resolveBookCoverProtocolPath(rawUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== `${BOOK_COVER_PROTOCOL}:` || parsed.hostname !== 'book') return null
  const id = Number(parsed.pathname.replace(/^\/+/, ''))
  if (!Number.isInteger(id) || id <= 0) return null

  const row = getDb()
    .prepare('SELECT cover_path FROM books WHERE id = ?')
    .get(id) as { cover_path?: string | null } | undefined
  const coverPath = row?.cover_path
  if (!coverPath || !existsSync(coverPath)) return null
  if (!existsSync(getCoverRoot())) return null
  if (!isInsideCoverRoot(coverPath)) return null
  return coverPath
}

export function createBookCoverProtocolResponse(rawUrl: string): Response {
  const coverPath = resolveBookCoverProtocolPath(rawUrl)
  if (!coverPath) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(readFileSync(coverPath)), {
    status: 200,
    headers: {
      'content-type': getCoverMimeType(coverPath),
      'cache-control': 'public, max-age=31536000, immutable'
    }
  })
}

function getBookRow(bookId: number): BookCoverBook {
  const hasProfileGenre = tableHasColumn('ai_work_profiles', 'genre')
  const selectSql = hasProfileGenre
    ? `SELECT b.*, profile.genre AS genre
       FROM books b
       LEFT JOIN ai_work_profiles profile ON profile.book_id = b.id
       WHERE b.id = ?`
    : `SELECT b.*, NULL AS genre
       FROM books b
       WHERE b.id = ?`
  const row = getDb()
    .prepare(selectSql)
    .get(bookId) as BookCoverBook | undefined
  if (!row) throw new Error(`Book ${bookId} not found`)
  return row
}

function tableHasColumn(table: string, column: string): boolean {
  const columns = getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return columns.some((item) => item.name === column)
}

export function generateAutoCoverForBook(
  bookId: number,
  overrides: { title?: string; author?: string | null; genre?: Genre | string | null; touchUpdatedAt?: boolean } = {}
): string {
  const book = getBookRow(bookId)
  const dir = getBookCoverDir(bookId)
  mkdirSync(dir, { recursive: true })
  const coverPath = join(dir, AUTO_COVER_FILE)
  writeFileSync(
    coverPath,
    buildAutoCoverSvg({
      title: overrides.title ?? book.title,
      author: overrides.author ?? book.author,
      genre: overrides.genre ?? book.genre
    }),
    'utf8'
  )
  if (overrides.touchUpdatedAt === false) {
    getDb().prepare('UPDATE books SET cover_path = ? WHERE id = ?').run(coverPath, bookId)
  } else {
    getDb().prepare("UPDATE books SET cover_path = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(coverPath, bookId)
  }
  return coverPath
}

export function ensureAutoCoverForBook(bookId: number): string {
  const book = getBookRow(bookId)
  if (book.cover_path && existsSync(book.cover_path)) return book.cover_path
  return generateAutoCoverForBook(bookId, book)
}

export function ensureMissingBookCovers(): void {
  const hasProfileGenre = tableHasColumn('ai_work_profiles', 'genre')
  const selectSql = hasProfileGenre
    ? `SELECT b.id, b.title, b.author, b.cover_path, profile.genre AS genre
       FROM books b
       LEFT JOIN ai_work_profiles profile ON profile.book_id = b.id`
    : `SELECT b.id, b.title, b.author, b.cover_path, NULL AS genre
       FROM books b`
  const rows = getDb()
    .prepare(selectSql)
    .all() as BookCoverBook[]

  for (const book of rows) {
    if (book.cover_path && existsSync(book.cover_path)) continue
    generateAutoCoverForBook(book.id, { ...book, touchUpdatedAt: false })
  }
}

function assertSupportedUploadPath(sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase()
  if (!SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) {
    throw new Error('仅支持 PNG、JPG、JPEG、WEBP 封面图')
  }
  if (!existsSync(sourcePath)) {
    throw new Error('封面文件不存在')
  }
  return ext
}

export function setBookCoverFromFile(bookId: number, sourcePath: string): string {
  const ext = assertSupportedUploadPath(sourcePath)
  const dir = getBookCoverDir(bookId)
  mkdirSync(dir, { recursive: true })
  const hash = createHash('sha256').update(sourcePath).update(String(Date.now())).digest('hex').slice(0, 12)
  const targetPath = join(dir, `custom-cover-${hash}${ext}`)
  copyFileSync(sourcePath, targetPath)
  getDb().prepare("UPDATE books SET cover_path = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(targetPath, bookId)
  return targetPath
}

export function removeBookCoverDirectory(bookId: number): void {
  rmSync(getBookCoverDir(bookId), { recursive: true, force: true })
}

export async function pickCoverImage(): Promise<BookCoverPickerResult | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: '图片封面', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'PNG', extensions: ['png'] },
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'WEBP', extensions: ['webp'] }
    ]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const sourcePath = result.filePaths[0]
  assertSupportedUploadPath(sourcePath)
  return {
    path: sourcePath,
    name: basename(sourcePath),
    url: coverPathToPreviewDataUrl(sourcePath) || ''
  }
}

export async function chooseCoverImageForBook(bookId: number): Promise<(BookCoverBook & { cover_url: string | null }) | null> {
  const picked = await pickCoverImage()
  if (!picked) return null
  setBookCoverFromFile(bookId, picked.path)
  return mapBookCoverUrl(getBookRow(bookId))
}

export function regenerateAutoCoverForBook(bookId: number): BookCoverBook & { cover_url: string | null } {
  generateAutoCoverForBook(bookId)
  return mapBookCoverUrl(getBookRow(bookId))
}

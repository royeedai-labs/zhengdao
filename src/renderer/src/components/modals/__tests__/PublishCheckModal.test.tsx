import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Book, Chapter, ProjectConfig, Volume } from '@/types'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: '测试作品',
    author: '作者',
    cover_path: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 1,
    volume_id: 1,
    title: '第一章',
    content: '<p>第一段</p><p>第二段</p>',
    word_count: 1200,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function makeVolume(chapters: Chapter[], overrides: Partial<Volume> = {}): Volume {
  return {
    id: 1,
    book_id: 1,
    title: '第一卷',
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    chapters,
    ...overrides
  }
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    id: 1,
    book_id: 1,
    genre: 'urban',
    character_fields: [],
    faction_labels: [],
    status_labels: [],
    emotion_labels: [],
    daily_goal: 6000,
    daily_goal_mode: 'follow_system',
    sensitive_list: 'default',
    ...overrides
  }
}

async function renderPublishCheckModal({
  currentChapter = null,
  volumes = [],
  modalData = null,
  config = makeConfig()
}: {
  currentChapter?: Chapter | null
  volumes?: Volume[]
  modalData?: Record<string, unknown> | null
  config?: ProjectConfig
} = {}) {
  vi.resetModules()

  vi.doMock('@/stores/book-store', () => ({
    useBookStore: (selector: (state: { books: Book[]; currentBookId: number; loading: boolean }) => unknown) =>
      selector({ books: [makeBook()], currentBookId: 1, loading: false })
  }))
  vi.doMock('@/stores/chapter-store', () => ({
    useChapterStore: (selector: (state: { currentChapter: Chapter | null; volumes: Volume[]; loading: boolean }) => unknown) =>
      selector({ currentChapter, volumes, loading: false })
  }))
  vi.doMock('@/stores/config-store', () => ({
    useConfigStore: (selector: (state: { config: ProjectConfig | null; loading: boolean }) => unknown) =>
      selector({ config, loading: false })
  }))
  vi.doMock('@/stores/ui-store', () => ({
    useUIStore: (selector: (state: { closeModal: () => void; modalData: Record<string, unknown> | null }) => unknown) =>
      selector({ closeModal: vi.fn(), modalData })
  }))

  const { default: PublishCheckModal } = await import('../PublishCheckModal')
  return renderToString(<PublishCheckModal />)
}

describe('PublishCheckModal', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('renders with no current chapter selected', async () => {
    await expect(renderPublishCheckModal()).resolves.toContain('暂无可预览的发布稿。')
  })

  it('renders the current chapter preview with no issues', async () => {
    const chapter = makeChapter()

    const html = await renderPublishCheckModal({ currentChapter: chapter })

    expect(html).toContain('发布稿预览')
    expect(html).toContain('第一章')
    expect(html).toContain('未发现发布前阻断问题。')
  })

  it('renders full-book long text from loaded volumes', async () => {
    const first = makeChapter({ id: 1, title: '第一章', content: `<p>${'长段落'.repeat(400)}</p>`, word_count: 1200 })
    const second = makeChapter({ id: 2, title: '第二章', content: `<p>${'后续剧情'.repeat(420)}</p>`, word_count: 1260 })

    const html = await renderPublishCheckModal({
      currentChapter: first,
      volumes: [makeVolume([first, second])],
      modalData: { scope: 'book' }
    })

    expect(html).toContain('测试作品')
    expect(html).toContain('全书')
    expect(html).toContain('第一章')
    expect(html).toContain('第二章')
  })

  it('renders danger and warning states without crashing', async () => {
    const chapter = makeChapter({
      id: 1,
      title: '',
      content: '<p>正文</p>',
      word_count: 13000
    })

    const html = await renderPublishCheckModal({ currentChapter: chapter })

    expect(html).toContain('未命名章节')
    expect(html).toContain('章节标题为空')
    expect(html).toContain('章节字数偏高：13000 字')
  })
})

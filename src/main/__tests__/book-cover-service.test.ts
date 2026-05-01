import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userData: `/tmp/zhengdao-cover-test-${Math.random().toString(36).slice(2)}`,
  coverPath: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => state.userData
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

vi.mock('../database/connection', () => ({
  getDb: () => ({
    prepare: () => ({
      get: () => ({ cover_path: state.coverPath })
    })
  })
}))

import {
  buildAutoCoverSvg,
  createBookCoverProtocolResponse,
  createBookCoverProtocolUrl,
  resolveBookCoverProtocolPath
} from '../book-cover-service'

describe('book cover service', () => {
  it('escapes title and author text in generated SVG', () => {
    const svg = buildAutoCoverSvg({
      title: '长<夜&证道',
      author: 'A "笔名"',
      genre: 'webnovel'
    })

    expect(svg).toContain('长&lt;夜&amp;')
    expect(svg).toContain('A &quot;笔名&quot;')
    expect(svg).not.toContain('长<夜&')
  })

  it('generates stable typography when author is empty and title is long', () => {
    const svg = buildAutoCoverSvg({
      title: '一个非常非常长的作品标题需要自动换行而且明显超出四行限制',
      author: '',
      genre: 'fiction'
    })

    expect(svg).toContain('font-size: 56px')
    expect(svg).not.toContain('class="author"')
    expect(svg).toContain('…')
  })

  it('uses different palettes for different genres', () => {
    const webnovel = buildAutoCoverSvg({ title: '青云志', genre: 'webnovel' })
    const academic = buildAutoCoverSvg({ title: '青云志', genre: 'academic' })

    expect(webnovel).toContain('#18233a')
    expect(academic).toContain('#f4f1e8')
    expect(webnovel).not.toBe(academic)
  })

  it('creates protocol urls instead of inline data urls for persisted book covers', () => {
    const url = createBookCoverProtocolUrl({
      id: 12,
      cover_path: '/tmp/cover.png',
      updated_at: '2026-05-01 10:00:00'
    })

    expect(url).toBe('zhengdao-cover://book/12?v=2026-05-01%2010%3A00%3A00')
    expect(url).not.toContain('data:image')
  })

  it('resolves cover protocol paths only inside the managed cover directory', async () => {
    rmSync(state.userData, { recursive: true, force: true })
    const coverDir = join(state.userData, 'book-covers', 'book-1')
    mkdirSync(coverDir, { recursive: true })
    state.coverPath = join(coverDir, 'auto-cover.svg')
    writeFileSync(state.coverPath, '<svg />', 'utf8')

    expect(resolveBookCoverProtocolPath('zhengdao-cover://book/1?v=ok')).toBe(state.coverPath)
    const response = createBookCoverProtocolResponse('zhengdao-cover://book/1?v=ok')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')

    const outside = join(state.userData, 'outside.svg')
    writeFileSync(outside, '<svg />', 'utf8')
    state.coverPath = outside
    expect(resolveBookCoverProtocolPath('zhengdao-cover://book/1')).toBeNull()
    expect(createBookCoverProtocolResponse('zhengdao-cover://book/1').status).toBe(404)

    rmSync(state.userData, { recursive: true, force: true })
  })
})

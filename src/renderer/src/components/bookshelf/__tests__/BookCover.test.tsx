import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BookCover from '../BookCover'

describe('BookCover', () => {
  it('renders the cover image when cover_url is available', () => {
    const html = renderToString(
      <BookCover book={{ title: '青云志', cover_url: 'data:image/svg+xml,cover' }} className="h-16 w-12" />
    )

    expect(html).toContain('src="data:image/svg+xml,cover"')
    expect(html).toContain('《青云志》封面')
  })

  it('renders a title initial fallback when cover_url is missing', () => {
    const html = renderToString(
      <BookCover book={{ title: '长夜证道', cover_url: null }} className="h-16 w-12" />
    )

    expect(html).toContain('长')
    expect(html).not.toContain('<img')
  })
})

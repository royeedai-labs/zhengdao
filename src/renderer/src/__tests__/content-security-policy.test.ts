import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('renderer content security policy', () => {
  it('allows loopback AI endpoints for renderer fetch requests', () => {
    const html = readFileSync(resolve(process.cwd(), 'src/renderer/index.html'), 'utf8')

    expect(html).toContain("connect-src 'self' https: http://127.0.0.1:* http://localhost:*;")
  })

  it('allows the internal book-cover image protocol without allowing file urls', () => {
    const html = readFileSync(resolve(process.cwd(), 'src/renderer/index.html'), 'utf8')

    expect(html).toContain("img-src 'self' data: blob: zhengdao-cover:;")
    expect(html).not.toContain('file:')
  })
})

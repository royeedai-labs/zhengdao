import { describe, expect, it } from 'vitest'
import { createSensitiveMatcher, findSensitiveMatches } from '../sensitive-highlight'

describe('sensitive word matcher', () => {
  it('returns no matches for an empty word list', () => {
    const matcher = createSensitiveMatcher([])
    expect(findSensitiveMatches('任何文本都不应命中', matcher)).toEqual([])
  })

  it('deduplicates words and finds added sensitive text', () => {
    const matcher = createSensitiveMatcher(['禁词', ' 禁词 ', '危险'])
    expect(matcher.words).toEqual(['禁词', '危险'])
    expect(findSensitiveMatches('这里有禁词，也有危险。', matcher)).toEqual([
      { from: 3, to: 5, word: '禁词' },
      { from: 8, to: 10, word: '危险' }
    ])
  })

  it('handles deleted text by reflecting the current input only', () => {
    const matcher = createSensitiveMatcher(['旧词'])
    expect(findSensitiveMatches('旧词已删除前', matcher)).toHaveLength(1)
    expect(findSensitiveMatches('已删除后', matcher)).toEqual([])
  })

  it('matches across multiline text used by editor paragraphs', () => {
    const matcher = createSensitiveMatcher(['跨段'])
    expect(findSensitiveMatches('第一段跨\n段第二段', matcher)).toEqual([])
    expect(findSensitiveMatches('第一段\n跨段第二段', matcher)).toEqual([
      { from: 4, to: 6, word: '跨段' }
    ])
  })
})

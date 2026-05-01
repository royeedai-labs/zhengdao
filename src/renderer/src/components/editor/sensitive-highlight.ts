import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export type SensitiveMatcher = {
  words: string[]
  maxWordLength: number
}

export const sensitivePluginKey = new PluginKey('sensitiveHighlight')

export function createSensitiveMatcher(words: string[]): SensitiveMatcher {
  const normalized = [...new Set(words.map((word) => word.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  return {
    words: normalized,
    maxWordLength: normalized.reduce((max, word) => Math.max(max, word.length), 0)
  }
}

export function findSensitiveMatches(
  text: string,
  matcher: SensitiveMatcher
): Array<{ from: number; to: number; word: string }> {
  if (matcher.words.length === 0 || !text) return []
  const matches: Array<{ from: number; to: number; word: string }> = []
  for (const word of matcher.words) {
    let idx = 0
    while (idx < text.length) {
      const foundIdx = text.indexOf(word, idx)
      if (foundIdx === -1) break
      matches.push({ from: foundIdx, to: foundIdx + word.length, word })
      idx = foundIdx + word.length
    }
  }
  return matches.sort((a, b) => a.from - b.from || b.to - a.to)
}

function getChangedRanges(tr: Transaction, docSize: number, padding: number): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []
  tr.mapping.maps.forEach((map) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      ranges.push({
        from: Math.max(0, newStart - padding),
        to: Math.min(docSize, newEnd + padding)
      })
    })
  })
  return ranges
}

function buildDecorations(doc: any, matcher: SensitiveMatcher, ranges?: Array<{ from: number; to: number }>): DecorationSet {
  if (matcher.words.length === 0) return DecorationSet.empty
  const decorations: Decoration[] = []
  const withinRange = (from: number, to: number) =>
    !ranges || ranges.some((range) => to >= range.from && from <= range.to)

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const nodeFrom = pos
    const nodeTo = pos + node.text.length
    if (!withinRange(nodeFrom, nodeTo)) return
    for (const match of findSensitiveMatches(node.text, matcher)) {
      decorations.push(
        Decoration.inline(pos + match.from, pos + match.to, {
          class: 'sensitive-word'
        })
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

export function createSensitiveHighlightExtension(words: string[]) {
  const matcher = createSensitiveMatcher(words)
  return Extension.create({
    name: 'sensitiveHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: sensitivePluginKey,
          state: {
            init(_, state) {
              return buildDecorations(state.doc, matcher)
            },
            apply(tr, oldSet) {
              if (!tr.docChanged) return oldSet
              if (matcher.words.length === 0) return DecorationSet.empty
              const ranges = getChangedRanges(tr, tr.doc.content.size, matcher.maxWordLength)
              if (ranges.length === 0) return oldSet.map(tr.mapping, tr.doc)
              const mapped = oldSet.map(tr.mapping, tr.doc)
              const staleDecorations = ranges.flatMap((range) => mapped.find(range.from, range.to))
              return mapped.remove(staleDecorations).add(
                tr.doc,
                buildDecorations(tr.doc, matcher, ranges).find()
              )
            }
          },
          props: {
            decorations(state) {
              return this.getState(state)
            }
          }
        })
      ]
    }
  })
}

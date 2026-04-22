import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

interface MentionItem {
  id: number
  name: string
  faction: string
}

interface Props {
  items: MentionItem[]
  command: (item: { id: string; label: string }) => void
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const MentionList = forwardRef<MentionListRef, Props>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [props.items])

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command({ id: String(item.id), label: item.name })
    }
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    }
  }))

  if (props.items.length === 0) return null

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl py-1 z-50 min-w-[180px] max-h-[200px] overflow-y-auto">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => selectItem(index)}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
            index === selectedIndex
              ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
              : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <span className="font-medium">{item.name}</span>
        </button>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'
export default MentionList

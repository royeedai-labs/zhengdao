import type { Book } from '@/types'
import { memo } from 'react'

interface BookCoverProps {
  book: Pick<Book, 'title' | 'cover_url'>
  className?: string
  fallbackClassName?: string
}

function BookCover({ book, className = '', fallbackClassName = '' }: BookCoverProps) {
  const initial = book.title.charAt(0) || '书'
  return (
    <div className={`overflow-hidden bg-[var(--accent-surface)] ${className}`}>
      {book.cover_url ? (
        <img src={book.cover_url} alt={`《${book.title}》封面`} className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-[var(--accent-surface)] text-[var(--accent-secondary)] ${fallbackClassName}`}
        >
          <span className="font-serif text-2xl font-bold">{initial}</span>
        </div>
      )}
    </div>
  )
}

export default memo(BookCover)

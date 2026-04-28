import { useId, type SVGProps } from 'react'

interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number
  title?: string
}

export default function BrandMark({ size = 32, title = '证道', ...props }: BrandMarkProps) {
  const generatedTitleId = useId()
  const titleId = title ? generatedTitleId : undefined

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-labelledby={titleId}
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <rect width="64" height="64" rx="14.5" fill="#f8faf7" />
      <path
        d="M19 22.25H44.5L28.25 41.75H45.5"
        fill="none"
        stroke="#14283a"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.25"
      />
    </svg>
  )
}

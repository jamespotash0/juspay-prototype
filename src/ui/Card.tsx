import type { HTMLAttributes, ReactNode } from 'react'

type Padding = 'none' | 'sm' | 'md'

const PAD: Record<Padding, string> = { none: '', sm: 'p-4', md: 'p-5 sm:p-6' }

/** The one surface: white, 14px radius, hairline, faint shadow. Never nest one Card in another. */
export function Card({
  as: Tag = 'div',
  padding = 'md',
  className = '',
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'aside' | 'article' | 'li'
  padding?: Padding
}) {
  return (
    <Tag
      className={`rounded-card border border-rule bg-paper shadow-card ${PAD[padding]} ${className}`}
      {...rest}
    />
  )
}

/** Section heading inside or above a Card, with an optional right-side action. */
export function SectionHeading({
  children,
  action,
  id,
  className = '',
}: {
  children: ReactNode
  action?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h2 id={id} className="text-lg font-bold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  )
}

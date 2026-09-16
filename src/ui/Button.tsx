import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-accent bg-paper text-accent hover:bg-accent/5',
  quiet: 'text-accent underline-offset-3 hover:underline',
  danger:
    'border border-state-failed bg-paper text-state-failed hover:bg-state-failed-bg',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-slab px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:border-rule disabled:bg-state-neutral-bg disabled:text-ink-muted disabled:line-through ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

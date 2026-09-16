export type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type Size = 'md' | 'sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'rounded-full bg-primary text-primary-ink hover:bg-primary-hover',
  secondary:
    'rounded-full border border-rule-strong bg-paper text-ink hover:border-ink hover:bg-bone',
  quiet: 'rounded-control text-accent underline-offset-3 hover:underline',
  danger:
    'rounded-full border border-state-failed/50 bg-paper text-state-failed hover:border-state-failed hover:bg-state-failed-bg',
}

const SIZES: Record<Size, string> = {
  md: 'h-10 px-5 text-sm',
  sm: 'h-8 px-3.5 text-[13px]',
}

/** Class string for links that should look like a Button (e.g. <Link className={buttonClass('secondary')}>). */ export const buttonClass =
  (variant: Variant = 'primary', size: Size = 'md') =>
    `inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:border-rule disabled:bg-bone disabled:text-ink-muted ${SIZES[size]} ${VARIANTS[variant]}`

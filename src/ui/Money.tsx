import type { Cents } from '../shared/types'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Cents → "$1,956.00" in tabular figures. */
export function Money({ cents, className = '' }: { cents: Cents; className?: string }) {
  return <span className={`money ${className}`}>{usd.format(cents / 100)}</span>
}

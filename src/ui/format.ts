// Formatting shared by pages. Kept out of .tsx files so those export components only.

import { COPY } from '../shared/copy.ts'
import { PERSONAS, SELLERS } from '../shared/seed.ts'
import type { Listing, OrderView } from '../shared/types.ts'

/** "PCGS MS-65", without doubling a service the grade already names ("PSA 9"). */
export function gradeLabel(l: Listing): string {
  if (!l.graded) return COPY.listing.raw
  if (l.service && l.grade?.startsWith(l.service)) return l.grade
  return [l.service, l.grade].filter(Boolean).join(' ')
}

/** "12", "12.5", "1,800.00" → integer cents; anything else → null. */
export function dollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, '').replaceAll(',', '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** Cents as a plain string, for places a <Money> element can't go (a dialog title, an error). */
export const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  )

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export const personName = (id: string) =>
  PERSONAS.find((p) => p.id === id)?.name ??
  SELLERS.find((s) => s.id === id)?.handle ??
  (id || '—')

/** Refund pill words where the default label is not specific enough. */
export const refundLabel = ({ refund }: OrderView) =>
  refund.state === 'pending'
    ? COPY.refundPill.pending
    : refund.state === 'failed'
      ? COPY.refundPill.failed
      : undefined

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

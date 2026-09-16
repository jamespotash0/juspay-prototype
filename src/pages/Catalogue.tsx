import { useState } from 'react'
import { useListings } from '../lib/listings.ts'
import { navigate } from '../lib/router.tsx'
import { COPY } from '../shared/copy.ts'
import { SELLERS } from '../shared/seed.ts'
import type { Listing } from '../shared/types.ts'
import { EmptyState } from '../ui/EmptyState.tsx'
import { ListingTile } from '../ui/ListingTile.tsx'
import { PageLayout, setSearchQuery, useSearchQuery } from './Layout.tsx'

type Chip = 'coin' | 'card' | 'graded' | 'raw' | 'free'

const CHIPS: { id: Chip; label: string }[] = [
  { id: 'coin', label: 'Coins' },
  { id: 'card', label: 'Cards' },
  { id: 'graded', label: 'Graded' },
  { id: 'raw', label: 'Raw' },
  { id: 'free', label: 'Free shipping' },
]

// Chips in the same pair (Coins/Cards, Graded/Raw) widen; different pairs narrow.
function matches(l: Listing, on: Set<Chip>, q: string): boolean {
  if ((on.has('coin') || on.has('card')) && !on.has(l.category)) return false
  if ((on.has('graded') || on.has('raw')) && !on.has(l.graded ? 'graded' : 'raw'))
    return false
  if (on.has('free') && l.shippingCents !== 0) return false
  if (!q) return true
  const seller = SELLERS.find((s) => s.id === l.sellerId)
  const haystack = [
    l.title,
    l.service,
    l.grade,
    l.certNumber,
    l.year,
    l.mintMark,
    seller?.handle,
  ]
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

export default function Catalogue() {
  const listings = useListings()
  const q = useSearchQuery().trim()
  const [on, setOn] = useState<Set<Chip>>(new Set())

  const newestFirst = [...listings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = newestFirst.filter((l) => matches(l, on, q))

  function toggle(chip: Chip) {
    const next = new Set(on)
    if (next.has(chip)) next.delete(chip)
    else next.add(chip)
    setOn(next)
  }

  function clear() {
    setOn(new Set())
    setSearchQuery('')
  }

  return (
    <PageLayout>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={on.has(c.id)}
            onClick={() => toggle(c.id)}
            className="h-8 rounded-full border border-rule bg-paper px-3 text-sm font-medium hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
          >
            {c.label}
          </button>
        ))}
        <p className="money ml-auto text-sm text-ink-muted" aria-live="polite">
          {shown.length} of {listings.length}
          {q && (
            <>
              {' '}
              for <span className="font-semibold text-ink">“{q}”</span>
            </>
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <>
          <EmptyState
            title={COPY.empty.noResults.title}
            fact={COPY.empty.noResults.fact}
            action={{ label: COPY.empty.noResults.action, onClick: clear }}
          />
          {/* Never a bare page: the real catalogue sits under the empty state. */}
          <h2 className="mt-8 mb-4 font-display text-lg font-bold">All listings</h2>
          <Grid listings={newestFirst} />
        </>
      ) : (
        <Grid listings={shown} />
      )}
    </PageLayout>
  )
}

function Grid({ listings }: { listings: Listing[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {listings.map((l) => {
        const seller = SELLERS.find((s) => s.id === l.sellerId)
        if (!seller) return null
        return (
          <li key={l.id} className="relative grid">
            <ListingTile
              listing={l}
              seller={seller}
              href={`/listing/${l.id}`}
              onNavigate={navigate}
            />
            {l.shippingCents === 0 && (
              <span className="pointer-events-none absolute top-2 left-2 rounded-slab border border-rule bg-paper px-1.5 py-0.5 text-xs font-semibold">
                Free shipping
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

import { useState } from 'react'
import { useListings } from '../lib/listings.ts'
import { navigate, useSearchParams } from '../lib/navigation.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { SELLERS } from '../shared/seed.ts'
import type { Listing } from '../shared/types.ts'
import { EmptyState } from '../ui/EmptyState.tsx'
import { ListingTile } from '../ui/ListingTile.tsx'
import { PageLayout } from './Layout.tsx'

type Chip = 'coin' | 'card' | 'graded' | 'raw' | 'free'

const CHIPS = Object.entries(COPY.catalogue.chips) as [Chip, string][]

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
  const sold = useSoldIds()
  // Sold one-of-ones leave the catalogue; the listing page still says Sold for anyone with the link.
  const listings = useListings().filter((l) => !sold.has(l.id))
  const q = (useSearchParams().get('q') ?? '').trim()
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
    navigate('/', { replace: true })
  }

  return (
    <PageLayout>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CHIPS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={on.has(id)}
            onClick={() => toggle(id)}
            className="h-8 rounded-full border border-rule bg-paper px-3 text-sm font-medium hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
          >
            {label}
          </button>
        ))}
        <p className="money ml-auto text-sm text-ink-muted" aria-live="polite">
          {shown.length} {COPY.catalogue.of} {listings.length}
          {q && (
            <>
              {' '}
              {COPY.catalogue.for} <span className="font-semibold text-ink">“{q}”</span>
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
          <h2 className="mt-8 mb-4 font-display text-lg font-bold">
            {COPY.catalogue.allListings}
          </h2>
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
          <li key={l.id} className="grid">
            <ListingTile
              listing={l}
              seller={seller}
              href={`/listing/${l.id}`}
              onNavigate={navigate}
            />
          </li>
        )
      })}
    </ul>
  )
}

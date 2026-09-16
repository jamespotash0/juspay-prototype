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
const PAGE_SIZE = 24

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
  const params = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [on, setOn] = useState<Set<Chip>>(new Set())

  const newestFirst = [...listings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = newestFirst.filter((l) => matches(l, on, q))
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1))

  /** Same search, another page. */
  function pageHref(n: number) {
    const next = new URLSearchParams(params)
    if (n === 1) next.delete('page')
    else next.set('page', String(n))
    const qs = next.toString()
    return qs ? `/?${qs}` : '/'
  }

  function toggle(chip: Chip) {
    const next = new Set(on)
    if (next.has(chip)) next.delete(chip)
    else next.add(chip)
    setOn(next)
    if (page !== 1) navigate(pageHref(1), { replace: true })
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
          <Grid listings={newestFirst.slice(0, PAGE_SIZE)} />
        </>
      ) : (
        <>
          <Grid listings={shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} />
          {pages > 1 && (
            <nav
              aria-label={COPY.catalogue.pagination}
              className="money mt-8 flex items-center justify-center gap-4 text-sm"
            >
              <PageLink href={pageHref(page - 1)} disabled={page === 1}>
                {COPY.catalogue.prev}
              </PageLink>
              <span className="text-ink-muted" aria-current="page">
                {COPY.catalogue.page} {page} {COPY.catalogue.of} {pages}
              </span>
              <PageLink href={pageHref(page + 1)} disabled={page === pages}>
                {COPY.catalogue.next}
              </PageLink>
            </nav>
          )}
        </>
      )}
    </PageLayout>
  )
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: string
}) {
  const box = 'inline-flex h-9 items-center rounded-slab border px-3 font-semibold'
  if (disabled)
    return (
      <span aria-disabled="true" className={`${box} border-rule text-ink-muted`}>
        {children}
      </span>
    )
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        navigate(href)
      }}
      className={`${box} border-accent text-accent hover:bg-accent/5`}
    >
      {children}
    </a>
  )
}

function Grid({ listings }: { listings: Listing[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

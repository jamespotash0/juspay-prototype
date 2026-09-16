import { useEffect, useRef, useState } from 'react'
import { useListings } from '../lib/listings.ts'
import { navigate, useSearchParams } from '../lib/navigation.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { SELLERS } from '../shared/seed.ts'
import type { Listing } from '../shared/types.ts'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon } from '../ui/Icon.tsx'
import { ListingTile } from '../ui/ListingTile.tsx'
import { PageLayout } from './Layout.tsx'

type Chip = 'coin' | 'card' | 'graded' | 'raw' | 'free'

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

  function search(text: string) {
    const next = new URLSearchParams()
    if (text) next.set('q', text)
    const qs = next.toString()
    navigate(qs ? `/?${qs}` : '/', { replace: true })
  }

  function clear() {
    setOn(new Set())
    navigate('/', { replace: true })
  }

  return (
    <PageLayout>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="relative min-w-0 grow basis-60 sm:max-w-md"
        >
          <label className="sr-only" htmlFor="catalogue-search">
            {COPY.shell.searchLabel}
          </label>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="catalogue-search"
            type="search"
            value={params.get('q') ?? ''}
            onChange={(e) => search(e.target.value)}
            placeholder={COPY.shell.searchPlaceholder}
            className="h-10 w-full rounded-slab border border-rule bg-paper pr-3 pl-9 text-sm placeholder:text-ink-muted focus-visible:border-accent"
          />
        </form>
        <Filters
          on={on}
          toggle={toggle}
          reset={() => setOn(new Set())}
          count={`${shown.length} ${COPY.catalogue.of} ${listings.length}`}
        />
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

/** A multi-select dropdown: native <details>, closed by Escape or a click outside. */
function Filters({
  on,
  toggle,
  reset,
  count,
}: {
  on: Set<Chip>
  toggle: (chip: Chip) => void
  reset: () => void
  /** "6 of 100": the results counter lives with the filters that change it. */
  count: string
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current
      if (!el?.open) return
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)
      )
        el.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  const T = COPY.catalogue
  return (
    <details ref={ref} className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-slab border border-rule bg-paper px-3 text-sm font-medium hover:border-accent group-open:border-accent [&::-webkit-details-marker]:hidden">
        {T.filters}
        {on.size > 0 && (
          <span className="money inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink">
            {on.size}
          </span>
        )}
        <Icon
          name="chevronDown"
          className="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-56 rounded-slab border border-rule bg-paper p-3 shadow-lg">
        {T.filterGroups.map((g) => (
          <fieldset key={g.label} className="mb-3 last:mb-2">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {g.label}
            </legend>
            {(g.chips as readonly Chip[]).map((id) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-bone"
              >
                <input
                  type="checkbox"
                  checked={on.has(id)}
                  onChange={() => toggle(id)}
                  className="size-4 accent-accent"
                />
                {T.chips[id]}
              </label>
            ))}
          </fieldset>
        ))}
        <div className="flex items-center justify-between gap-2 border-t border-rule pt-2 text-sm">
          <p className="money text-ink-muted" aria-live="polite">
            {count} {T.results}
          </p>
          {on.size > 0 && (
            <button
              type="button"
              onClick={reset}
              className="font-medium text-accent hover:underline"
            >
              {T.clearFilters}
            </button>
          )}
        </div>
      </div>
    </details>
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

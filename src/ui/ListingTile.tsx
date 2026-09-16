import type { MouseEvent } from 'react'
import type { Listing, Seller } from '../shared/types'
import { COPY } from '../shared/copy'
import { gradeLabel } from './format'
import { Icon } from './Icon'
import { Money } from './Money'
import { Slab } from './Slab'

interface ListingTileProps {
  listing: Listing
  seller: Seller
  href: string
  onNavigate?: (href: string) => void
  watched?: boolean
  onToggleWatch?: () => void
}

const T = COPY.tile

export function ListingTile({
  listing: l,
  seller,
  href,
  onNavigate,
  watched = false,
  onToggleWatch,
}: ListingTileProps) {
  const open = (e: MouseEvent) => {
    if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    onNavigate(href)
  }

  const specs = [
    { value: gradeLabel(l), label: T.grade, wide: false },
    l.certNumber ? { value: `#${l.certNumber}`, label: T.cert, wide: true } : null,
    l.year ? { value: String(l.year), label: T.year, wide: false } : null,
  ].filter((s) => s !== null)

  return (
    <div className="relative grid">
      <a
        href={href}
        onClick={open}
        className="group flex flex-col overflow-hidden rounded-card border border-rule bg-paper shadow-card transition-[border-color,box-shadow] hover:border-rule-strong hover:shadow-pop"
      >
        {/* Photo well: the whole item, never cropped. */}
        <div className="aspect-[5/4] min-h-0 border-b border-rule bg-paper p-2.5">
          <Slab listing={l} />
        </div>

        <div className="@container flex flex-1 flex-col px-3 pt-2.5 pb-2">
          <Money
            cents={l.priceCents}
            className="text-base leading-tight font-bold tracking-tight sm:text-lg"
          />
          <h3 className="mt-0.5 line-clamp-2 min-h-[2lh] text-xs leading-snug font-medium sm:text-[13px]">
            {l.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-ink-muted">
            {l.shippingCents === 0 ? (
              COPY.common.freeShipping
            ) : (
              <>
                + <Money cents={l.shippingCents} /> {COPY.common.plusShipping}
              </>
            )}
            {' · '}
            {seller.shipsFrom}
          </p>

          <dl className="money mt-2 grid grid-cols-2 gap-x-3 border-y border-rule py-1.5 @[15rem]:grid-cols-3">
            {specs.map((s) => (
              <div
                key={s.label}
                className={`min-w-0 flex-col-reverse ${s.wide ? 'hidden @[15rem]:flex' : 'flex'}`}
              >
                <dt className="truncate text-[10px] text-ink-muted">{s.label}</dt>
                <dd className="truncate text-xs font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center justify-between gap-2 pt-1.5 text-[11px]">
            <p className="money flex min-w-0 items-center gap-1 text-ink-muted">
              <Icon name="star" className="size-3 fill-current text-ink" />
              <span className="font-semibold text-ink">{seller.rating.toFixed(1)}</span>
              <span className="truncate">· {seller.handle}</span>
            </p>
            <span className="hidden shrink-0 font-semibold text-ink group-hover:underline @[13rem]:inline">
              {T.viewDetails}
            </span>
          </div>
        </div>
      </a>
      {/* A sibling of the link, not inside it: a button can't nest in an <a>. */}
      {onToggleWatch && (
        <button
          type="button"
          onClick={onToggleWatch}
          aria-pressed={watched}
          aria-label={watched ? T.unwatch : T.watch}
          title={watched ? T.unwatch : T.watch}
          className={`absolute top-2 right-2 grid size-8 place-items-center rounded-full border border-rule bg-paper/90 shadow-card backdrop-blur hover:border-rule-strong ${watched ? 'text-state-failed' : 'text-ink-muted hover:text-ink'}`}
        >
          <Icon name="heart" className={`size-4 ${watched ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  )
}

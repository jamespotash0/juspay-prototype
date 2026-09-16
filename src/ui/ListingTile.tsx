import type { MouseEvent } from 'react'
import type { Listing, Seller } from '../shared/types'
import { COPY } from '../shared/copy'
import { gradeLabel } from './format'
import { Money } from './Money'

interface ListingTileProps {
  listing: Listing
  seller: Seller
  href: string
  onNavigate?: (href: string) => void
}

export function ListingTile({ listing, seller, href, onNavigate }: ListingTileProps) {
  const open = (e: MouseEvent) => {
    if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    onNavigate(href)
  }
  const grade = gradeLabel(listing)

  return (
    <a
      href={href}
      onClick={open}
      className="group flex flex-col overflow-hidden rounded-slab border border-rule bg-paper hover:border-ink"
    >
      <div className="aspect-square border-b border-rule bg-bone">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          loading="lazy"
          className="size-full object-contain p-3"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Money cents={listing.priceCents} className="text-lg font-bold" />
        <h3 className="line-clamp-2 text-sm leading-snug group-hover:underline">
          {listing.title}
        </h3>
        <p className="text-xs text-ink-muted">
          {listing.shippingCents === 0 ? (
            <span className="font-semibold text-ink">{COPY.common.freeShipping}</span>
          ) : (
            <>
              + <Money cents={listing.shippingCents} /> {COPY.common.plusShipping}
            </>
          )}
        </p>
        <dl className="money mt-auto flex flex-wrap items-center gap-x-1.5 border-t border-rule pt-2 text-xs text-ink-muted">
          <dt className="sr-only">Grade</dt>
          <dd className="font-semibold text-ink">{grade}</dd>
          {listing.certNumber && (
            <>
              <span aria-hidden="true">·</span>
              <dt className="sr-only">Cert</dt>
              <dd>#{listing.certNumber}</dd>
            </>
          )}
          <span aria-hidden="true">·</span>
          <dt className="sr-only">Seller</dt>
          <dd>
            {seller.handle} {seller.rating.toFixed(1)}
          </dd>
        </dl>
      </div>
    </a>
  )
}

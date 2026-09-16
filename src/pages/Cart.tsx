import { groupBySeller, removeFromCart, useCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { useSession } from '../lib/session.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { breakdown } from '../shared/money.ts'
import { PERSONAS, SELLERS } from '../shared/seed.ts'
import type { Cents } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/Card.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { gradeLabel } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.cart

function Shipping({ cents }: { cents: Cents }) {
  return cents === 0 ? <span>{COPY.common.freeShipping}</span> : <Money cents={cents} />
}

export default function Cart() {
  const listings = useListings()
  // Public page: signed out, checkout goes through sign-in.
  const persona = useSession()?.persona
  const sold = useSoldIds()
  const isAdmin = PERSONAS.find((p) => p.id === persona)?.kind === 'admin'
  const groups = [...groupBySeller(useCart(), listings)]

  if (groups.length === 0)
    return (
      <PageLayout title={T.title}>
        <EmptyState
          title={COPY.empty.cart.title}
          fact={COPY.empty.cart.fact}
          action={{ label: COPY.empty.cart.action, onClick: () => navigate('/') }}
        />
      </PageLayout>
    )

  return (
    <PageLayout title={T.title} width="narrow">
      <p className="-mt-2 mb-5 max-w-[65ch] text-sm text-ink-muted sm:-mt-3">
        {groups.length > 1 ? T.manySellers(groups.length) : T.oneSeller}
      </p>

      <div className="flex flex-col gap-4">
        {groups.map(([sellerId, lines]) => {
          const seller = SELLERS.find((s) => s.id === sellerId)
          const handle = seller?.handle ?? sellerId
          // Sold lines stay visible so the buyer knows why, but never reach checkout or the subtotal.
          const open = lines.filter((line) => !sold.has(line.listingId))
          const b = breakdown(open, listings)
          return (
            <Card
              as="section"
              padding="none"
              key={sellerId}
              aria-labelledby={`seller-${sellerId}`}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule px-4 py-3.5 sm:px-5">
                <h2
                  id={`seller-${sellerId}`}
                  className="text-base font-bold tracking-tight"
                >
                  {handle}
                </h2>
                {seller && (
                  <p className="money text-xs text-ink-muted">
                    {seller.rating.toFixed(1)} {COPY.listing.rating} ·{' '}
                    {COPY.common.shipsFrom} {seller.shipsFrom}
                  </p>
                )}
              </header>

              <ul className="divide-y divide-rule">
                {lines.map((line) => {
                  const l = listings.find((x) => x.id === line.listingId)!
                  const isSold = sold.has(l.id)
                  return (
                    <li
                      key={l.id}
                      className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5"
                    >
                      <img
                        src={l.imageUrl}
                        alt=""
                        className="size-16 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Link
                          to={`/listing/${l.id}`}
                          className="line-clamp-2 text-sm font-semibold hover:underline"
                        >
                          {l.title}
                        </Link>
                        {isSold && (
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                            <StatusPill status="sold" />
                            {COPY.sold.cartLine}
                          </p>
                        )}
                        <p className="money text-xs text-ink-muted">
                          {gradeLabel(l)}
                          {l.certNumber && ` · #${l.certNumber}`}
                          {line.qty > 1 && ` · ${T.qty} ${line.qty}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(l.id)}
                          className="mt-1 self-start text-xs font-medium text-accent hover:underline"
                        >
                          {T.remove}
                        </button>
                      </div>
                      <div
                        className={`shrink-0 text-right text-sm ${isSold ? 'text-ink-muted line-through' : ''}`}
                      >
                        <Money
                          cents={l.priceCents * line.qty}
                          className="font-semibold"
                        />
                        <p className="text-xs text-ink-muted">
                          {l.shippingCents === 0 ? (
                            COPY.common.freeShipping
                          ) : (
                            <>
                              + <Money cents={l.shippingCents * line.qty} />{' '}
                              {COPY.common.plusShipping}
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-col gap-3 rounded-b-card border-t border-rule bg-well px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
                {open.length > 0 && (
                  <dl className="money grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-sm sm:min-w-56">
                    <dt className="text-ink-muted">{T.items}</dt>
                    <dd className="text-right">
                      <Money cents={b.itemsCents} />
                    </dd>
                    <dt className="text-ink-muted">{T.shipping}</dt>
                    <dd className="text-right">
                      <Shipping cents={b.shippingCents} />
                    </dd>
                    <dt className="font-semibold">{T.subtotal}</dt>
                    <dd className="text-right font-semibold">
                      <Money cents={b.itemsCents + b.shippingCents} />
                    </dd>
                    <dd className="col-span-2 text-xs text-ink-muted">{T.taxLater}</dd>
                  </dl>
                )}
                {open.length === 0 ? (
                  <p className="text-sm text-ink-muted">{COPY.sold.groupAllSold}</p>
                ) : sellerId === persona ? (
                  <p className="text-sm font-semibold">{T.own}</p>
                ) : isAdmin ? (
                  <p className="text-sm text-ink-muted">{T.admin}</p>
                ) : (
                  <Button onClick={() => navigate(`/checkout/${sellerId}`)}>
                    {T.checkOutWith(handle)}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </PageLayout>
  )
}

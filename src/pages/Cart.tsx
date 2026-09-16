import { groupBySeller, removeFromCart, useCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { breakdown } from '../shared/money.ts'
import { PERSONAS, SELLERS } from '../shared/seed.ts'
import type { Cents } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { gradeLabel } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.cart

function Shipping({ cents }: { cents: Cents }) {
  return cents === 0 ? <span>{COPY.common.freeShipping}</span> : <Money cents={cents} />
}

export default function Cart() {
  const listings = useListings()
  const persona = usePersona()
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
    <PageLayout title={T.title}>
      <div className="max-w-3xl">
        <p className="-mt-3 mb-6 max-w-[65ch] text-sm text-ink-muted">
          {groups.length > 1 ? T.manySellers(groups.length) : T.oneSeller}
        </p>

        <div className="flex flex-col gap-6">
          {groups.map(([sellerId, lines]) => {
            const seller = SELLERS.find((s) => s.id === sellerId)
            const handle = seller?.handle ?? sellerId
            const b = breakdown(lines, listings)
            return (
              <section
                key={sellerId}
                aria-labelledby={`seller-${sellerId}`}
                className="rounded-slab border border-rule bg-paper"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule px-4 py-3">
                  <h2
                    id={`seller-${sellerId}`}
                    className="font-display text-base font-bold"
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

                <ul>
                  {lines.map((line) => {
                    const l = listings.find((x) => x.id === line.listingId)!
                    return (
                      <li
                        key={l.id}
                        className="flex gap-3 border-b border-rule px-4 py-3 last:border-b-0"
                      >
                        <img
                          src={l.imageUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-slab border border-rule bg-bone object-contain p-1"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <Link
                            to={`/listing/${l.id}`}
                            className="font-medium hover:underline"
                          >
                            {l.title}
                          </Link>
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
                        <div className="text-right text-sm">
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

                <div className="flex flex-col gap-3 border-t border-rule bg-bone/60 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
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
                  {sellerId === persona ? (
                    <p className="text-sm font-semibold">{T.own}</p>
                  ) : isAdmin ? (
                    <p className="text-sm text-ink-muted">{T.admin}</p>
                  ) : (
                    <Button onClick={() => navigate(`/checkout/${sellerId}`)}>
                      {T.checkOutWith(handle)}
                    </Button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </PageLayout>
  )
}

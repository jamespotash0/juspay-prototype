import { addToCart, useCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { navigate, type Params } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { useSession } from '../lib/session.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS, SELLERS } from '../shared/seed.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { gradeLabel, plural } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.listing

export default function Listing({ params }: { params: Params }) {
  const listing = useListings().find((l) => l.id === params.id)
  const seller = SELLERS.find((s) => s.id === listing?.sellerId)
  // Public page: signed out, nobody is the seller and Buy now goes through sign-in.
  const persona = useSession()?.persona
  const sold = useSoldIds().has(params.id)
  const inCart = useCart().some((l) => l.listingId === params.id)

  if (!listing || !seller)
    return (
      <PageLayout title={T.notFoundTitle}>
        <EmptyState
          title={T.notFound}
          fact={T.notFoundFact}
          action={{ label: COPY.empty.cart.action, onClick: () => navigate('/') }}
        />
      </PageLayout>
    )

  const isAdmin = PERSONAS.find((p) => p.id === persona)?.kind === 'admin'
  const isOwn = listing.sellerId === persona

  function buyNow() {
    if (!inCart) addToCart(listing!.id)
    navigate(`/checkout/${listing!.sellerId}`)
  }

  const specs: [string, string | number | undefined][] = [
    [T.specs.service, listing.service],
    [T.specs.grade, listing.graded ? listing.grade : T.rawLong],
    [T.specs.cert, listing.certNumber],
    [T.specs.year, listing.year],
    [T.specs.mintMark, listing.mintMark],
    [T.specs.category, listing.category === 'coin' ? T.coin : T.card],
  ]

  return (
    <PageLayout>
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        {T.back}
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-2 lg:gap-10">
        <div className="aspect-square rounded-slab border border-rule bg-paper md:sticky md:top-20 md:self-start">
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="size-full object-contain p-6"
          />
        </div>

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-balance lg:text-3xl">
              {listing.title}
            </h1>
            <p className="money text-sm font-semibold">
              {gradeLabel(listing)}
              {listing.certNumber && (
                <span className="font-normal text-ink-muted">
                  {' '}
                  · {T.cert} #{listing.certNumber}
                </span>
              )}
            </p>
            <Money cents={listing.priceCents} className="mt-1 text-3xl font-bold" />
            <p className="text-sm text-ink-muted">
              {listing.shippingCents === 0 ? (
                <span className="font-semibold text-ink">{COPY.common.freeShipping}</span>
              ) : (
                <>
                  + <Money cents={listing.shippingCents} /> {COPY.common.plusShipping}
                </>
              )}
              {' · '}
              {COPY.common.shipsFrom} {seller.shipsFrom}
            </p>
          </header>

          <section className="flex flex-col gap-3 border-y border-rule py-5">
            {sold ? (
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <StatusPill status="sold" />
                {COPY.sold.listing}
              </p>
            ) : isOwn ? (
              <p className="font-semibold">
                {T.own}{' '}
                <Link to="/sell" className="font-medium text-accent hover:underline">
                  {T.ownLink}
                </Link>
              </p>
            ) : isAdmin ? (
              <p className="text-sm text-ink-muted">{T.adminCantBuy}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={buyNow} className="min-w-40">
                  {T.buyNow}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (inCart ? navigate('/cart') : addToCart(listing.id))}
                >
                  {inCart ? T.inCart : T.addToCart}
                </Button>
              </div>
            )}
            <p className="max-w-[60ch] text-sm">{COPY.hold}</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-base font-bold">{T.details}</h2>
            <dl className="money grid grid-cols-[auto_1fr] gap-x-6 text-sm">
              {specs
                .filter(([, v]) => v !== undefined && v !== '')
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="col-span-2 grid grid-cols-subgrid border-b border-rule py-2"
                  >
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-4 max-w-[65ch] leading-relaxed">{listing.description}</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-base font-bold">{T.seller}</h2>
            <div className="flex flex-col gap-1 rounded-slab border border-rule bg-paper p-4 text-sm">
              <p className="font-semibold">{seller.handle}</p>
              <p className="money text-ink-muted">
                {seller.rating.toFixed(1)} {T.rating} ·{' '}
                {seller.sales.toLocaleString('en-US')} {plural(seller.sales, T.sale)} ·{' '}
                {T.joined} {seller.joinedYear}
              </p>
              <p className="text-ink-muted">
                {COPY.common.shipsFrom} {seller.shipsFrom}
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  )
}

import { addToCart, useCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { Link, navigate, type Params } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS, SELLERS } from '../shared/seed.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { gradeLabel, PageLayout } from './Layout.tsx'

export default function Listing({ params }: { params: Params }) {
  const listing = useListings().find((l) => l.id === params.id)
  const seller = SELLERS.find((s) => s.id === listing?.sellerId)
  const persona = usePersona()
  const inCart = useCart().some((l) => l.listingId === params.id)

  if (!listing || !seller)
    return (
      <PageLayout title="Listing not found">
        <EmptyState
          title="This listing isn't here"
          fact="The link may be wrong, or the listing was created in another browser."
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
    ['Grading service', listing.service],
    ['Grade', listing.graded ? listing.grade : 'Raw (ungraded)'],
    ['Cert number', listing.certNumber],
    ['Year', listing.year],
    ['Mint mark', listing.mintMark],
    ['Category', listing.category === 'coin' ? 'Coin' : 'Card'],
  ]

  return (
    <PageLayout>
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        Back to listings
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
                  · Cert #{listing.certNumber}
                </span>
              )}
            </p>
            <Money cents={listing.priceCents} className="mt-1 text-3xl font-bold" />
            <p className="text-sm text-ink-muted">
              {listing.shippingCents === 0 ? (
                <span className="font-semibold text-ink">Free shipping</span>
              ) : (
                <>
                  + <Money cents={listing.shippingCents} /> shipping
                </>
              )}
              {' · '}Ships from {seller.shipsFrom}
            </p>
          </header>

          <section className="flex flex-col gap-3 border-y border-rule py-5">
            {isOwn ? (
              <p className="font-semibold">
                This is your listing.{' '}
                <Link to="/sell" className="font-medium text-accent hover:underline">
                  See it on your seller page
                </Link>
              </p>
            ) : isAdmin ? (
              <p className="text-sm text-ink-muted">
                Admins can't buy. Switch to a collector to buy this.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={buyNow} className="min-w-40">
                  Buy now
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (inCart ? navigate('/cart') : addToCart(listing.id))}
                >
                  {inCart ? 'In cart — view cart' : 'Add to cart'}
                </Button>
              </div>
            )}
            <p className="max-w-[60ch] text-sm">{COPY.hold}</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-base font-bold">Details</h2>
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
            <h2 className="mb-2 font-display text-base font-bold">Seller</h2>
            <div className="flex flex-col gap-1 rounded-slab border border-rule bg-paper p-4 text-sm">
              <p className="font-semibold">{seller.handle}</p>
              <p className="money text-ink-muted">
                {seller.rating.toFixed(1)} rating · {seller.sales.toLocaleString('en-US')}{' '}
                {seller.sales === 1 ? 'sale' : 'sales'} · Joined {seller.joinedYear}
              </p>
              <p className="text-ink-muted">Ships from {seller.shipsFrom}</p>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  )
}

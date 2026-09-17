import { addToCart, useCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import {
  navigate,
  openCheckout,
  useSearchParams,
  type Params,
} from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { useSession } from '../lib/session.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS, SELLERS } from '../shared/seed.ts'
import { Button } from '../ui/Button.tsx'
import { Card, SectionHeading } from '../ui/Card.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Money } from '../ui/Money.tsx'
import { Slab } from '../ui/Slab.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { plural } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.listing

export default function Listing({ params }: { params: Params }) {
  const listing = useListings().find((l) => l.id === params.id)
  const seller = SELLERS.find((s) => s.id === listing?.sellerId)
  // Public page: signed out, nobody is the seller and Buy now goes through sign-in.
  const persona = useSession()?.persona
  const sold = useSoldIds().has(params.id)
  const inCart = useCart().some((l) => l.listingId === params.id)
  // Opened from an order, the back link returns there. Same-site paths only, never '//host'.
  const from = useSearchParams().get('from') ?? ''
  const back = /^\/(?!\/)/.test(from) ? from : '/'

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
    openCheckout()
  }

  const specs: [string, string | number | undefined][] = [
    [T.specs.service, listing.service],
    [T.specs.grade, listing.graded ? listing.grade : T.rawLong],
    [T.specs.cert, listing.certNumber],
    [T.specs.year, listing.year],
    [T.specs.mintMark, listing.mintMark],
    [T.specs.category, listing.category === 'coin' ? T.coin : T.card],
    [T.specs.returns, listing.noReturns ? COPY.common.noReturns : COPY.common.returns],
  ]

  return (
    <PageLayout
      back={
        <div className="mx-auto max-w-2xl">
          <Link
            to={back}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <Icon name="arrowLeft" className="size-4" />
            {back.startsWith('/order/') ? T.backToOrder : T.back}
          </Link>
        </div>
      }
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Card as="section" aria-labelledby="listing-title">
          <header>
            <h1
              id="listing-title"
              className="text-xl leading-tight font-bold tracking-tight text-balance sm:text-2xl"
            >
              {listing.title}
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              {listing.shippingCents === 0 ? (
                <span className="font-semibold text-ink">{COPY.common.freeShipping}</span>
              ) : (
                <>
                  + <Money cents={listing.shippingCents} /> {COPY.common.plusShipping}
                </>
              )}
              {' · '}
              {COPY.common.shipsFrom} {seller.shipsFrom}
              {' · '}
              {listing.noReturns ? COPY.common.noReturns : COPY.common.returns}
            </p>
          </header>

          <div className="mx-auto mt-5 aspect-square w-full max-w-md rounded-card bg-well p-4 sm:p-5">
            <Slab listing={listing} />
          </div>

          <Money
            cents={listing.priceCents}
            className="mt-5 block text-[1.75rem] leading-none font-bold tracking-tight"
          />

          <p className="mt-4 text-sm leading-relaxed text-pretty">
            {listing.description}
          </p>

          <div className="mt-5">
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={buyNow} className="h-11">
                  {T.buyNow}
                </Button>
                {/* One-of-ones: once added, the button becomes the way to the cart, never a second copy. */}
                <Button
                  variant="secondary"
                  className="h-11"
                  onClick={() => (inCart ? navigate('/cart') : addToCart(listing.id))}
                >
                  <Icon name="cart" className="size-4" />
                  {inCart ? T.viewInCart : T.addToCart}
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card as="section" aria-labelledby="listing-details">
          <SectionHeading id="listing-details">{T.details}</SectionHeading>
          <dl className="money divide-y divide-rule text-sm">
            {specs
              .filter(([, v]) => v !== undefined && v !== '')
              .map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0"
                >
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </Card>

        <Card as="section" aria-labelledby="listing-seller">
          <SectionHeading id="listing-seller">{T.seller}</SectionHeading>
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">{seller.handle}</p>
            <p className="money text-ink-muted">
              <Icon
                name="star"
                className="mr-1 inline size-3 -translate-y-px fill-current text-ink"
              />
              <span className="font-semibold text-ink">{seller.rating.toFixed(1)}</span>{' '}
              {T.rating} · {seller.sales.toLocaleString('en-US')}{' '}
              {plural(seller.sales, T.sale)} · {T.joined} {seller.joinedYear}
            </p>
            <p className="text-ink-muted">
              {COPY.common.shipsFrom} {seller.shipsFrom}
            </p>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}

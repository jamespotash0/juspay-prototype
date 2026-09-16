import { useState, type FormEvent } from 'react'
import HyperCheckout from '../checkout/HyperCheckout.tsx'
import { attemptFor, clearAttempt } from '../checkout/attempt.ts'
import { ApiRequestError, api } from '../lib/api.ts'
import { groupBySeller, useCart } from '../lib/cart.ts'
import { useListings, userListings } from '../lib/listings.ts'
import { navigate, type Params } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { breakdown } from '../shared/money.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { Breakdown, CheckoutResponse, ShipTo } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { gradeLabel } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const TEXT = COPY.checkoutPage

const input =
  'h-10 w-full rounded-slab border border-rule bg-paper px-3 text-sm focus-visible:border-accent disabled:bg-bone disabled:text-ink-muted'

export default function Checkout({ params }: { params: Params }) {
  const sellerId = params.sellerId
  const persona = usePersona()
  const listings = useListings()
  const sold = useSoldIds()
  // A sold one-of-one can't be bought again, even if it's still sitting in the cart.
  const lines = (groupBySeller(useCart(), listings).get(sellerId) ?? []).filter(
    (l) => !sold.has(l.listingId),
  )
  const [shipTo, setShipTo] = useState<ShipTo>({
    name: PERSONAS.find((p) => p.id === persona)?.name ?? '',
    line1: '1 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
  })
  const [session, setSession] = useState<CheckoutResponse | null>(null)
  const [busy, setBusy] = useState(false)
  // True while the SDK is confirming: the address can't change under a live payment.
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState('')

  if (lines.length === 0)
    return (
      <PageLayout title={TEXT.title}>
        <EmptyState
          title={TEXT.emptyGroup}
          fact={COPY.empty.cart.fact}
          action={{ label: TEXT.backToCart, onClick: () => navigate('/cart') }}
        />
      </PageLayout>
    )

  if (persona === 'admin' || persona === sellerId)
    return (
      <PageLayout title={TEXT.title}>
        <div className="mx-auto max-w-xl">
          <Notice
            tone="info"
            title={persona === 'admin' ? TEXT.admin : TEXT.ownListing}
            body={persona === 'admin' ? TEXT.adminBody : TEXT.ownListingBody}
          />
          <Link
            to="/cart"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            {TEXT.backToCart}
          </Link>
        </div>
      </PageLayout>
    )

  async function start(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    // Stored before the fetch: a timeout, refresh or double-submit resumes this same payment.
    const attemptId = attemptFor(sellerId, lines)
    try {
      setSession(
        await api.checkout({
          attemptId,
          buyerId: persona,
          items: lines,
          userListings: userListings(),
          shipTo,
        }),
      )
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : ''
      if (code === 'CONFLICT_SPENT') {
        // That attempt already finished; its order page says how.
        clearAttempt(sellerId, attemptId)
        return navigate(`/order/${attemptId}`)
      }
      // Still in flight at Hyperswitch: never start a second one, go watch this one.
      if (code === 'IN_PROGRESS') return navigate(`/order/${attemptId}`)
      if (code === 'AMOUNT_MISMATCH') clearAttempt(sellerId, attemptId)
      setMessage(err instanceof Error && err.message ? err.message : TEXT.startFailed)
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof ShipTo, label: string, className = '') => (
    <label className={`flex flex-col gap-1 text-sm font-medium ${className}`}>
      {label}
      <input
        required
        className={input}
        value={shipTo[k]}
        disabled={!!session || busy || paying}
        onChange={(e) => setShipTo({ ...shipTo, [k]: e.target.value })}
      />
    </label>
  )

  // Before the intent exists this is the same calculation the server runs; once it exists, the server's.
  const shown: Breakdown = session?.breakdown ?? breakdown(lines, listings)

  return (
    <PageLayout title={TEXT.title}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <form onSubmit={start} className="flex flex-col gap-4">
            <fieldset className="grid grid-cols-6 gap-3" disabled={paying}>
              <legend className="mb-3 font-display text-lg font-bold">
                {TEXT.shipTo}
              </legend>
              {field('name', TEXT.fields.name, 'col-span-6')}
              {field('line1', TEXT.fields.line1, 'col-span-6')}
              {field('city', TEXT.fields.city, 'col-span-6 sm:col-span-3')}
              {field('state', TEXT.fields.state, 'col-span-2 sm:col-span-1')}
              {field('zip', TEXT.fields.zip, 'col-span-4 sm:col-span-2')}
            </fieldset>
            {!session && (
              <Button type="submit" disabled={busy} className="self-start">
                {busy ? TEXT.starting : TEXT.continue}
              </Button>
            )}
          </form>

          {message && <Notice tone="danger" title={message} body={null} />}

          {session && (
            <section
              aria-labelledby="pay"
              className="flex flex-col gap-3 border-t border-rule pt-5"
            >
              <h2 id="pay" className="font-display text-lg font-bold">
                {TEXT.payment}
              </h2>
              <HyperCheckout
                clientSecret={session.clientSecret}
                publishableKey={session.publishableKey}
                paymentId={session.paymentId}
                totalCents={session.breakdown.totalCents}
                onSubmitted={() => navigate(`/order/${session.paymentId}`)}
                onError={setMessage}
                onSubmittingChange={setPaying}
              />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 self-start rounded-slab border border-rule bg-paper p-5 lg:sticky lg:top-20">
          <h2 className="font-display text-lg font-bold">{TEXT.summary}</h2>
          <ul className="flex flex-col gap-3 border-t border-rule pt-3">
            {lines.map((l) => {
              const listing = listings.find((x) => x.id === l.listingId)
              if (!listing) return null
              return (
                <li key={l.listingId} className="flex gap-3">
                  <img
                    src={listing.imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-slab border border-rule bg-bone object-contain p-1"
                  />
                  <div className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="line-clamp-2 leading-snug">{listing.title}</span>
                    <span className="text-xs text-ink-muted">
                      {gradeLabel(listing)}
                      {l.qty > 1 && <span className="money"> × {l.qty}</span>}
                    </span>
                  </div>
                  <Money
                    cents={listing.priceCents * l.qty}
                    className="text-sm font-semibold"
                  />
                </li>
              )
            })}
          </ul>
          <BreakdownList b={shown} />
          <p className="border-t border-rule pt-3 text-sm text-ink-muted">{COPY.hold}</p>
        </aside>
      </div>
    </PageLayout>
  )
}

export function BreakdownList({ b }: { b: Breakdown }) {
  const row = 'flex justify-between gap-4'
  return (
    <dl className="flex flex-col gap-1.5 border-t border-rule pt-3 text-sm">
      <div className={row}>
        <dt>{TEXT.items}</dt>
        <dd>
          <Money cents={b.itemsCents} />
        </dd>
      </div>
      <div className={row}>
        <dt>{TEXT.shipping}</dt>
        <dd>
          {b.shippingCents === 0 ? (
            COPY.common.freeShipping
          ) : (
            <Money cents={b.shippingCents} />
          )}
        </dd>
      </div>
      <div className={row}>
        <dt>{TEXT.tax}</dt>
        <dd>
          <Money cents={b.taxCents} />
        </dd>
      </div>
      <div className={`${row} mt-1 border-t border-rule pt-2 text-base font-bold`}>
        <dt>{TEXT.total}</dt>
        <dd>
          <Money cents={b.totalCents} />
        </dd>
      </div>
    </dl>
  )
}

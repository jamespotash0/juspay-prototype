import { useEffect, useState, type FormEvent } from 'react'
import HyperCheckout from '../checkout/HyperCheckout.tsx'
import { attemptFor, clearAttempt } from '../checkout/attempt.ts'
import { ApiRequestError, api } from '../lib/api.ts'
import { checkoutLines, useCart } from '../lib/cart.ts'
import { useListings, userListings } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { saveAddresses, useDisplayName, useSavedAddresses } from '../lib/profile.ts'
import { usePersona } from '../lib/session.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { breakdown } from '../shared/money.ts'
import type { Breakdown, CheckoutResponse, SavedCard, ShipTo } from '../shared/types.ts'
import { AddressFields } from '../ui/AddressFields.tsx'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { Sheet } from '../ui/Sheet.tsx'
import { gradeLabel, oneLineAddress, plural } from '../ui/format.ts'

const TEXT = COPY.checkoutPage

export default function Checkout() {
  const persona = usePersona()
  const displayName = useDisplayName(persona)
  const listings = useListings()
  const sold = useSoldIds()
  // The whole cart in one payment. A sold one-of-one can't be bought again, and your own listings
  // stay in the cart but out of the charge.
  const lines = checkoutLines(useCart(), listings, sold, persona)
  // Pre-filled from the account's saved addresses; what's used here is saved back for next time.
  const profile = useSavedAddresses(persona)
  const [shipTo, setShipTo] = useState<ShipTo>(profile.shipTo)
  const [billingSame, setBillingSame] = useState(profile.billTo === null)
  const [billTo, setBillTo] = useState<ShipTo>(
    profile.billTo ?? { name: displayName, line1: '', city: '', state: '', zip: '' },
  )
  const [saved, setSaved] = useState<SavedCard[]>([])
  const [session, setSession] = useState<CheckoutResponse | null>(null)
  const [busy, setBusy] = useState(false)
  // True while the SDK is confirming: the address can't change under a live payment.
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState('')

  const close = () => navigate(location.pathname, { replace: true, scroll: false })

  // Only to say, in plain words, which saved card the payment form has pre-selected.
  useEffect(() => {
    let live = true
    api
      .paymentMethods(persona)
      .then((m) => live && setSaved(m))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [persona])
  const defaultCard = saved.find((c) => c.isDefault) ?? saved[0]

  if (lines.length === 0)
    return (
      <Sheet title={TEXT.title} closeLabel={TEXT.close} onClose={close}>
        <EmptyState
          title={TEXT.emptyGroup}
          fact={COPY.empty.cart.fact}
          action={{ label: TEXT.backToCart, onClick: () => navigate('/cart') }}
        />
      </Sheet>
    )

  if (persona === 'admin')
    return (
      <Sheet title={TEXT.title} closeLabel={TEXT.close} onClose={close}>
        <Notice tone="info" title={TEXT.admin} body={TEXT.adminBody} />
      </Sheet>
    )

  async function start(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    // Stored before the fetch: a timeout, refresh or double-submit resumes this same payment.
    const attemptId = attemptFor(lines)
    saveAddresses(persona, { shipTo, billTo: billingSame ? null : billTo })
    try {
      setSession(
        await api.checkout({
          attemptId,
          buyerId: persona,
          items: lines,
          userListings: userListings(),
          shipTo,
          ...(billingSame ? {} : { billTo }),
        }),
      )
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : ''
      if (code === 'CONFLICT_SPENT') {
        // That attempt already finished; its order page says how.
        clearAttempt(attemptId)
        return navigate(`/order/${attemptId}`)
      }
      // Still in flight at Hyperswitch: never start a second one, go watch this one.
      if (code === 'IN_PROGRESS') return navigate(`/order/${attemptId}`)
      if (code === 'AMOUNT_MISMATCH') clearAttempt(attemptId)
      setMessage(err instanceof Error && err.message ? err.message : TEXT.startFailed)
    } finally {
      setBusy(false)
    }
  }

  // Before the intent exists this is the same calculation the server runs; once it exists, the server's.
  const shown: Breakdown = session?.breakdown ?? breakdown(lines, listings)

  const count = lines.reduce((n, l) => n + l.qty, 0)
  const step = 'flex flex-col gap-3 border-t border-rule px-5 py-5 sm:px-6'
  const stepTitle = (n: number, label: string, done = false) => (
    <h3 className="flex items-center gap-2.5 text-base font-bold tracking-tight">
      <span
        className={`money grid size-6 place-items-center rounded-full text-xs ${done ? 'bg-ink text-paper' : 'border border-rule-strong'}`}
      >
        {done ? <Icon name="check" className="size-3.5" /> : n}
      </span>
      {label}
    </h3>
  )

  return (
    // Locked while the payment is starting or confirming: closing mustn't strand a live payment.
    <Sheet
      title={TEXT.title}
      closeLabel={TEXT.close}
      onClose={close}
      locked={busy || paying}
    >
      <details className="group px-5 pb-4 sm:px-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-ink-muted">
            {TEXT.summary} · {count} {plural(count, 'item')}
            <Icon
              name="chevronDown"
              className="size-4 transition group-open:rotate-180"
            />
          </span>
          <Money cents={shown.totalCents} className="text-lg font-bold" />
        </summary>
        <ul className="mt-4 flex flex-col gap-3">
          {lines.map((l) => {
            const listing = listings.find((x) => x.id === l.listingId)
            if (!listing) return null
            return (
              <li key={l.listingId} className="flex gap-3">
                <img
                  src={listing.imageUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
                />
                <div className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="line-clamp-2 leading-snug font-medium">
                    {listing.title}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {gradeLabel(listing)}
                    {listing.noReturns && ` · ${COPY.common.noReturns}`}
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
        <div className="mt-4">
          <BreakdownList b={shown} />
        </div>
      </details>

      <section className={step}>
        {stepTitle(1, TEXT.shipTo, !!session)}
        {session ? (
          // The addresses are on the payment. Editing reopens the form; continuing again updates the
          // same payment (the amount doesn't depend on the address), so nothing is charged twice.
          <div className="flex items-start justify-between gap-4 pl-8.5 text-sm">
            <dl className="flex min-w-0 flex-col gap-1.5 text-ink-muted">
              <div>
                <dt className="sr-only">{TEXT.shipTo}</dt>
                <dd>{oneLineAddress(shipTo)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-ink">{TEXT.billing}: </dt>
                <dd className="inline">
                  {billingSame ? TEXT.sameAsShipping : oneLineAddress(billTo)}
                </dd>
              </div>
            </dl>
            <Button
              variant="quiet"
              size="sm"
              disabled={paying}
              onClick={() => setSession(null)}
            >
              {TEXT.edit}
            </Button>
          </div>
        ) : (
          <form onSubmit={start} className="flex flex-col gap-4">
            <AddressFields
              value={shipTo}
              onChange={setShipTo}
              legend={TEXT.shipTo}
              disabled={busy}
            />
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold">{TEXT.billing}</h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={billingSame}
                  disabled={busy}
                  onChange={(e) => setBillingSame(e.target.checked)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                {TEXT.sameAsShipping}
              </label>
              {!billingSame && (
                <AddressFields
                  value={billTo}
                  onChange={setBillTo}
                  legend={TEXT.billing}
                  disabled={busy}
                />
              )}
            </div>
            <Button type="submit" disabled={busy} className="h-11">
              {busy ? TEXT.starting : TEXT.continue}
            </Button>
          </form>
        )}
      </section>

      <section className={step} aria-labelledby="pay">
        <div id="pay">{stepTitle(2, TEXT.payment)}</div>
        {message && <Notice tone="danger" title={message} body={null} />}
        {session && defaultCard && (
          <p className="text-sm text-ink-muted">
            {TEXT.savedHint(
              COPY.account.card(
                defaultCard.network,
                defaultCard.last4,
                defaultCard.funding,
              ),
            )}
          </p>
        )}
        {session && (
          <HyperCheckout
            clientSecret={session.clientSecret}
            publishableKey={session.publishableKey}
            paymentId={session.paymentId}
            totalCents={session.breakdown.totalCents}
            onSubmitted={() => navigate(`/order/${session.paymentId}`)}
            onError={setMessage}
            onSubmittingChange={setPaying}
          />
        )}
      </section>
    </Sheet>
  )
}

export function BreakdownList({ b }: { b: Breakdown }) {
  const row = 'flex items-baseline justify-between gap-4'
  return (
    <dl className="money flex flex-col gap-2 border-t border-rule pt-3 text-sm [&>div:not(:last-child)>dt]:text-ink-muted">
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
      <div className={`${row} mt-1 border-t border-rule pt-3 text-base font-bold`}>
        <dt>{TEXT.total}</dt>
        <dd>
          <Money cents={b.totalCents} />
        </dd>
      </div>
    </dl>
  )
}

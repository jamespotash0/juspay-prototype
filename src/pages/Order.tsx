import { useCallback, useEffect, useState } from 'react'
import { clearAttempt } from '../checkout/attempt.ts'
import { api, cachedOrder } from '../lib/api.ts'
import { clearCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { navigate, type Params } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { markSold } from '../lib/sold.ts'
import type { DeclineReason } from '../shared/copy.ts'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { latestStatus } from '../shared/orderState.ts'
import { SELLERS } from '../shared/seed.ts'
import type { OrderAction, OrderView, PaymentState, PersonaId } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Card, SectionHeading } from '../ui/Card.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { refundLabel } from '../ui/format.ts'
import { BreakdownList } from './Checkout.tsx'
import { PageLayout } from './Layout.tsx'
import { RefundAction } from './RefundAction.tsx'

const IN_FLIGHT: PaymentState[] = ['awaiting_payment', 'action_required', 'pending']
const POLL_MS = 2000
const POLL_FOR_MS = 30000

const TEXT = COPY.order
const A = COPY.orderActions
type IssueKind = keyof typeof COPY.orderActions.issues

export default function Order({ params }: { params: Params }) {
  // A bare payment id (the return from checkout) shows every seller's order in that purchase;
  // `<paymentId>.<sellerId>` (from an order list) shows just that seller's order.
  const id = params.paymentId
  const [paymentId, onlySeller] = id.split('.')
  const persona = usePersona()
  const listings = useListings()
  // Render at once from a list the viewer just saw; the read below refreshes it straight away.
  const [orders, setOrders] = useState<OrderView[] | null>(() => {
    const cached = cachedOrder(id)
    return cached ? [cached] : null
  })
  const [ambiguous, setAmbiguous] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [round, setRound] = useState(0)

  const read = useCallback(async () => {
    try {
      const all = await api.purchase(paymentId)
      const views = onlySeller ? all.filter((v) => v.sellerId === onlySeller) : all
      if (views.length === 0) {
        setNotFound(true)
        return null
      }
      setOrders(views)
      // Payment state is shared by every order in the purchase.
      const { state } = views[0]
      if (state === 'paid') {
        const bought = all.flatMap((v) => v.listingIds)
        clearCart(bought)
        markSold(bought)
      }
      if (['paid', 'failed', 'cancelled', 'refunded'].includes(state))
        clearAttempt(paymentId)
      return state
    } catch (err) {
      if ((err as { status?: number }).status === 404) setNotFound(true)
      return null
    }
  }, [paymentId, onlySeller])

  // Poll while in flight, for up to ~30s; after that, say we don't know. "Check again" restarts a round.
  useEffect(() => {
    let stopped = false
    const until = Date.now() + POLL_FOR_MS
    ;(async function loop() {
      while (!stopped) {
        const state = await read()
        if (stopped) return
        if (state && !IN_FLIGHT.includes(state) && state !== 'unknown') return
        if (Date.now() >= until) return setAmbiguous(true)
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
    })()
    return () => {
      stopped = true
    }
  }, [read, round])

  if (notFound)
    return (
      <PageLayout title={TEXT.title} width="narrow">
        <EmptyState
          title={TEXT.notFound}
          fact={TEXT.notFoundFact}
          action={{ label: TEXT.toOrders, onClick: () => navigate('/orders') }}
        />
      </PageLayout>
    )

  const first = orders?.[0]
  const isBuyer = !!first && persona === first.buyerId
  // A seller opening the whole purchase sees only their own order, never another seller's.
  const shown = orders?.filter(
    (o) => isBuyer || persona === 'admin' || o.sellerId === persona,
  )
  const isSeller = !!first && !isBuyer && persona !== 'admin'
  // The notice speaks for the purchase: refunded only once every order is, shipped once every order is.
  const summary: OrderView | null =
    first && shown?.length
      ? {
          ...first,
          fulfilment: shown.every((o) => o.fulfilment !== 'unshipped')
            ? first.fulfilment
            : 'unshipped',
          refund: shown.every((o) => o.refund.state === 'succeeded')
            ? first.refund
            : { state: 'none', refundedCents: 0 },
        }
      : null
  const total = shown?.reduce(
    (sum, o) => ({
      itemsCents: sum.itemsCents + o.breakdown.itemsCents,
      shippingCents: sum.shippingCents + o.breakdown.shippingCents,
      taxCents: sum.taxCents + o.breakdown.taxCents,
      totalCents: sum.totalCents + o.breakdown.totalCents,
    }),
    { itemsCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0 },
  )
  // Back to the list this viewer reaches orders from — not browser history, which after a
  // checkout would land on a checkout page for a payment that's already done.
  const back =
    persona === 'admin'
      ? { to: '/admin', label: TEXT.backToAdmin }
      : isSeller
        ? { to: '/sell', label: TEXT.backToSales }
        : { to: '/orders', label: TEXT.backToOrders }

  return (
    <PageLayout
      title={TEXT.title}
      width="narrow"
      back={
        <Link
          to={back.to}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" />
          {back.label}
        </Link>
      }
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* The order number and date: what the buyer and support quote, so it leads the page. */}
        <dl className="-mt-2 flex flex-wrap gap-x-8 gap-y-2 sm:-mt-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              {TEXT.number}
            </dt>
            <dd className="money text-base font-semibold select-all">{paymentId}</dd>
          </div>
          {first && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                {TEXT.placed}
              </dt>
              <dd className="text-base font-semibold">
                {placed.format(new Date(first.createdAt))}
              </dd>
            </div>
          )}
        </dl>

        {ambiguous ? (
          <Notice
            tone="ambiguous"
            title={COPY.checkout.ambiguous.title}
            body={null}
            supportRef={paymentId}
            action={{
              label: COPY.checkout.ambiguous.action,
              // Only re-reads the payment. There is no path from here that can create a charge.
              onClick: () => {
                setAmbiguous(false)
                setRound((n) => n + 1)
              },
            }}
          />
        ) : (
          <StateNotice order={summary} />
        )}

        {shown?.map((order) => {
          const seller = SELLERS.find((x) => x.id === order.sellerId)
          return (
            <section
              key={order.orderId}
              aria-label={seller?.handle ?? order.sellerId}
              className="flex flex-col gap-3"
            >
              {/* With several sellers, each order is headed by who ships it. */}
              {shown.length > 1 && (
                <h2 className="px-1 text-sm font-semibold text-ink-muted">
                  {TEXT.fromSeller(seller?.handle ?? order.sellerId)}
                </h2>
              )}
              {(order.state === 'paid' || order.state === 'refunded') && (
                <Fulfilment
                  order={order}
                  persona={persona}
                  onChange={(next) =>
                    setOrders((all) =>
                      all ? all.map((o) => (o.orderId === next.orderId ? next : o)) : all,
                    )
                  }
                />
              )}
              <Card as="section" aria-labelledby={`items-${order.orderId}`}>
                <SectionHeading id={`items-${order.orderId}`}>
                  {TEXT.items}
                </SectionHeading>
                <ul className="flex flex-col divide-y divide-rule">
                  {order.listingIds.map((listingId) => {
                    const l = listings.find((x) => x.id === listingId)
                    return (
                      <li
                        key={listingId}
                        className="flex items-center gap-3 py-3 text-sm first:pt-0 last:pb-0 sm:gap-4"
                      >
                        {l && (
                          <img
                            src={l.imageUrl}
                            alt=""
                            className="size-14 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
                          />
                        )}
                        <span className="min-w-0 flex-1 font-medium">
                          {l?.title ?? listingId}
                        </span>
                        {l && <Money cents={l.priceCents} className="font-semibold" />}
                      </li>
                    )
                  })}
                </ul>
              </Card>
              {isSeller && (
                <Card as="section" aria-labelledby={`sale-${order.orderId}`}>
                  <SectionHeading id={`sale-${order.orderId}`}>
                    {TEXT.yourSale}
                  </SectionHeading>
                  {/* The seller never sees tax or the buyer's total. */}
                  <dl className="money flex flex-col divide-y divide-rule text-sm">
                    <Row label={TEXT.gross} cents={order.ledger.grossCents} />
                    <Row label={TEXT.commission} cents={-order.ledger.commissionCents} />
                    <Row label={TEXT.net} cents={order.ledger.netCents} bold />
                  </dl>
                </Card>
              )}
            </section>
          )
        })}

        {!isSeller && total && (
          <Card as="section" aria-labelledby="amounts">
            <SectionHeading id="amounts">{TEXT.amounts}</SectionHeading>
            {/* BreakdownList is shared with checkout; drop its own top rule inside the card. */}
            <div className="[&>dl]:border-t-0 [&>dl]:pt-0">
              <BreakdownList b={total} />
            </div>
            {first && <PaidWith order={first} />}
          </Card>
        )}
      </div>
    </PageLayout>
  )
}

const placed = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function Row({ label, cents, bold }: { label: string; cents: number; bold?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0 ${bold ? 'pt-3 text-base font-bold' : ''}`}
    >
      <dt className={bold ? 'text-ink' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-right font-medium">
        <Money cents={cents} />
      </dd>
    </div>
  )
}

function StateNotice({ order }: { order: OrderView | null }) {
  // Nothing read yet: that's loading, not "confirming" — an order paid weeks ago isn't in flight.
  if (!order)
    return (
      <p role="status" className="text-sm text-ink-muted">
        {TEXT.loading}
      </p>
    )
  if (order.state === 'awaiting_payment' || order.state === 'unknown')
    return <Notice tone="warning" title={COPY.checkout.confirming} body={null} />
  switch (order.state) {
    case 'action_required':
      // PayPal and 3DS both wait on the buyer; only the copy differs.
      return (
        <Notice
          tone="warning"
          title={
            order.paymentMethodType === 'paypal'
              ? COPY.checkout.paypalUnfinished
              : COPY.checkout.threeDs
          }
          body={null}
        />
      )
    case 'pending':
      return <Notice tone="warning" title={COPY.checkout.processing} body={null} />
    case 'paid':
    case 'refunded':
      if (order.refund.state === 'succeeded' || order.state === 'refunded')
        return (
          <Notice tone="info" title={COPY.postPayment.refundSucceededBuyer} body={null} />
        )
      // Once shipped, the timeline below carries the story.
      return order.fulfilment === 'unshipped' ? (
        <Notice tone="info" title={COPY.checkout.succeeded} body={COPY.hold} />
      ) : null
    case 'failed':
      return <Declined order={order} />
    case 'cancelled':
      return <Notice tone="info" title={TEXT.cancelled} body={null} />
    case 'review':
      return <Notice tone="warning" title={TEXT.review} body={TEXT.reviewBody} />
    default:
      return <Notice tone="warning" title={TEXT.other} body={null} />
  }
}

// Our own failures already say "nothing has been charged. We…"; bank declines get soft/hard guidance.
const OURS: DeclineReason[] = ['processing_error', 'network_unreachable']

function Declined({ order }: { order: OrderView }) {
  const d = order.decline
  const guidance = !d
    ? null
    : OURS.includes(d.reason)
      ? null
      : d.retriable
        ? COPY.checkout.softDecline
        : COPY.checkout.hardDecline
  return (
    <Notice
      tone="danger"
      title={d?.message ?? TEXT.paymentFailed}
      body={
        <>
          {guidance && <p>{guidance}</p>}
          {d && (
            <p className="money mt-1 text-xs text-ink-muted">
              {TEXT.supportRef} {d.code}
            </p>
          )}
        </>
      }
      action={{
        // The cart kept its items; checkout starts a fresh attempt because this one is terminal.
        label: COPY.decline[d?.reason ?? 'generic'].action,
        onClick: () => navigate('/checkout'),
      }}
    />
  )
}

function Fulfilment({
  order,
  persona,
  onChange,
}: {
  order: OrderView
  persona: PersonaId
  onChange: (o: OrderView) => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // closed → menu of issues → the chosen issue's refund request form
  const [issue, setIssue] = useState<'closed' | 'menu' | IssueKind>('closed')
  const [details, setDetails] = useState('')

  const f = order.fulfilment
  const refunded = order.refund.state === 'succeeded' || order.state === 'refunded'
  const isBuyer = persona === order.buyerId
  const canReceive = isBuyer && order.state === 'paid' && f === 'shipped'
  const canDispute =
    isBuyer && order.state === 'paid' && f !== 'disputed' && order.refund.state === 'none'

  // Offer only the issues that fit where the parcel is.
  const issueOptions: IssueKind[] =
    f === 'unshipped'
      ? ['notShipped']
      : f === 'shipped'
        ? ['notArrived', 'wrongItem']
        : ['wrongItem']

  async function act(action: OrderAction) {
    setBusy(true)
    setFailed(false)
    try {
      onChange(
        await api.orderState({
          paymentId: order.orderId,
          action,
          actorId: persona,
          // Admin sees what kind of issue it is, then the buyer's own words.
          ...(action === 'dispute' && issue !== 'closed' && issue !== 'menu'
            ? { reason: [A.issues[issue], details.trim()].filter(Boolean).join(': ') }
            : {}),
        }),
      )
      setIssue('closed')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  // The latest status only, and when it happened.
  const status = latestStatus(order)
  const when =
    order.fulfilledAt?.disputedAt ??
    order.fulfilledAt?.receivedAt ??
    order.fulfilledAt?.shippedAt

  return (
    <Card
      as="section"
      aria-labelledby={`status-${order.orderId}`}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={`status-${order.orderId}`} className="text-lg font-bold tracking-tight">
          {TEXT.status}
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <StatusPill
            status={status}
            label={status === order.refund.state ? refundLabel(order) : undefined}
          />
          {order.refund.refundedCents > 0 && (
            <Money cents={order.refund.refundedCents} className="font-semibold" />
          )}
          {when && !refunded && (
            <span className="text-ink-muted">
              {TEXT.updated} {placed.format(new Date(when))}
            </span>
          )}
        </div>
      </div>

      {failed && (
        <Notice tone="danger" title={COPY.postPayment.actionDidNotSave} body={null} />
      )}

      {isBuyer && f === 'disputed' && !refunded && (
        <Notice tone="info" title={A.refundRequested} body={null} />
      )}

      {/* The seller answers refund requests, and can refund any paid order of theirs. */}
      {persona === order.sellerId && order.state === 'paid' && !refunded && (
        <div className="flex flex-col gap-3">
          {f === 'disputed' && (
            <Notice
              tone="warning"
              title={A.sellerRequest}
              body={
                <>
                  <p className="font-medium">
                    {order.disputeReason ? `“${order.disputeReason}”` : A.noReason}
                  </p>
                  <p className="mt-1">{A.sellerRequestFact}</p>
                </>
              }
            />
          )}
          {order.refund.state !== 'pending' && (
            <div className="flex flex-wrap items-center gap-2">
              <RefundAction order={order} sellerId={persona} onChange={onChange} />
            </div>
          )}
        </div>
      )}

      {(canReceive || canDispute) && issue === 'closed' && (
        <div className="flex flex-wrap gap-2">
          {canReceive && (
            <Button onClick={() => act('receive')} disabled={busy}>
              {A.receive}
            </Button>
          )}
          {canDispute && (
            <Button variant="secondary" onClick={() => setIssue('menu')} disabled={busy}>
              {A.haveIssue}
            </Button>
          )}
        </div>
      )}

      {issue === 'menu' && (
        <div className="flex flex-col gap-3 rounded-control bg-well p-3 sm:p-4">
          <p id="issue-menu" className="text-sm font-semibold">
            {A.whatsWrong}
          </p>
          <ul aria-labelledby="issue-menu" className="flex flex-col gap-2">
            {issueOptions.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setIssue(k)}
                  className="flex w-full items-center justify-between rounded-control border border-rule-strong bg-paper px-3 py-2.5 text-left text-sm font-medium hover:border-ink focus-visible:border-ink"
                >
                  {A.issues[k]}
                  <Icon name="arrowRight" className="size-4 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="quiet"
            className="h-8 self-start px-0!"
            onClick={() => setIssue('closed')}
          >
            {COPY.common.cancel}
          </Button>
        </div>
      )}

      {issue !== 'closed' && issue !== 'menu' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            act('dispute')
          }}
          className="flex flex-col gap-3 rounded-control bg-well p-3 sm:p-4"
        >
          <p className="text-sm font-semibold">{A.issues[issue]}</p>
          <p className="text-sm text-ink-muted">{A.issueHint}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {A.details}
            <textarea
              value={details}
              maxLength={200}
              rows={3}
              disabled={busy}
              onChange={(e) => setDetails(e.target.value)}
              className="rounded-control border border-rule-strong bg-paper p-3 text-sm hover:border-ink focus-visible:border-ink"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {A.requestRefund}
            </Button>
            <Button variant="quiet" onClick={() => setIssue('menu')} disabled={busy}>
              {COPY.common.back}
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

/** How the buyer paid. Buyer and admin only: a seller never sees the buyer's card. */
function PaidWith({ order }: { order: OrderView }) {
  const m = order.paymentMethod
  const label =
    order.paymentMethodType === 'paypal'
      ? TEXT.paypal
      : m?.last4
        ? TEXT.card(m.network, m.last4)
        : null
  if (!label) return null
  return (
    <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 border-t border-rule pt-3 text-sm">
      <span className="text-ink-muted">{TEXT.paidWith}</span>
      <span className="money font-medium">
        {label}
        {m?.expiry && <span className="text-ink-muted"> · {TEXT.expires(m.expiry)}</span>}
      </span>
    </p>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearAttempt } from '../checkout/attempt.ts'
import { api, cachedOrder } from '../lib/api.ts'
import { clearCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { navigate, openCheckout, type Params } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { markSold } from '../lib/sold.ts'
import type { DeclineReason } from '../shared/copy.ts'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { ISSUES, issueBlock, latestStatus } from '../shared/orderState.ts'
import { SELLERS } from '../shared/seed.ts'
import type {
  IssueKind,
  OrderAction,
  OrderView,
  PaymentState,
  PersonaId,
} from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/Card.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon, type IconName } from '../ui/Icon.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { gradeLabel, orderNumber, plural, refundLabel } from '../ui/format.ts'
import { BreakdownList } from './Checkout.tsx'
import { PageLayout } from './Layout.tsx'
import { RefundAction } from './RefundAction.tsx'

const IN_FLIGHT: PaymentState[] = ['awaiting_payment', 'action_required', 'pending']
const POLL_MS = 2000
const POLL_FOR_MS = 30000

const TEXT = COPY.order
const A = COPY.orderActions

export default function Order({ params }: { params: Params }) {
  // A bare payment id (the return from checkout) shows every seller's order in that purchase;
  // `<paymentId>.<sellerId>` (from an order list) shows just that seller's order.
  const id = params.paymentId
  const [paymentId, onlySeller] = id.split('.')
  const persona = usePersona()
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

  const itemCount = shown?.reduce((n, o) => n + o.listingIds.length, 0) ?? 0

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
        {/* The order number is what the buyer and support quote, so it leads the page. */}
        <div className="-mt-3 flex flex-col gap-0.5 sm:-mt-4">
          <p className="flex flex-wrap gap-x-2 text-sm text-ink-muted">
            <span className="money font-semibold text-ink select-all">
              {orderNumber(paymentId)}
            </span>
            {first && <span>· {placed.format(new Date(first.createdAt))}</span>}
          </p>
          {/* The full payment id, for support to find it in Hyperswitch. */}
          <p className="text-xs text-ink-muted">
            {TEXT.supportRef} <span className="money select-all">{paymentId}</span>
          </p>
        </div>

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

        {!isSeller && total && first && (
          <Card as="section" aria-label={TEXT.summary}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">
                  {TEXT.itemsFrom(itemCount, shown!.length)}
                </span>
                <Money
                  cents={total.totalCents}
                  className="text-2xl leading-none font-bold tracking-tight"
                />
              </div>
              <PaidWith order={first} />
            </div>
            <details className="group mt-4 border-t border-rule pt-3">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
                {TEXT.priceDetails}
                <Icon
                  name="chevronDown"
                  className="size-4 transition group-open:rotate-180"
                />
              </summary>
              <div className="mt-3 [&>dl]:border-t-0 [&>dl]:pt-0">
                <BreakdownList b={total} />
              </div>
            </details>
          </Card>
        )}

        {shown?.map((order, i) => (
          <SellerOrder
            key={order.orderId}
            shipment={shown.length > 1 ? [i + 1, shown.length] : null}
            order={order}
            persona={persona}
            isSeller={isSeller}
            onChange={(next) =>
              setOrders((all) =>
                all ? all.map((o) => (o.orderId === next.orderId ? next : o)) : all,
              )
            }
          />
        ))}
      </div>
    </PageLayout>
  )
}

const placed = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

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
      // Each seller's progress tracker tells this story.
      return null
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
        onClick: () => openCheckout(),
      }}
    />
  )
}

type Step = { label: string; at?: string; done: boolean; dot?: string; icon?: IconName }

/** Paid → Shipped → Received. A refund request or refund replaces the last step; an unshipped one drops Shipped. */
function progress(order: OrderView): Step[] {
  const at = order.fulfilledAt ?? {}
  const f = order.fulfilment
  const shipped = !!at.shippedAt || f === 'shipped' || f === 'received'
  const r = order.refund.state
  const end: Step =
    r === 'succeeded' || order.state === 'refunded'
      ? { label: TEXT.steps.refunded, done: true, dot: 'bg-state-refunded', icon: 'undo' }
      : r === 'pending'
        ? { label: TEXT.steps.refunding, done: false }
        : r === 'failed'
          ? {
              label: TEXT.steps.refundFailed,
              done: true,
              dot: 'bg-state-failed',
              icon: 'cross',
            }
          : f === 'disputed'
            ? {
                label: order.issue
                  ? A.issues[order.issue].step
                  : TEXT.steps.refundRequested,
                at: at.disputedAt,
                done: true,
                dot: 'bg-state-disputed',
                icon: 'flag',
              }
            : { label: TEXT.steps.received, at: at.receivedAt, done: f === 'received' }
  const issue = end.label !== TEXT.steps.received
  return [
    { label: TEXT.steps.paid, at: order.createdAt, done: true },
    ...(shipped || !issue
      ? [{ label: TEXT.steps.shipped, at: at.shippedAt, done: shipped }]
      : []),
    end,
  ]
}

function Progress({ order }: { order: OrderView }) {
  const steps = progress(order)
  // The furthest step reached is where the order is now.
  const current = steps.findLastIndex((s) => s.done)
  return (
    <ol
      className="grid"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((s, i) => (
        <li
          key={s.label}
          aria-current={i === current ? 'step' : undefined}
          className="flex min-w-0 flex-col gap-1.5 text-xs"
        >
          <div className="flex items-center">
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-paper ${
                s.done ? (s.dot ?? 'bg-ink') : 'border-2 border-rule-strong bg-paper'
              }`}
            >
              {s.done && <Icon name={s.icon ?? 'check'} className="size-3" />}
            </span>
            {i < steps.length - 1 && (
              <span
                className={`mx-1.5 h-0.5 flex-1 rounded-full ${steps[i + 1].done ? 'bg-ink' : 'bg-rule'}`}
              />
            )}
          </div>
          <span
            className={`pr-2 leading-tight font-semibold ${s.done ? 'text-ink' : 'text-ink-muted'}`}
          >
            {s.label}
          </span>
          {s.at && s.done && (
            <span className="text-ink-muted">{day.format(new Date(s.at))}</span>
          )}
          <span className="sr-only">{s.done ? TEXT.steps.done : TEXT.steps.notYet}</span>
        </li>
      ))}
    </ol>
  )
}

/** One seller's part of the purchase: who ships it, where it is, what's in it, and what you can do. */
function SellerOrder({
  shipment,
  order,
  persona,
  isSeller,
  onChange,
}: {
  /** [n, N] when the purchase has more than one seller. */
  shipment: [number, number] | null
  order: OrderView
  persona: PersonaId
  isSeller: boolean
  onChange: (o: OrderView) => void
}) {
  const listings = useListings()
  const seller = SELLERS.find((x) => x.id === order.sellerId)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // The option picked from "Have a problem?", whose form is open.
  const [issue, setIssue] = useState<IssueKind | null>(null)
  const [details, setDetails] = useState('')

  const f = order.fulfilment
  const settled = order.state === 'paid' || order.state === 'refunded'
  const refunded = order.refund.state === 'succeeded' || order.state === 'refunded'
  const isBuyer = persona === order.buyerId
  const canReceive = isBuyer && order.state === 'paid' && f === 'shipped'
  const canDispute =
    isBuyer && order.state === 'paid' && f !== 'disputed' && order.refund.state === 'none'
  const sellerActs = persona === order.sellerId && order.state === 'paid' && !refunded

  async function act(action: OrderAction) {
    setBusy(true)
    setFailed(false)
    try {
      onChange(
        await api.orderState({
          paymentId: order.orderId,
          action,
          actorId: persona,
          // The kind goes separately, so the server can check it against the order.
          ...(action === 'dispute' ? { issue: issue!, reason: details } : {}),
          ...(action === 'ask' ? { reason: details } : {}),
        }),
      )
      setIssue(null)
      setDetails('')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const status = latestStatus(order)
  const pad = 'px-5 sm:px-6'

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby={`seller-${order.orderId}`}
      className="flex flex-col"
    >
      <header className={`flex items-start justify-between gap-4 pt-5 ${pad}`}>
        <div className="min-w-0">
          <h2 id={`seller-${order.orderId}`} className="font-bold tracking-tight">
            {shipment
              ? TEXT.shipment(shipment[0], shipment[1], seller?.handle ?? order.sellerId)
              : (seller?.handle ?? order.sellerId)}
          </h2>
          <p className="text-xs text-ink-muted">
            {order.listingIds.length} {plural(order.listingIds.length, 'item')}
            {seller && ` · ${COPY.common.shipsFrom} ${seller.shipsFrom}`}
          </p>
        </div>
        {settled && (
          <StatusPill
            status={status}
            label={status === order.refund.state ? refundLabel(order) : undefined}
          />
        )}
      </header>

      {settled && (
        <div className={`flex flex-col gap-3 pt-5 ${pad}`}>
          <Progress order={order} />
          {isBuyer && refunded && (
            <p className="text-xs text-ink-muted">
              {COPY.postPayment.refundSucceededBuyer}
            </p>
          )}
        </div>
      )}

      {(failed || (sellerActs && f === 'disputed') || (order.question && !refunded)) && (
        <div className={`flex flex-col gap-3 pt-4 ${pad}`}>
          {failed && (
            <Notice tone="danger" title={COPY.postPayment.actionDidNotSave} body={null} />
          )}
          {sellerActs && f === 'disputed' && (
            <Notice
              tone="warning"
              title={order.issue ? A.issues[order.issue].step : A.sellerRequest}
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
          {order.question && !refunded && (
            <p className="rounded-control bg-well px-3 py-2 text-sm">
              <span className="block text-xs text-ink-muted">
                {isBuyer ? A.youAsked : A.buyerAsked}
              </span>
              “{order.question}”
            </p>
          )}
        </div>
      )}

      <ul
        className={`mt-5 flex flex-col divide-y divide-rule border-t border-rule ${pad}`}
      >
        {order.listingIds.map((listingId) => {
          const l = listings.find((x) => x.id === listingId)
          return (
            <li key={listingId} className="flex items-center gap-3 py-3 text-sm">
              {l && (
                <img
                  src={l.imageUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                {l ? (
                  <Link
                    to={`/listing/${l.id}`}
                    className="line-clamp-2 leading-snug font-medium hover:underline"
                  >
                    {l.title}
                  </Link>
                ) : (
                  <span className="font-medium">{listingId}</span>
                )}
                {l && (
                  <span className="text-xs text-ink-muted">
                    {gradeLabel(l)}
                    {l.noReturns && ` · ${COPY.common.noReturns}`}
                  </span>
                )}
              </div>
              {l && <Money cents={l.priceCents} className="font-semibold" />}
            </li>
          )
        })}
      </ul>

      {isSeller && (
        <dl
          className={`money flex flex-col divide-y divide-rule border-t border-rule py-4 text-sm ${pad}`}
        >
          {/* The seller never sees tax or the buyer's total. */}
          <Row label={TEXT.gross} cents={order.ledger.grossCents} />
          <Row label={TEXT.commission} cents={-order.ledger.commissionCents} />
          <Row label={TEXT.net} cents={order.ledger.netCents} bold />
        </dl>
      )}

      {((canReceive || canDispute) && !issue) ||
      (sellerActs && order.refund.state !== 'pending') ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-t border-rule py-3 ${pad}`}
        >
          {canReceive ? (
            <Button onClick={() => act('receive')} disabled={busy}>
              {A.receive}
            </Button>
          ) : (
            <span />
          )}
          {canDispute && (
            <ProblemMenu
              order={order}
              disabled={busy}
              onPick={(k) => {
                setIssue(k)
                setDetails('')
              }}
            />
          )}
          {/* The seller answers refund requests, and can refund any paid order of theirs. */}
          {sellerActs && order.refund.state !== 'pending' && (
            <RefundAction order={order} sellerId={persona} onChange={onChange} />
          )}
        </div>
      ) : null}

      {issue && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            act(issue === 'question' ? 'ask' : 'dispute')
          }}
          className={`flex flex-col gap-3 rounded-b-card border-t border-rule bg-well py-4 ${pad}`}
        >
          <div>
            <p className="text-sm font-semibold">{A.issues[issue].label}</p>
            <p className="text-sm text-ink-muted">
              {A.issues[issue].hint}
              {issue !== 'question' && ` ${A.refundHint}`}
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {issue === 'question' ? A.yourQuestion : A.details}
            <textarea
              value={details}
              required={issue === 'question'}
              maxLength={300}
              rows={3}
              disabled={busy}
              onChange={(e) => setDetails(e.target.value)}
              className="rounded-control border border-rule-strong bg-paper p-3 text-sm font-normal hover:border-ink focus-visible:border-ink"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {A.issues[issue].submit}
            </Button>
            <Button variant="quiet" onClick={() => setIssue(null)} disabled={busy}>
              {COPY.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

/** "Have a problem?": every option, every time. One that can't apply yet is greyed out and says why. */
function ProblemMenu({
  order,
  disabled,
  onPick,
}: {
  order: OrderView
  disabled: boolean
  onPick: (k: IssueKind) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current
      if (!el?.open) return
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)
      )
        el.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  return (
    <details ref={ref} className="group relative">
      <summary
        aria-disabled={disabled || undefined}
        className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-control px-3 text-sm font-medium text-ink-muted hover:bg-well hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-50 [&::-webkit-details-marker]:hidden"
      >
        <Icon name="flag" className="size-4" />
        {A.haveIssue}
        <Icon name="chevronDown" className="size-4 transition group-open:rotate-180" />
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-3rem)] rounded-control border border-rule bg-paper p-1.5 shadow-pop">
        {ISSUES.map((k) => {
          const blocked = issueBlock(order, k)
          return (
            <li key={k}>
              <button
                type="button"
                disabled={!!blocked}
                onClick={() => {
                  ref.current!.open = false
                  onPick(k)
                }}
                className="flex w-full flex-col items-start rounded-control px-2.5 py-2 text-left text-sm hover:bg-well disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <span className={`font-medium ${blocked ? 'text-ink-muted' : ''}`}>
                  {A.issues[k].label}
                </span>
                {blocked && (
                  <span className="text-xs text-ink-muted">{A.blocked[blocked]}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

/** How the buyer paid. Buyer and admin only: a seller never sees the buyer's card. */
function PaidWith({ order }: { order: OrderView }) {
  const m = order.paymentMethod
  const label =
    order.paymentMethodType === 'paypal'
      ? TEXT.paypal
      : m?.last4
        ? TEXT.card(m.network, m.last4, m.funding)
        : null
  if (!label) return null
  return (
    <p className="text-sm">
      <span className="text-ink-muted">{TEXT.paidWith} </span>
      <span className="money font-medium">{label}</span>
    </p>
  )
}

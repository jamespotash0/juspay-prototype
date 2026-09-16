import { useCallback, useEffect, useState } from 'react'
import { clearAttempt } from '../checkout/attempt.ts'
import { api } from '../lib/api.ts'
import { clearCart } from '../lib/cart.ts'
import { useListings } from '../lib/listings.ts'
import { navigate, type Params } from '../lib/navigation.ts'
import type { DeclineReason } from '../shared/copy.ts'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderAction, OrderView, PaymentState, PersonaId } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { BreakdownList } from './Checkout.tsx'
import { PageLayout } from './Layout.tsx'

const IN_FLIGHT: PaymentState[] = ['awaiting_payment', 'action_required', 'pending']
const POLL_MS = 2000
const POLL_FOR_MS = 30000

const TEXT = COPY.order

export default function Order({ params }: { params: Params }) {
  const paymentId = params.paymentId
  const persona = usePersona()
  const listings = useListings()
  const [order, setOrder] = useState<OrderView | null>(null)
  const [ambiguous, setAmbiguous] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [round, setRound] = useState(0)

  const read = useCallback(async () => {
    try {
      const view = await api.payment(paymentId)
      setOrder(view)
      if (view.state === 'paid') clearCart(view.listingIds)
      if (['paid', 'failed', 'cancelled', 'refunded'].includes(view.state))
        clearAttempt(view.sellerId, paymentId)
      return view.state
    } catch (err) {
      if ((err as { status?: number }).status === 404) setNotFound(true)
      return null
    }
  }, [paymentId])

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
      <PageLayout title={TEXT.title}>
        <EmptyState
          title={TEXT.notFound}
          fact={TEXT.notFoundFact}
          action={{ label: TEXT.toOrders, onClick: () => navigate('/orders') }}
        />
      </PageLayout>
    )

  const isSeller = !!order && persona === order.sellerId && persona !== order.buyerId

  return (
    <PageLayout title={TEXT.title}>
      <div className="flex max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {order && !ambiguous && (
            <StatusPill
              status={order.refund.state === 'succeeded' ? 'refunded' : order.state}
            />
          )}
          {order && order.fulfilment !== 'unshipped' && (
            <StatusPill status={order.fulfilment} />
          )}
          <p className="money w-full text-xs text-ink-muted">
            {COPY.checkout.ambiguous.reference}{' '}
            <span className="select-all font-medium text-ink">{paymentId}</span>
            {order && <> · {new Date(order.createdAt).toLocaleString('en-US')}</>}
          </p>
        </header>

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
          <StateNotice order={order} />
        )}

        {order && (
          <>
            <section
              aria-labelledby="items"
              className="flex flex-col gap-3 border-t border-rule pt-5"
            >
              <h2 id="items" className="font-display text-lg font-bold">
                {TEXT.items}
              </h2>
              <ul className="flex flex-col gap-3">
                {order.listingIds.map((id) => {
                  const l = listings.find((x) => x.id === id)
                  return (
                    <li key={id} className="flex items-center gap-3 text-sm">
                      {l && (
                        <img
                          src={l.imageUrl}
                          alt=""
                          className="size-14 shrink-0 rounded-slab border border-rule bg-bone object-contain p-1"
                        />
                      )}
                      <span className="min-w-0 flex-1">{l?.title ?? id}</span>
                      {l && <Money cents={l.priceCents} className="font-semibold" />}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section aria-labelledby="amounts" className="border-t border-rule pt-5">
              <h2 id="amounts" className="font-display text-lg font-bold">
                {isSeller ? TEXT.yourSale : TEXT.amounts}
              </h2>
              {isSeller ? (
                // The seller never sees tax or the buyer's total.
                <dl className="mt-2 flex max-w-sm flex-col gap-1.5 text-sm">
                  <Row label={TEXT.gross} cents={order.ledger.grossCents} />
                  <Row label={TEXT.commission} cents={-order.ledger.commissionCents} />
                  {order.ledger.refundedCents > 0 &&
                    order.ledger.balance !== 'reversed' && (
                      <Row label={TEXT.refunded} cents={-order.ledger.refundedCents} />
                    )}
                  <Row label={TEXT.net} cents={order.ledger.netCents} bold />
                </dl>
              ) : (
                <div className="max-w-sm">
                  <BreakdownList b={order.breakdown} />
                </div>
              )}
            </section>

            {(order.state === 'paid' || order.state === 'refunded') && (
              <Fulfilment order={order} persona={persona} onChange={setOrder} />
            )}
          </>
        )}
      </div>
    </PageLayout>
  )
}

function Row({ label, cents, bold }: { label: string; cents: number; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 ${bold ? 'border-t border-rule pt-2 font-bold' : ''}`}
    >
      <dt>{label}</dt>
      <dd>
        <Money cents={cents} />
      </dd>
    </div>
  )
}

function StateNotice({ order }: { order: OrderView | null }) {
  if (!order || order.state === 'awaiting_payment' || order.state === 'unknown')
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
        return <Notice tone="info" title={COPY.postPayment.refundSucceededBuyer} body={null} />
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
        onClick: () => navigate(`/checkout/${order.sellerId}`),
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
  const [disputing, setDisputing] = useState(false)
  const [reason, setReason] = useState('')

  const f = order.fulfilment
  const refunded = order.refund.state === 'succeeded' || order.state === 'refunded'
  const isBuyer = persona === order.buyerId
  const canReceive = isBuyer && order.state === 'paid' && f === 'shipped'
  const canDispute =
    isBuyer &&
    order.state === 'paid' &&
    (f === 'shipped' || f === 'received') &&
    order.refund.state === 'none'

  async function act(action: OrderAction) {
    setBusy(true)
    setFailed(false)
    try {
      onChange(
        await api.orderState({
          paymentId: order.paymentId,
          action,
          actorId: persona,
          ...(action === 'dispute' && reason.trim() ? { reason: reason.trim() } : {}),
        }),
      )
      setDisputing(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  // Paid → Shipped → Received, with Disputed replacing Received and Refunded appended as branches.
  const steps: { label: string; done: boolean; branch?: boolean }[] = [
    { label: TEXT.steps.paid, done: true },
    { label: TEXT.steps.shipped, done: f !== 'unshipped' },
    f === 'disputed'
      ? { label: TEXT.steps.disputed, done: true, branch: true }
      : { label: TEXT.steps.received, done: f === 'received' },
  ]
  if (refunded) steps.push({ label: TEXT.steps.refunded, done: true, branch: true })

  return (
    <section
      aria-labelledby="progress"
      className="flex flex-col gap-4 border-t border-rule pt-5"
    >
      <h2 id="progress" className="font-display text-lg font-bold">
        {TEXT.progress}
      </h2>
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-center">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm sm:flex-1">
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full border ${
                s.done
                  ? s.branch
                    ? 'border-dotted border-ink bg-paper text-ink'
                    : 'border-ink bg-ink text-paper'
                  : 'border-dashed border-rule text-ink-muted'
              }`}
            >
              <Icon
                name={
                  s.done
                    ? s.branch
                      ? s.label === TEXT.steps.refunded
                        ? 'undo'
                        : 'flag'
                      : 'check'
                    : 'hollow'
                }
              />
            </span>
            <span className={s.done ? 'font-semibold' : 'text-ink-muted'}>{s.label}</span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="mx-2 hidden h-px flex-1 bg-rule sm:block"
              />
            )}
          </li>
        ))}
      </ol>

      {order.refund.state !== 'none' && (
        <p className="flex items-center gap-2 text-sm">
          {TEXT.refund}
          <StatusPill status={order.refund.state} />
          {order.refund.refundedCents > 0 && (
            <Money cents={order.refund.refundedCents} className="font-semibold" />
          )}
        </p>
      )}

      {failed && (
        <Notice tone="danger" title={COPY.postPayment.actionDidNotSave} body={null} />
      )}

      {(canReceive || canDispute) && !disputing && (
        <div className="flex flex-wrap gap-2">
          {canReceive && (
            <Button onClick={() => act('receive')} disabled={busy}>
              {COPY.orderActions.receive}
            </Button>
          )}
          {canDispute && (
            <Button
              variant="secondary"
              onClick={() => setDisputing(true)}
              disabled={busy}
            >
              {COPY.orderActions.dispute}
            </Button>
          )}
        </div>
      )}

      {disputing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            act('dispute')
          }}
          className="flex max-w-xl flex-col gap-3 rounded-slab border border-rule bg-paper p-4"
        >
          <p className="text-sm font-semibold">{COPY.orderActions.disputeConfirm}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {TEXT.disputeReason}
            <textarea
              value={reason}
              maxLength={200}
              rows={3}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-slab border border-rule bg-paper p-2 text-sm focus-visible:border-accent"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy}>
              {COPY.orderActions.dispute}
            </Button>
            <Button variant="quiet" onClick={() => setDisputing(false)} disabled={busy}>
              {COPY.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

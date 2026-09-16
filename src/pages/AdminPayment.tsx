import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import type { Params } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { dateTime, personName, refundLabel, shortDate, usd } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.adminPayment

export default function AdminPayment({ params }: { params: Params }) {
  const persona = usePersona()
  const listings = useListings()
  const [reload, setReload] = useState(0)
  // Tagged with the request it answers, so a retry shows loading again without resetting state in the effect.
  const key = `${params.id}:${reload}`
  const [loaded, setLoaded] = useState<{
    key: string
    order?: OrderView
    failed?: boolean
  }>()
  // A refund answer replaces the loaded view until the next load.
  const [refunded, setRefunded] = useState<{ key: string; order: OrderView }>()

  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<'failed' | 'succeeded' | 'pending' | null>(null)

  useEffect(() => {
    if (persona !== 'admin') return
    let live = true
    api
      .payment(params.id)
      .then((order) => live && setLoaded({ key, order }))
      .catch(() => live && setLoaded({ key, failed: true }))
    return () => {
      live = false
    }
  }, [persona, params.id, key])

  if (persona !== 'admin') {
    return (
      <PageLayout title={T.title}>
        <Notice tone="info" title={COPY.admin.onlyTitle} body={COPY.admin.onlyBody} />
      </PageLayout>
    )
  }

  const current = loaded?.key === key ? loaded : undefined
  const order = (refunded?.key === key ? refunded.order : undefined) ?? current?.order
  const loadError = !!current?.failed

  const back = (
    <Link to="/admin" className="text-sm font-medium text-accent hover:underline">
      {T.back}
    </Link>
  )

  if (loadError || !order) {
    return (
      <PageLayout title={T.title}>
        <div className="flex flex-col gap-4">
          {back}
          {loadError ? (
            <Notice
              tone="danger"
              title={T.loadFailed}
              body={T.loadFailedFact}
              supportRef={params.id}
              action={{
                label: COPY.common.tryAgain,
                onClick: () => setReload((n) => n + 1),
              }}
            />
          ) : (
            <p role="status" className="text-sm text-ink-muted">
              {T.loading}
            </p>
          )}
        </div>
      </PageLayout>
    )
  }

  const { breakdown: b, ledger, refund } = order
  const remaining = b.totalCents - refund.refundedCents
  const canRefund = order.state === 'paid' && remaining > 0
  // Refunds are full only: always the whole order.
  const refundCents = remaining
  const reversed = ledger.balance === 'reversed'
  const disputed = order.fulfilment === 'disputed'
  const items = order.listingIds.map(
    (id) => listings.find((l) => l.id === id)?.title ?? id,
  )
  const when = order.fulfilledAt ?? {}
  const refundDone = refund.state === 'succeeded'
  // `true` = happened, but the contract carries no timestamp for it.
  const timeline: [string, string | true | undefined][] = [
    [
      T.steps.paid,
      order.state === 'paid' || order.state === 'refunded' ? order.createdAt : undefined,
    ],
    [T.steps.shipped, when.shippedAt],
    [T.steps.received, when.receivedAt],
    ...(when.disputedAt || disputed
      ? [[T.steps.disputed, when.disputedAt] as [string, string | undefined]]
      : []),
    ...(refundDone ? [[T.steps.refunded, true] as [string, true]] : []),
  ]

  function askConfirm() {
    setOutcome(null)
    setConfirming(true)
  }

  async function doRefund() {
    setBusy(true)
    try {
      const next = await api.refund({
        paymentId: order!.paymentId,
        actorId: persona,
      })
      setRefunded({ key, order: next })
      setOutcome(
        next.refund.state === 'succeeded'
          ? 'succeeded'
          : next.refund.state === 'pending'
            ? 'pending'
            : 'failed',
      )
    } catch {
      setOutcome('failed')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <PageLayout title={T.title}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          {back}
          <p className="money text-sm break-all text-ink-muted">
            <span className="select-all font-medium text-ink">{order.paymentId}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill status={order.state} />
            <StatusPill status={order.fulfilment} />
            <StatusPill status={refund.state} label={refundLabel(order)} />
          </div>
        </div>

        {disputed && (
          <Notice
            tone={refundDone ? 'info' : 'warning'}
            title={refundDone ? T.disputeResolved : T.disputed}
            body={
              <div className="flex flex-col gap-2">
                <blockquote className="max-w-[65ch] border-l border-state-disputed pl-3 text-base">
                  <span className="block text-xs font-semibold text-ink-muted">
                    {T.disputeReason}
                  </span>
                  {order.disputeReason ? (
                    <span className="font-medium">“{order.disputeReason}”</span>
                  ) : (
                    <span className="text-ink-muted">{T.noDisputeReason}</span>
                  )}
                </blockquote>
                {remaining > 0 && <p>{T.disputedFact}</p>}
              </div>
            }
          />
        )}
        {outcome === 'failed' && (
          <Notice
            tone="danger"
            title={T.refundFailedTitle}
            body={
              disputed
                ? COPY.postPayment.refundFailedDispute
                : COPY.postPayment.refundFailed
            }
            supportRef={order.paymentId}
          />
        )}
        {outcome === 'succeeded' && (
          <Notice
            tone="info"
            title={T.refundDoneTitle}
            body={COPY.postPayment.refundSucceeded}
          />
        )}
        {outcome === 'pending' && (
          <Notice tone="warning" title={T.refundPending} body={T.refundPendingFact} />
        )}
        {order.decline && (
          <Notice
            tone="danger"
            title={T.declinedTitle}
            body={
              <>
                {order.decline.message}{' '}
                <span className="text-ink-muted">
                  {T.declineCode}{' '}
                  <span className="money font-medium text-ink">{order.decline.code}</span>
                  {order.decline.retriable ? T.retriable : T.notRetriable}
                </span>
              </>
            }
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title={T.order}>
            <Row label={T.date}>{shortDate(order.createdAt)}</Row>
            <Row label={T.buyer}>{personName(order.buyerId)}</Row>
            <Row label={T.seller}>{personName(order.sellerId)}</Row>
            <Row label={T.connector}>
              <span className="money">{order.connector ?? '—'}</span>
            </Row>
            <Row label={T.items}>
              <span className="flex flex-col items-end gap-0.5">
                {order.listingIds.map((id, i) => (
                  <Link
                    key={id}
                    to={`/listing/${id}`}
                    className="text-accent hover:underline"
                  >
                    {items[i]}
                  </Link>
                ))}
              </span>
            </Row>
          </Panel>

          <section className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-4">
            <h2 className="font-display text-base font-bold">{T.timeline}</h2>
            <ol className="flex flex-col text-sm">
              {timeline.map(([label, at]) => (
                <li
                  key={label}
                  className="grid grid-cols-[1rem_1fr_auto] items-baseline gap-3 border-b border-rule py-1.5 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 translate-y-px rounded-full border ${at ? 'border-ink bg-ink' : 'border-dashed border-ink-muted'}`}
                  />
                  <span className={at ? 'font-semibold' : 'text-ink-muted'}>{label}</span>
                  <span className={`money text-right ${at ? '' : 'text-ink-muted'}`}>
                    {at === true ? null : at ? (
                      <time dateTime={at}>{dateTime(at)}</time>
                    ) : (
                      T.notYet
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <Panel title={T.charged}>
            <Row label={T.items}>
              <Money cents={b.itemsCents} />
            </Row>
            <Row label={T.shipping}>
              {b.shippingCents === 0 ? (
                COPY.common.freeShipping
              ) : (
                <Money cents={b.shippingCents} />
              )}
            </Row>
            <Row label={T.tax}>
              <Money cents={b.taxCents} />
            </Row>
            <Row label={T.total} strong>
              <Money cents={b.totalCents} />
            </Row>
            {refund.refundedCents > 0 && (
              <>
                <Row label={T.refunded}>
                  <Money cents={-refund.refundedCents} />
                </Row>
                <Row label={T.remaining} strong>
                  <Money cents={remaining} />
                </Row>
              </>
            )}
          </Panel>

          <Panel title={T.ledger}>
            <Row label={T.gross}>
              <Money cents={ledger.grossCents} />
            </Row>
            <Row
              label={`${T.commission}${ledger.balance === 'pending' ? T.expected : ''}`}
            >
              <Money
                cents={reversed || !ledger.commissionCents ? 0 : -ledger.commissionCents}
              />
            </Row>
            <Row
              label={`${T.net}${ledger.balance === 'pending' ? T.expected : ''}`}
              strong
            >
              <Money cents={reversed ? 0 : ledger.netCents} />
            </Row>
            <Row label={T.balance}>
              <StatusPill
                status={
                  ledger.balance === 'pending'
                    ? 'pending'
                    : ledger.balance === 'available'
                      ? 'paid'
                      : 'refunded'
                }
                label={
                  ledger.balance === 'pending'
                    ? T.pending
                    : ledger.balance === 'available'
                      ? T.available
                      : T.reversed
                }
              />
            </Row>
          </Panel>

          {canRefund && (
            <section className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-4">
              <h2 className="font-display text-base font-bold">
                {COPY.orderActions.refund}
              </h2>
              <p className="text-sm">
                {T.fullRefund} <Money cents={remaining} className="font-semibold" />
              </p>
              <div className="pt-2">
                <Button variant="danger" onClick={askConfirm}>
                  {COPY.orderActions.refund}
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        danger
        busy={busy}
        title={T.confirmTitle(usd(refundCents), personName(order.buyerId))}
        body={<p>{T.confirmBody}</p>}
        confirmLabel={busy ? T.refunding : T.confirm(usd(refundCents))}
        onConfirm={doRefund}
        onCancel={() => setConfirming(false)}
      />
    </PageLayout>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-4">
      <h2 className="font-display text-base font-bold">{title}</h2>
      <dl className="flex flex-col divide-y divide-rule text-sm">{children}</dl>
    </section>
  )
}

function Row({
  label,
  strong,
  children,
}: {
  label: string
  strong?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-1.5 ${strong ? 'font-semibold' : ''}`}
    >
      <dt className={strong ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

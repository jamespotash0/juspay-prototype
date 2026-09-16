import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import { Link, type Params } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { ADMIN_ONLY, personName, refundLabel, shortDate } from './Admin.tsx'
import { PageLayout } from './Layout.tsx'
import { dollarsToCents } from './SellNew.tsx'

// ponytail: local strings pending product adding them to COPY (see handback).
const T = {
  back: 'All transactions',
  loadFailed: "We couldn't load this payment.",
  loadFailedFact: 'Nothing has changed. Check the payment id or try again.',
  retry: 'Try again',
  disputed: 'The buyer disputed this order',
  disputedFact:
    'The seller stays unpaid while Slabbed reviews it. Refund the buyer if the item did not arrive as described.',
  refundPending: 'Refund sent — waiting on the connector.',
  refundPendingFact: 'Reload this page to check whether it has settled.',
  amountError: (max: string) => `Enter a dollar amount up to ${max}.`,
}

const usd = (c: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100)

export default function AdminPayment({ params }: { params: Params }) {
  const persona = usePersona()
  const listings = useListings()
  const [order, setOrder] = useState<OrderView | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)

  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<'failed' | 'succeeded' | 'pending' | null>(null)

  useEffect(() => {
    if (persona !== 'admin') return
    let live = true
    setLoadError(false)
    api
      .payment(params.id)
      .then((o) => live && setOrder(o))
      .catch(() => live && setLoadError(true))
    return () => {
      live = false
    }
  }, [persona, params.id, reload])

  if (persona !== 'admin') {
    return (
      <PageLayout title="Payment">
        <Notice tone="info" title={ADMIN_ONLY.title} body={ADMIN_ONLY.body} />
      </PageLayout>
    )
  }

  const back = (
    <Link to="/admin" className="text-sm font-medium text-accent hover:underline">
      {T.back}
    </Link>
  )

  if (loadError || !order) {
    return (
      <PageLayout title="Payment">
        <div className="flex flex-col gap-4">
          {back}
          {loadError ? (
            <Notice
              tone="danger"
              title={T.loadFailed}
              body={T.loadFailedFact}
              supportRef={params.id}
              action={{ label: T.retry, onClick: () => setReload((n) => n + 1) }}
            />
          ) : (
            <p role="status" className="text-sm text-ink-muted">
              Loading payment…
            </p>
          )}
        </div>
      </PageLayout>
    )
  }

  const { breakdown: b, ledger, refund } = order
  const remaining = b.totalCents - refund.refundedCents
  const canRefund = order.state === 'paid' && remaining > 0
  const refundCents = mode === 'full' ? remaining : dollarsToCents(amount)
  const reversed = ledger.balance === 'reversed'
  const items = order.listingIds.map(
    (id) => listings.find((l) => l.id === id)?.title ?? id,
  )

  function askConfirm() {
    if (mode === 'partial' && (!refundCents || refundCents > remaining)) {
      setAmountError(T.amountError(usd(remaining)))
      return
    }
    setAmountError('')
    setOutcome(null)
    setConfirming(true)
  }

  async function doRefund() {
    setBusy(true)
    try {
      const next = await api.refund({
        paymentId: order!.paymentId,
        actorId: persona,
        // Omitted amount = full refund of what is left.
        ...(mode === 'partial' ? { amountCents: refundCents! } : {}),
      })
      setOrder(next)
      setOutcome(
        next.refund.state === 'succeeded'
          ? 'succeeded'
          : next.refund.state === 'pending'
            ? 'pending'
            : 'failed',
      )
      setAmount('')
    } catch {
      setOutcome('failed')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <PageLayout title="Payment">
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

        {order.fulfilment === 'disputed' && remaining > 0 && (
          <Notice tone="warning" title={T.disputed} body={T.disputedFact} />
        )}
        {outcome === 'failed' && (
          <Notice
            tone="danger"
            title="Refund failed"
            body={COPY.postPayment.refundFailed}
            supportRef={order.paymentId}
          />
        )}
        {outcome === 'succeeded' && (
          <Notice
            tone="info"
            title="Refund complete"
            body={COPY.postPayment.refundSucceeded}
          />
        )}
        {outcome === 'pending' && (
          <Notice tone="warning" title={T.refundPending} body={T.refundPendingFact} />
        )}
        {order.decline && (
          <Notice
            tone="danger"
            title="Payment declined"
            body={
              <>
                {order.decline.message}{' '}
                <span className="text-ink-muted">
                  Decline code{' '}
                  <span className="money font-medium text-ink">{order.decline.code}</span>
                  {order.decline.retriable ? ' · retriable' : ' · not retriable'}
                </span>
              </>
            }
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Order">
            <Row label="Date">{shortDate(order.createdAt)}</Row>
            <Row label="Buyer">{personName(order.buyerId)}</Row>
            <Row label="Seller">{personName(order.sellerId)}</Row>
            <Row label="Connector">
              <span className="money">{order.connector ?? '—'}</span>
            </Row>
            <Row label="Items">
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

          <Panel title="Buyer was charged">
            <Row label="Items">
              <Money cents={b.itemsCents} />
            </Row>
            <Row label="Shipping">
              {b.shippingCents === 0 ? (
                'Free shipping'
              ) : (
                <Money cents={b.shippingCents} />
              )}
            </Row>
            <Row label="Sales tax">
              <Money cents={b.taxCents} />
            </Row>
            <Row label="Total" strong>
              <Money cents={b.totalCents} />
            </Row>
            {refund.refundedCents > 0 && (
              <>
                <Row label="Refunded">
                  <Money cents={-refund.refundedCents} />
                </Row>
                <Row label="Remaining" strong>
                  <Money cents={remaining} />
                </Row>
              </>
            )}
          </Panel>

          <Panel title="Seller ledger">
            <Row label="Gross (items + shipping)">
              <Money cents={ledger.grossCents} />
            </Row>
            <Row
              label={
                ledger.balance === 'pending' ? 'Commission (expected)' : 'Commission'
              }
            >
              <Money
                cents={reversed || !ledger.commissionCents ? 0 : -ledger.commissionCents}
              />
            </Row>
            <Row label={ledger.balance === 'pending' ? 'Net (expected)' : 'Net'} strong>
              <Money cents={reversed ? 0 : ledger.netCents} />
            </Row>
            <Row label="Balance">
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
                    ? 'Pending'
                    : ledger.balance === 'available'
                      ? 'Available'
                      : 'Reversed'
                }
              />
            </Row>
          </Panel>

          {canRefund && (
            <section className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-4">
              <h2 className="font-display text-base font-bold">
                {COPY.orderActions.refund}
              </h2>
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="sr-only">Refund amount</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'full'}
                    onChange={() => setMode('full')}
                    className="accent-accent"
                  />
                  Full refund of <Money cents={remaining} className="font-semibold" />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'partial'}
                    onChange={() => setMode('partial')}
                    className="accent-accent"
                  />
                  Partial refund
                </label>
                {mode === 'partial' && (
                  <div className="flex flex-col gap-1 pl-6">
                    <label htmlFor="refund-amount" className="text-ink-muted">
                      Amount in US dollars
                    </label>
                    <input
                      id="refund-amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      aria-invalid={!!amountError}
                      className="money h-10 w-40 rounded-slab border border-rule bg-paper px-3 aria-[invalid=true]:border-state-failed"
                    />
                    {amountError && <p className="text-state-failed">{amountError}</p>}
                  </div>
                )}
              </fieldset>
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
        title={`Refund ${usd(refundCents ?? 0)} to ${personName(order.buyerId)}?`}
        body={
          <p>
            The money goes back to the buyer's card and cannot be taken back. The seller's
            balance for this sale is reversed.
          </p>
        }
        confirmLabel={busy ? 'Refunding…' : `Refund ${usd(refundCents ?? 0)}`}
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

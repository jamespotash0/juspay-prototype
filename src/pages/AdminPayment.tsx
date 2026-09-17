import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import type { Params } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView } from '../shared/types.ts'
import { Card, SectionHeading } from '../ui/Card.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { Icon } from '../ui/Icon.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { dateTime, personName, shortDate } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.adminPayment
const EYEBROW = COPY.pageHeaders.adminPayment.eyebrow

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
  const order = current?.order
  const loadError = !!current?.failed

  const back = (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
    >
      <Icon name="arrowLeft" className="size-4" />
      {T.back}
    </Link>
  )

  if (loadError || !order) {
    return (
      <PageLayout title={T.title} eyebrow={EYEBROW} back={back} width="narrow">
        <div className="flex flex-col gap-4">
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

  return (
    <PageLayout title={T.title} eyebrow={EYEBROW} back={back} width="narrow">
      <div className="flex flex-col gap-4 sm:gap-5">
        <p className="money -mt-3 text-xs break-all text-ink-muted sm:-mt-4">
          <span className="select-all">{order.paymentId}</span>
        </p>

        {disputed && (
          <Notice
            tone={refundDone ? 'info' : 'warning'}
            title={refundDone ? T.disputeResolved : T.disputed}
            body={
              <div className="flex flex-col gap-2">
                <blockquote className="max-w-[65ch] rounded-control bg-paper/70 px-3 py-2 text-sm">
                  <span className="mb-0.5 block text-xs font-medium text-ink-muted">
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

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
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

          <Card as="section">
            <SectionHeading>{T.timeline}</SectionHeading>
            <ol className="flex flex-col text-sm">
              {timeline.map(([label, at]) => (
                <li
                  key={label}
                  className="grid grid-cols-[1rem_1fr_auto] items-baseline gap-3 border-b border-rule py-2 first:pt-0 last:border-b-0 last:pb-0"
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
          </Card>

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

          {order.state === 'paid' && remaining > 0 && (
            <p className="px-1 text-sm text-ink-muted">{T.sellerRefunds}</p>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section">
      <SectionHeading>{title}</SectionHeading>
      <dl className="money flex flex-col divide-y divide-rule text-sm">{children}</dl>
    </Card>
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
      className={`flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0 ${strong ? 'font-semibold' : ''}`}
    >
      <dt className={strong ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { latestStatus } from '../shared/orderState.ts'
import { SELLERS } from '../shared/seed.ts'
import type { OrderView } from '../shared/types.ts'
import { Card } from '../ui/Card.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { orderNumber, refundLabel } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.orders

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

// The sandbox list read takes seconds, so a repeat visit shows the last list at once and refreshes it.
// ponytail: per-browser convenience only; the fresh read replaces it and statuses can be briefly stale.
const cacheKey = (persona: string) => `slabbed.orders.${persona}`
function readCache(persona: string): OrderView[] | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(persona))
    return raw ? (JSON.parse(raw) as OrderView[]) : undefined
  } catch {
    return undefined
  }
}

const MAX_ITEMS = 3

/** Seller orders grouped back into purchases (one payment each), newest first. */
function purchases(orders: OrderView[]): OrderView[][] {
  const byPayment = new Map<string, OrderView[]>()
  for (const o of orders)
    byPayment.set(o.paymentId, [...(byPayment.get(o.paymentId) ?? []), o])
  return [...byPayment.values()].sort((a, b) =>
    b[0].createdAt.localeCompare(a[0].createdAt),
  )
}

export default function Orders() {
  const persona = usePersona()
  const listings = useListings()
  const [attempt, setAttempt] = useState(0)
  // Tagged with the request it answers, so a persona switch or retry shows loading again.
  const key = `${persona}:${attempt}`
  const [result, setResult] = useState<{
    key: string
    orders?: OrderView[]
    failed?: boolean
  }>()

  useEffect(() => {
    let live = true
    api
      .orders({ buyer: persona })
      .then((r) => {
        try {
          localStorage.setItem(cacheKey(persona), JSON.stringify(r.orders))
        } catch {
          // storage unavailable: next visit loads from scratch
        }
        if (live) setResult({ key, orders: r.orders })
      })
      .catch(() => live && setResult({ key, failed: true }))
    return () => {
      live = false
    }
  }, [persona, key])

  const current = result?.key === key ? result : undefined
  const cached = current ? undefined : readCache(persona)
  const orders = current?.orders ?? cached
  const failed = current?.failed

  return (
    <PageLayout
      title={COPY.pageHeaders.orders.title}
      eyebrow={COPY.pageHeaders.orders.eyebrow}
    >
      {failed ? (
        <Notice
          tone="danger"
          title={T.loadFailed}
          body={T.loadFailedFact}
          action={{
            label: COPY.common.tryAgain,
            onClick: () => setAttempt((n) => n + 1),
          }}
        />
      ) : !orders ? (
        <Card padding="none">
          <ul aria-busy="true" aria-label={T.loading} className="divide-y divide-rule">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <span className="size-12 shrink-0 animate-pulse rounded-control bg-well" />
                <span className="h-3 w-1/3 animate-pulse rounded-full bg-well" />
              </li>
            ))}
          </ul>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState
          title={COPY.empty.orders.title}
          fact={COPY.empty.orders.fact}
          action={{ label: COPY.empty.orders.action, onClick: () => navigate('/') }}
        />
      ) : (
        <>
          <Card padding="none">
            <ul className="divide-y divide-rule">
              {purchases(orders).map((group) => {
                const first = group[0]
                // Latest status per seller order. When every seller is at the same step, say it once.
                const pill = (o: OrderView) => {
                  const status = latestStatus(o)
                  return (
                    <StatusPill
                      status={status}
                      label={status === o.refund.state ? refundLabel(o) : undefined}
                    />
                  )
                }
                const keyOf = (o: OrderView) =>
                  `${latestStatus(o)}:${refundLabel(o) ?? ''}`
                const shared = group.every((o) => keyOf(o) === keyOf(first))
                const items = group.flatMap((o) =>
                  o.listingIds.map((id) => ({
                    order: o,
                    listing: listings.find((l) => l.id === id),
                  })),
                )
                const shown = items.slice(0, MAX_ITEMS)
                return (
                  <li key={first.paymentId}>
                    <Link
                      to={`/order/${first.orderId}`}
                      className="group flex flex-col gap-2.5 px-4 py-3.5 hover:bg-well sm:px-5 [li:first-child>&]:rounded-t-card [li:last-child>&]:rounded-b-card"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="money min-w-0 truncate text-xs text-ink-muted">
                          <span className="font-semibold text-ink">
                            {orderNumber(first.paymentId)}
                          </span>{' '}
                          · {date.format(new Date(first.createdAt))}
                          {items.length > 1 && <> · {T.itemCount(items.length)}</>}
                        </p>
                        <div className="flex items-center gap-3">
                          <Money
                            cents={group.reduce((n, o) => n + o.breakdown.totalCents, 0)}
                            className="text-sm font-semibold"
                          />
                        </div>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {shown.map(({ order, listing }, i) => {
                          // A seller's status sits on their first item only.
                          const firstOfSeller =
                            shown.findIndex((x) => x.order === order) === i
                          return (
                            <li
                              key={`${order.orderId}:${listing?.id ?? i}`}
                              className="flex items-center gap-3"
                            >
                              {listing ? (
                                <img
                                  src={listing.imageUrl}
                                  alt=""
                                  className="size-12 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
                                />
                              ) : (
                                <span className="size-12 shrink-0 rounded-control border border-dashed border-rule-strong" />
                              )}
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <p className="truncate text-sm font-semibold group-hover:underline">
                                  {listing?.title ?? T.gone}
                                </p>
                                <p className="truncate text-xs text-ink-muted">
                                  {SELLERS.find((x) => x.id === order.sellerId)?.handle ??
                                    order.sellerId}
                                </p>
                              </div>
                              {(shared ? i === 0 : firstOfSeller) && (
                                <span className="shrink-0">{pill(order)}</span>
                              )}
                            </li>
                          )
                        })}
                        {items.length > MAX_ITEMS && (
                          <li className="pl-15 text-xs text-ink-muted">
                            {T.more(items.length - MAX_ITEMS).trim()}
                          </li>
                        )}
                      </ul>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </PageLayout>
  )
}

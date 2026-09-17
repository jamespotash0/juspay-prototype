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
                const items = group
                  .flatMap((o) => o.listingIds)
                  .map((id) => listings.find((l) => l.id === id))
                const lead = items[0]
                const title = lead?.title ?? T.gone
                const more = items.length > 1 ? T.more(items.length - 1) : ''
                const sellers = group.length
                const from =
                  sellers > 1
                    ? T.fromSellers(sellers)
                    : (SELLERS.find((s) => s.id === first.sellerId)?.handle ??
                      first.sellerId)
                // One status per seller order, latest only: the order page has the detail.
                const pills = group.map((o) => {
                  const status = latestStatus(o)
                  return (
                    <StatusPill
                      key={o.orderId}
                      status={status}
                      label={status === o.refund.state ? refundLabel(o) : undefined}
                    />
                  )
                })
                return (
                  <li key={first.paymentId}>
                    <Link
                      to={`/order/${first.orderId}`}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-well sm:gap-4 sm:px-5 [li:first-child>&]:rounded-t-card [li:last-child>&]:rounded-b-card"
                    >
                      {lead ? (
                        <img
                          src={lead.imageUrl}
                          alt=""
                          className="size-12 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
                        />
                      ) : (
                        <span className="size-12 shrink-0 rounded-control border border-dashed border-rule-strong" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="line-clamp-2 text-sm font-semibold sm:truncate">
                          {title}
                          {more}
                        </p>
                        <p className="money truncate text-xs text-ink-muted">
                          <span className="font-medium text-ink">
                            {orderNumber(first.paymentId)}
                          </span>{' '}
                          · {date.format(new Date(first.createdAt))} · {from}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                          {pills}
                        </div>
                      </div>
                      <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                        {pills}
                      </div>
                      <Money
                        cents={group.reduce((n, o) => n + o.breakdown.totalCents, 0)}
                        className="w-20 shrink-0 text-right text-sm font-semibold sm:w-24"
                      />
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

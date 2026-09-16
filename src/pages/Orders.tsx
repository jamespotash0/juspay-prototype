import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import { Link, navigate } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { SELLERS } from '../shared/seed.ts'
import type { OrderView } from '../shared/types.ts'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { PageLayout } from './Layout.tsx'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

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
      .then((r) => live && setResult({ key, orders: r.orders }))
      .catch(() => live && setResult({ key, failed: true }))
    return () => {
      live = false
    }
  }, [persona, key])

  const current = result?.key === key ? result : undefined
  const orders = current?.orders
  const failed = current?.failed

  return (
    <PageLayout title="Your orders">
      {failed ? (
        <Notice
          tone="danger"
          title="We couldn't load your orders."
          body="Your payments are unaffected. This only failed to read them."
          action={{ label: 'Try again', onClick: () => setAttempt((n) => n + 1) }}
        />
      ) : !orders ? (
        <ul aria-busy="true" aria-label="Loading orders" className="flex flex-col">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 animate-pulse border-b border-rule bg-paper/60" />
          ))}
        </ul>
      ) : orders.length === 0 ? (
        <EmptyState
          title={COPY.empty.orders.title}
          fact={COPY.empty.orders.fact}
          action={{ label: COPY.empty.orders.action, onClick: () => navigate('/') }}
        />
      ) : (
        <ul className="flex flex-col border-t border-rule">
          {[...orders]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((o) => {
              const items = o.listingIds.map((id) => listings.find((l) => l.id === id))
              const first = items[0]
              const title = first?.title ?? 'Listing no longer available'
              const more = items.length > 1 ? ` + ${items.length - 1} more` : ''
              const seller = SELLERS.find((s) => s.id === o.sellerId)
              return (
                <li key={o.paymentId}>
                  <Link
                    to={`/order/${o.paymentId}`}
                    className="group flex items-center gap-3 border-b border-rule py-3 hover:bg-paper sm:gap-4 sm:px-2"
                  >
                    {first ? (
                      <img
                        src={first.imageUrl}
                        alt=""
                        className="size-14 shrink-0 rounded-slab border border-rule bg-bone object-contain p-1"
                      />
                    ) : (
                      <span className="size-14 shrink-0 rounded-slab border border-dashed border-rule" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate font-medium group-hover:underline">
                        {title}
                        {more}
                      </p>
                      <p className="money text-xs text-ink-muted">
                        {seller?.handle ?? o.sellerId} ·{' '}
                        {date.format(new Date(o.createdAt))}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill status={o.state} />
                        {o.refund.state !== 'none' ? (
                          <StatusPill
                            status={o.refund.state}
                            label={
                              o.refund.state === 'pending'
                                ? 'Refund pending'
                                : o.refund.state === 'failed'
                                  ? 'Refund failed'
                                  : undefined
                            }
                          />
                        ) : (
                          <StatusPill status={o.fulfilment} />
                        )}
                      </div>
                    </div>
                    <Money
                      cents={o.breakdown.totalCents}
                      className="self-start text-right font-semibold"
                    />
                  </Link>
                </li>
              )
            })}
        </ul>
      )}
    </PageLayout>
  )
}

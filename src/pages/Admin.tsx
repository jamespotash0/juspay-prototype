import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView } from '../shared/types.ts'
import { Card } from '../ui/Card.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { personName, refundLabel, shortDate } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.admin
const H = COPY.pageHeaders.admin

export default function Admin() {
  const persona = usePersona()
  const [reload, setReload] = useState(0)
  // Tagged with the request it answers, so a retry shows loading again without resetting state in the effect.
  const key = `${persona}:${reload}`
  const [result, setResult] = useState<{
    key: string
    orders?: OrderView[]
    failed?: boolean
  }>()
  const [filter, setFilter] = useState<'all' | 'disputes'>('all')

  useEffect(() => {
    if (persona !== 'admin') return
    let live = true
    api
      .orders({ all: true })
      .then((r) => live && setResult({ key, orders: r.orders }))
      .catch(() => live && setResult({ key, failed: true }))
    return () => {
      live = false
    }
  }, [persona, key])

  const current = result?.key === key ? result : undefined
  const orders = current?.orders ?? null
  const loadError = !!current?.failed

  if (persona !== 'admin') {
    return (
      <PageLayout title={H.title} eyebrow={H.eyebrow}>
        <Notice tone="info" title={T.onlyTitle} body={T.onlyBody} />
      </PageLayout>
    )
  }

  const disputes = orders?.filter((o) => o.fulfilment === 'disputed') ?? []
  const rows = filter === 'disputes' ? disputes : (orders ?? [])

  const filters = (
    <div className="flex gap-2" role="group" aria-label={T.filter}>
      {(['all', 'disputes'] as const).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => setFilter(f)}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-rule-strong bg-paper px-4 text-sm font-medium text-ink hover:border-ink aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-ink"
        >
          {f === 'all' ? T.all : T.disputes}
          {orders && (
            <span className="money text-xs opacity-70">
              {f === 'all' ? orders.length : disputes.length}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <PageLayout title={H.title} eyebrow={H.eyebrow} actions={filters}>
      <div className="flex flex-col gap-4">
        {loadError ? (
          <Notice
            tone="danger"
            title={T.loadFailed}
            body={T.loadFailedFact}
            action={{
              label: COPY.common.tryAgain,
              onClick: () => setReload((n) => n + 1),
            }}
          />
        ) : orders === null ? (
          <p role="status" className="text-sm text-ink-muted">
            {T.loading}
          </p>
        ) : rows.length === 0 ? (
          <Card as="div" className="text-center text-sm text-ink-muted">
            {filter === 'disputes' ? T.noDisputes : T.none}
          </Card>
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-left text-sm max-md:block md:min-w-[56rem]">
              <thead className="border-b border-rule text-xs text-ink-muted max-md:hidden">
                <tr>
                  {T.columns.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-3 font-medium first:pl-5 last:pr-5 ${i === 4 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule max-md:block">
                {rows.map((o) => (
                  <tr
                    key={o.orderId}
                    className="hover:bg-well max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:px-4 max-md:py-3 md:[&>td]:px-4 md:[&>td]:py-3.5 md:[&>td:first-child]:pl-5 md:[&>td:last-child]:pr-5 max-md:[&>td]:p-0"
                  >
                    <td className="max-md:w-full">
                      <Link
                        to={`/admin/payment/${o.orderId}`}
                        className="money font-medium text-accent hover:underline"
                      >
                        {o.paymentId}
                      </Link>
                    </td>
                    <td className="money whitespace-nowrap text-ink-muted">
                      {shortDate(o.createdAt)}
                    </td>
                    <td>{personName(o.buyerId)}</td>
                    <td>{personName(o.sellerId)}</td>
                    <td className="text-right">
                      <Money cents={o.breakdown.totalCents} className="font-semibold" />
                    </td>
                    <td>
                      <StatusPill status={o.state} />
                    </td>
                    <td>
                      <StatusPill status={o.fulfilment} />
                    </td>
                    <td>
                      <StatusPill status={o.refund.state} label={refundLabel(o)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}

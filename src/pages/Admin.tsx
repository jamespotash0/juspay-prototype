import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView } from '../shared/types.ts'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { personName, refundLabel, shortDate } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.admin

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
      <PageLayout title={T.title}>
        <Notice tone="info" title={T.onlyTitle} body={T.onlyBody} />
      </PageLayout>
    )
  }

  const disputes = orders?.filter((o) => o.fulfilment === 'disputed') ?? []
  const rows = filter === 'disputes' ? disputes : (orders ?? [])

  return (
    <PageLayout title={T.title}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2" role="group" aria-label={T.filter}>
          {(['all', 'disputes'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className="inline-flex h-8 items-center gap-1.5 rounded-slab border border-rule bg-paper px-3 text-sm font-medium text-accent hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
            >
              {f === 'all' ? T.all : T.disputes}
              {orders && (
                <span className="money text-xs">
                  {f === 'all' ? orders.length : disputes.length}
                </span>
              )}
            </button>
          ))}
        </div>

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
          <p className="border-y border-rule py-10 text-ink-muted">
            {filter === 'disputes' ? T.noDisputes : T.none}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-slab border border-rule bg-paper">
            <table className="w-full text-left text-sm max-md:block md:min-w-[56rem]">
              <thead className="border-b border-rule bg-bone text-xs text-ink-muted max-md:hidden">
                <tr>
                  {T.columns.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-3 py-2 font-semibold ${i === 4 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule max-md:block">
                {rows.map((o) => (
                  <tr
                    key={o.paymentId}
                    className="hover:bg-bone max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:px-3 max-md:py-3 max-md:[&>td]:p-0"
                  >
                    <td className="px-3 py-2 max-md:w-full">
                      <Link
                        to={`/admin/payment/${o.paymentId}`}
                        className="money font-medium text-accent hover:underline"
                      >
                        {o.paymentId}
                      </Link>
                    </td>
                    <td className="money px-3 py-2 whitespace-nowrap">
                      {shortDate(o.createdAt)}
                    </td>
                    <td className="px-3 py-2">{personName(o.buyerId)}</td>
                    <td className="px-3 py-2">{personName(o.sellerId)}</td>
                    <td className="px-3 py-2 text-right">
                      <Money cents={o.breakdown.totalCents} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={o.state} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={o.fulfilment} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={o.refund.state} label={refundLabel(o)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

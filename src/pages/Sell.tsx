import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { removeListing, useListings } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { useSoldIds } from '../lib/sold.ts'
import { COPY } from '../shared/copy.ts'
import { latestStatus } from '../shared/orderState.ts'
import type { Listing, OrderView, PersonaId, SellerLedger } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Card, SectionHeading } from '../ui/Card.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { Slab } from '../ui/Slab.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { personName, refundLabel, shortDate } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'
import SellInsights from './SellInsights.tsx'

const T = COPY.sell
const H = COPY.pageHeaders.sell

// Contract: a reversed sale shows commission and net as 0, whatever the server sent.
const shown = (l: SellerLedger) =>
  l.balance === 'reversed' ? { ...l, commissionCents: 0, netCents: 0 } : l

/** Each sale sits in one bucket, from its latest status only. Anything unusual shows under All. */
type SaleFilter = 'all' | 'toShip' | 'shipped' | 'received' | 'issue' | 'refunded'
function bucket(o: OrderView): SaleFilter {
  const s = latestStatus(o)
  if (o.refund.state !== 'none') return 'refunded'
  if (s === 'unshipped') return 'toShip'
  if (s === 'shipped') return 'shipped'
  if (s === 'received') return 'received'
  if (s === 'disputed') return 'issue'
  return 'all'
}
const SALE_FILTERS: SaleFilter[] = [
  'all',
  'toShip',
  'shipped',
  'received',
  'issue',
  'refunded',
]

type ListingFilter = 'all' | 'coin' | 'card'
const LISTING_FILTERS: ListingFilter[] = ['all', 'coin', 'card']

export default function Sell() {
  const persona = usePersona()
  const soldHere = useSoldIds()
  const mine = useListings().filter((l) => l.sellerId === persona)
  const [reload, setReload] = useState(0)
  // Tagged with the request it answers, so a persona switch or retry shows loading again.
  const key = `${persona}:${reload}`
  const [result, setResult] = useState<{
    key: string
    orders?: OrderView[]
    failed?: boolean
  }>()
  /** The sale whose money just moved pending → available, so its net highlights once. */
  const [released, setReleased] = useState<string | null>(null)

  useEffect(() => {
    if (persona === 'admin') return
    let live = true
    api
      .orders({ seller: persona })
      .then((r) => live && setResult({ key, orders: r.orders }))
      .catch(() => live && setResult({ key, failed: true }))
    return () => {
      live = false
    }
  }, [persona, key])

  if (persona === 'admin') {
    return (
      <PageLayout title={H.title} eyebrow={H.eyebrow}>
        <Notice tone="info" title={T.adminOnly} body={T.adminFact} />
      </PageLayout>
    )
  }

  const current = result?.key === key ? result : undefined
  const orders = current?.orders ?? null
  const loadError = !!current?.failed

  // A listing is current until someone buys it: a sale from the server, or a purchase in this browser.
  const soldIds = new Set([...soldHere, ...(orders ?? []).flatMap((o) => o.listingIds)])
  const active = mine.filter((l) => !soldIds.has(l.id))

  function update(next: OrderView) {
    const prev = orders?.find((o) => o.orderId === next.orderId)
    if (prev?.ledger.balance === 'pending' && next.ledger.balance === 'available')
      setReleased(next.orderId)
    setResult({
      key,
      orders: orders!.map((x) => (x.orderId === next.orderId ? next : x)),
    })
  }

  return (
    <PageLayout
      title={H.title}
      eyebrow={H.eyebrow}
      actions={
        <Button size="sm" onClick={() => navigate('/sell/new')}>
          {T.newListing}
        </Button>
      }
    >
      <div className="flex flex-col gap-10">
        {orders && !loadError && (
          <SellInsights
            sales={orders.map((o) => ({
              createdAt: o.createdAt,
              ledger: shown(o.ledger),
            }))}
          />
        )}

        <section aria-labelledby="sell-sold">
          <SectionHeading id="sell-sold">{T.sales}</SectionHeading>
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
            <Card padding="none">
              <ul
                aria-busy="true"
                aria-label={T.loading}
                className="divide-y divide-rule"
              >
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
              title={COPY.empty.sales.title}
              fact={COPY.empty.sales.fact}
              action={{
                label: COPY.empty.sales.action,
                onClick: () => navigate('/sell/new'),
              }}
            />
          ) : (
            <Sold
              orders={orders}
              sellerId={persona}
              released={released}
              onChange={update}
            />
          )}
        </section>

        <section aria-labelledby="sell-listings">
          <SectionHeading id="sell-listings">{T.listings}</SectionHeading>
          {active.length === 0 ? (
            <EmptyState
              title={COPY.empty.listings.title}
              fact={COPY.empty.listings.fact}
              action={{
                label: COPY.empty.listings.action,
                onClick: () => navigate('/sell/new'),
              }}
            />
          ) : (
            <Active listings={active} />
          )}
        </section>
      </div>
    </PageLayout>
  )
}

/** A row of pill toggles with counts. One is always on. */
function FilterPills<F extends string>({
  label,
  options,
  value,
  onChange,
  count,
  name,
}: {
  label: string
  options: F[]
  value: F
  onChange: (f: F) => void
  count: (f: F) => number
  name: (f: F) => string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rule-strong bg-paper px-3 text-sm font-medium text-ink-muted hover:border-ink hover:text-ink aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-ink"
        >
          {name(f)}
          <span className="money text-xs opacity-70">{count(f)}</span>
        </button>
      ))}
    </div>
  )
}

function Sold({
  orders,
  sellerId,
  released,
  onChange,
}: {
  orders: OrderView[]
  sellerId: PersonaId
  released: string | null
  onChange: (o: OrderView) => void
}) {
  const [filter, setFilter] = useState<SaleFilter>('all')
  const count = (f: SaleFilter) =>
    f === 'all' ? orders.length : orders.filter((o) => bucket(o) === f).length
  const rows = [...orders]
    .filter((o) => filter === 'all' || bucket(o) === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="flex flex-col gap-3">
      <FilterPills
        label={T.filterSales}
        options={SALE_FILTERS}
        value={filter}
        onChange={setFilter}
        count={count}
        name={(f) => T.saleFilters[f]}
      />
      {rows.length === 0 ? (
        <Card padding="md" className="text-sm text-ink-muted">
          {T.noneInFilter}
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-rule">
            {rows.map((o) => (
              <Sale
                key={o.orderId}
                order={o}
                sellerId={sellerId}
                released={released === o.orderId}
                onChange={onChange}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Sale({
  order,
  sellerId,
  released,
  onChange,
}: {
  order: OrderView
  sellerId: PersonaId
  released: boolean
  onChange: (o: OrderView) => void
}) {
  const all = useListings()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const items = order.listingIds.map((id) => all.find((l) => l.id === id))
  const first = items[0]
  const title =
    (first?.title ?? COPY.orders.gone) +
    (items.length > 1 ? COPY.orders.more(items.length - 1) : '')
  const status = latestStatus(order)
  const ledger = shown(order.ledger)
  const canShip =
    order.sellerId === sellerId &&
    order.state === 'paid' &&
    order.fulfilment === 'unshipped' &&
    order.refund.state === 'none'

  async function ship() {
    setBusy(true)
    setFailed(false)
    try {
      onChange(
        await api.orderState({
          paymentId: order.orderId,
          action: 'ship',
          actorId: sellerId,
        }),
      )
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
      <Link
        to={`/order/${order.orderId}`}
        className="group flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto"
      >
        {first ? (
          <img
            src={first.imageUrl}
            alt=""
            className="size-12 shrink-0 rounded-control border border-rule bg-paper object-contain p-1"
          />
        ) : (
          <span className="size-12 shrink-0 rounded-control border border-dashed border-rule-strong" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold group-hover:underline">{title}</p>
          <p className="truncate text-xs text-ink-muted">
            {T.boughtBy} {personName(order.buyerId)} · {shortDate(order.createdAt)}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-3 max-sm:pl-15">
        <StatusPill
          status={status}
          label={status === order.refund.state ? refundLabel(order) : undefined}
        />
        {canShip && (
          <Button size="sm" onClick={ship} disabled={busy}>
            {busy ? COPY.common.saving : COPY.orderActions.ship}
          </Button>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end max-sm:ml-auto sm:w-28">
        <Money
          cents={ledger.netCents}
          className={`text-sm font-semibold ${ledger.balance === 'reversed' ? 'text-ink-muted' : ''} ${released ? 'release-amount rounded-control px-1' : ''}`}
        />
        <span className="text-xs text-ink-muted">
          {ledger.balance === 'pending'
            ? T.pending
            : ledger.balance === 'available'
              ? T.available
              : T.reversed}
        </span>
      </div>

      {failed && (
        <p role="alert" className="basis-full text-sm font-medium text-state-failed">
          {COPY.postPayment.actionDidNotSave}
        </p>
      )}
    </li>
  )
}

function Active({ listings }: { listings: Listing[] }) {
  const [filter, setFilter] = useState<ListingFilter>('all')
  const [q, setQ] = useState('')
  const [removing, setRemoving] = useState<Listing | null>(null)
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const byCategory = (f: ListingFilter) =>
    listings.filter((l) => f === 'all' || l.category === f)
  const rows = byCategory(filter)
    .filter((l) => {
      const hay = [l.title, l.grade, l.certNumber, l.year].join(' ').toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          label={T.filterListings}
          options={LISTING_FILTERS}
          value={filter}
          onChange={setFilter}
          count={(f) => byCategory(f).length}
          name={(f) => T.listingFilters[f]}
        />
        <label className="relative ml-auto w-full min-w-0 sm:w-64">
          <span className="sr-only">{T.searchListings}</span>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={T.searchListings}
            className="h-8 w-full rounded-full border border-rule-strong bg-paper pr-3 pl-9 text-sm placeholder:text-ink-muted hover:border-ink focus-visible:border-ink"
          />
        </label>
      </div>

      {rows.length === 0 ? (
        <Card padding="md" className="text-sm text-ink-muted">
          {T.noneInFilter}
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-rule">
            {rows.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <div
                  aria-hidden="true"
                  className="size-12 shrink-0 rounded-control border border-rule bg-paper p-0.5"
                >
                  <Slab listing={l} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    to={`/listing/${l.id}`}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    {l.title}
                  </Link>
                  <p className="truncate text-xs text-ink-muted">
                    {T.listedOn} {shortDate(l.createdAt)} ·{' '}
                    {l.shippingCents === 0 ? (
                      COPY.common.freeShipping
                    ) : (
                      <>
                        + <Money cents={l.shippingCents} /> {COPY.common.plusShipping}
                      </>
                    )}
                  </p>
                </div>
                <Money cents={l.priceCents} className="text-sm font-semibold" />
                <Button size="sm" variant="quiet" onClick={() => setRemoving(l)}>
                  {T.remove}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!removing}
        danger
        title={T.removeTitle}
        body={<p>{T.removeBody(removing?.title ?? '')}</p>}
        confirmLabel={T.removeConfirm}
        cancelLabel={T.keepListing}
        onConfirm={() => {
          if (removing) removeListing(removing.id)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

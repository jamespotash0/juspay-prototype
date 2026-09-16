import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { Link } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView, PersonaId, SellerLedger } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { personName, shortDate } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.sell

// Contract: a reversed sale shows commission and net as 0, whatever the server sent.
const shown = (l: SellerLedger) =>
  l.balance === 'reversed' ? { ...l, commissionCents: 0, netCents: 0 } : l

export default function Sell() {
  const persona = usePersona()
  const listings = useListings().filter((l) => l.sellerId === persona)
  const [reload, setReload] = useState(0)
  // Tagged with the request it answers, so a persona switch or retry shows loading again.
  const key = `${persona}:${reload}`
  const [result, setResult] = useState<{
    key: string
    orders?: OrderView[]
    failed?: boolean
  }>()
  /** The sale whose money just moved pending → available, so it (and the totals) animate once. */
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
      <PageLayout title={T.title}>
        <Notice tone="info" title={T.adminOnly} body={T.adminFact} />
      </PageLayout>
    )
  }

  const current = result?.key === key ? result : undefined
  const orders = current?.orders ?? null
  const loadError = !!current?.failed
  const toNew = { label: COPY.empty.sales.action, onClick: () => navigate('/sell/new') }

  function update(next: OrderView) {
    const prev = orders?.find((o) => o.paymentId === next.paymentId)
    if (prev?.ledger.balance === 'pending' && next.ledger.balance === 'available')
      setReleased(next.paymentId)
    setResult({
      key,
      orders: orders!.map((x) => (x.paymentId === next.paymentId ? next : x)),
    })
  }

  return (
    <PageLayout title={T.title}>
      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold">{T.listings}</h2>
            {listings.length > 0 && (
              <Button variant="secondary" onClick={() => navigate('/sell/new')}>
                {T.newListing}
              </Button>
            )}
          </div>
          {listings.length === 0 ? (
            <EmptyState
              title={COPY.empty.listings.title}
              fact={COPY.empty.listings.fact}
              action={{
                label: COPY.empty.listings.action,
                onClick: () => navigate('/sell/new'),
              }}
            />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {listings.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <img
                    src={l.imageUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-slab border border-rule bg-paper object-contain"
                  />
                  <Link
                    to={`/listing/${l.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-accent hover:underline"
                  >
                    {l.title}
                  </Link>
                  <Money cents={l.priceCents} className="text-sm font-semibold" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">{T.sales}</h2>
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
            <p className="text-sm text-ink-muted" role="status">
              {T.loading}
            </p>
          ) : orders.length === 0 ? (
            <EmptyState
              title={COPY.empty.sales.title}
              fact={COPY.empty.sales.fact}
              action={toNew}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-rule border-y border-rule">
              {orders.map((o) => (
                <Sale
                  key={o.paymentId}
                  order={o}
                  sellerId={persona}
                  released={released === o.paymentId}
                  onChange={update}
                />
              ))}
            </ul>
          )}
        </section>

        {orders && !loadError && (
          <Balance orders={orders} released={released} onList={toNew.onClick} />
        )}
      </div>
    </PageLayout>
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
  const titles = order.listingIds.map((id) => all.find((l) => l.id === id)?.title ?? id)
  const refunded = order.refund.state === 'succeeded'
  const canShip =
    order.sellerId === sellerId &&
    order.state === 'paid' &&
    order.fulfilment === 'unshipped' &&
    !refunded

  async function ship() {
    setBusy(true)
    setFailed(false)
    try {
      onChange(
        await api.orderState({
          paymentId: order.paymentId,
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
    <li className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-semibold">{titles.join(', ')}</p>
        <p className="text-sm text-ink-muted">
          {T.boughtBy} {personName(order.buyerId)} · {shortDate(order.createdAt)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {refunded ? (
            <StatusPill status="refunded" />
          ) : (
            <StatusPill status={order.state} />
          )}
          <StatusPill status={order.fulfilment} />
        </div>
        {canShip && (
          <div className="mt-1 flex flex-col items-start gap-2">
            <Button onClick={ship} disabled={busy}>
              {busy ? COPY.common.saving : COPY.orderActions.ship}
            </Button>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm font-medium text-state-failed">
            {COPY.postPayment.actionDidNotSave}
          </p>
        )}
      </div>
      <Ledger ledger={shown(order.ledger)} released={released} />
    </li>
  )
}

function Ledger({ ledger, released }: { ledger: SellerLedger; released: boolean }) {
  const expected = ledger.balance === 'pending' ? T.expected : ''
  const reversed = ledger.balance === 'reversed'
  return (
    <div className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-3">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>{T.gross}</dt>
        <dd className="text-right">
          <Money cents={ledger.grossCents} className={reversed ? 'line-through' : ''} />
        </dd>
        <dt>
          {T.commission}
          {expected}
        </dt>
        <dd className="text-right">
          <Money cents={ledger.commissionCents ? -ledger.commissionCents : 0} />
        </dd>
        <dt className="border-t border-rule pt-1 font-semibold">
          {T.net}
          {expected}
        </dt>
        <dd className="border-t border-rule pt-1 text-right font-semibold">
          <Money
            cents={ledger.netCents}
            className={released ? 'release-amount rounded-slab px-1' : ''}
          />
        </dd>
      </dl>
      <BalanceTrack balance={ledger.balance} released={released} />
    </div>
  )
}

/** Pending → Available as steps, so the balance reads as a progression, not a number. */
function BalanceTrack({
  balance,
  released,
}: {
  balance: SellerLedger['balance']
  released: boolean
}) {
  if (balance === 'reversed') {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="line-through">
          {T.pending} → {T.available}
        </span>
        <StatusPill status="refunded" label={T.reversed} />
      </p>
    )
  }
  const pending = balance === 'pending'
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={T.balanceLabel}>
      <li>
        {pending ? (
          <span aria-current="step">
            <StatusPill status="pending" label={T.pending} />
          </span>
        ) : (
          <span
            className={`text-ink-muted line-through ${released ? 'release-struck' : ''}`}
          >
            {T.pending}
          </span>
        )}
      </li>
      <li aria-hidden="true" className="text-ink-muted">
        →
      </li>
      <li>
        {pending ? (
          <span className="text-ink-muted">{T.available}</span>
        ) : (
          <span
            aria-current="step"
            className={`inline-block ${released ? 'release-pill' : ''}`}
          >
            <StatusPill status="paid" label={T.available} />
          </span>
        )}
      </li>
      {released && (
        <li role="status" className="release-note font-semibold text-state-paid">
          {T.released}
        </li>
      )}
    </ol>
  )
}

function Balance({
  orders,
  released,
  onList,
}: {
  orders: OrderView[]
  released: string | null
  onList: () => void
}) {
  const ledgers = orders.map((o) => shown(o.ledger))
  const live = ledgers.filter((l) => l.balance !== 'reversed')
  const sum = (ls: SellerLedger[], k: 'grossCents' | 'commissionCents' | 'netCents') =>
    ls.reduce((n, l) => n + l[k], 0)
  const pending = live.filter((l) => l.balance === 'pending')
  const available = live.filter((l) => l.balance === 'available')
  const reversed = ledgers.length - live.length

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">{T.balance}</h2>
      {live.length === 0 ? (
        <EmptyState
          title={COPY.empty.balance.title}
          fact={COPY.empty.balance.fact}
          action={{ label: COPY.empty.balance.action, onClick: onList }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <BalanceBox
            // A new key replays the animation for each release.
            key={`pending-${released}`}
            title={T.pendingBox}
            status="pending"
            cents={sum(pending, 'netCents')}
            note={T.notShipped(pending.length)}
            motion={released ? 'release-out' : ''}
          />
          <BalanceBox
            key={`available-${released}`}
            title={T.available}
            status="paid"
            cents={sum(available, 'netCents')}
            note={T.shipped(available.length)}
            motion={released ? 'release-in' : ''}
          />
          <div className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-3 text-sm">
            <p className="font-semibold">{T.allSales}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <dt>{T.grossShort}</dt>
              <dd className="text-right">
                <Money cents={sum(live, 'grossCents')} />
              </dd>
              <dt>{T.commission}</dt>
              <dd className="text-right">
                <Money cents={-sum(live, 'commissionCents')} />
              </dd>
              <dt className="border-t border-rule pt-1 font-semibold">{T.net}</dt>
              <dd className="border-t border-rule pt-1 text-right font-semibold">
                <Money cents={sum(live, 'netCents')} />
              </dd>
            </dl>
            {reversed > 0 && (
              <p className="text-xs text-ink-muted">{T.reversedNote(reversed)}</p>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-ink-muted">{T.noPayouts}</p>
    </section>
  )
}

function BalanceBox({
  title,
  status,
  cents,
  note,
  motion,
}: {
  title: string
  status: 'pending' | 'paid'
  cents: number
  note: string
  motion: string
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-slab border border-rule bg-paper p-3">
      <StatusPill status={status} label={title} />
      <Money cents={cents} className={`text-2xl font-bold ${motion}`} />
      <p className="text-xs text-ink-muted">{note}</p>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { useListings } from '../lib/listings.ts'
import { Link, navigate } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { OrderView, PersonaId, SellerLedger } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Money } from '../ui/Money.tsx'
import { Notice } from '../ui/Notice.tsx'
import { StatusPill } from '../ui/StatusPill.tsx'
import { PageLayout } from './Layout.tsx'

// ponytail: local strings pending product adding them to COPY (see handback).
const T = {
  title: 'Selling',
  adminOnly: 'Selling is for collector accounts',
  adminFact: 'Switch to Alex or Mike to list items and ship sales.',
  listings: 'Your listings',
  newListing: 'Create a listing',
  sales: 'Your sales',
  balance: 'Balance',
  loadFailed: "We couldn't load your sales.",
  loadFailedFact: 'Nothing has changed. Check your connection and try again.',
  retry: 'Try again',
  noPayouts: 'Payouts to PayPal or a bank are not part of this demo.',
}

const personaName = (id: string) => PERSONAS.find((p) => p.id === id)?.name ?? id
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

// Contract: a reversed sale shows commission and net as 0, whatever the server sent.
const shown = (l: SellerLedger) =>
  l.balance === 'reversed' ? { ...l, commissionCents: 0, netCents: 0 } : l

export default function Sell() {
  const persona = usePersona()
  const listings = useListings().filter((l) => l.sellerId === persona)
  const [orders, setOrders] = useState<OrderView[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (persona === 'admin') return
    let live = true
    setOrders(null)
    setLoadError(false)
    api
      .orders({ seller: persona })
      .then((r) => live && setOrders(r.orders))
      .catch(() => live && setLoadError(true))
    return () => {
      live = false
    }
  }, [persona, reload])

  if (persona === 'admin') {
    return (
      <PageLayout title={T.title}>
        <Notice tone="info" title={T.adminOnly} body={T.adminFact} />
      </PageLayout>
    )
  }

  const toNew = { label: COPY.empty.sales.action, onClick: () => navigate('/sell/new') }

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
              action={{ label: T.retry, onClick: () => setReload((n) => n + 1) }}
            />
          ) : orders === null ? (
            <p className="text-sm text-ink-muted" role="status">
              Loading sales…
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
                  onChange={(next) =>
                    setOrders((all) =>
                      all!.map((x) => (x.paymentId === next.paymentId ? next : x)),
                    )
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {orders && !loadError && <Balance orders={orders} onList={toNew.onClick} />}
      </div>
    </PageLayout>
  )
}

function Sale({
  order,
  sellerId,
  onChange,
}: {
  order: OrderView
  sellerId: PersonaId
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
          Bought by {personaName(order.buyerId)} · {date(order.createdAt)}
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
              {busy ? 'Saving…' : COPY.orderActions.ship}
            </Button>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm font-medium text-state-failed">
            {COPY.postPayment.actionDidNotSave}
          </p>
        )}
      </div>
      <Ledger ledger={shown(order.ledger)} />
    </li>
  )
}

const STEPS = ['pending', 'available'] as const

function Ledger({ ledger }: { ledger: SellerLedger }) {
  const expected = ledger.balance === 'pending' ? ' (expected)' : ''
  const reversed = ledger.balance === 'reversed'
  return (
    <div className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-3">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>Gross (items + shipping)</dt>
        <dd className="text-right">
          <Money cents={ledger.grossCents} className={reversed ? 'line-through' : ''} />
        </dd>
        <dt>Commission{expected}</dt>
        <dd className="text-right">
          <Money cents={ledger.commissionCents ? -ledger.commissionCents : 0} />
        </dd>
        <dt className="border-t border-rule pt-1 font-semibold">Net{expected}</dt>
        <dd className="border-t border-rule pt-1 text-right font-semibold">
          <Money cents={ledger.netCents} />
        </dd>
      </dl>
      <BalanceTrack balance={ledger.balance} />
    </div>
  )
}

/** Pending → Available as steps, so the balance reads as a progression, not a number. */
function BalanceTrack({ balance }: { balance: SellerLedger['balance'] }) {
  if (balance === 'reversed') {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="line-through">Pending → Available</span>
        <StatusPill status="refunded" label="Reversed" />
      </p>
    )
  }
  const at = STEPS.indexOf(balance)
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Balance">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-ink-muted">
              →
            </span>
          )}
          {i === at ? (
            <span aria-current="step">
              <StatusPill
                status={s === 'pending' ? 'pending' : 'paid'}
                label={s === 'pending' ? 'Pending' : 'Available'}
              />
            </span>
          ) : (
            <span className={i < at ? 'text-ink-muted line-through' : 'text-ink-muted'}>
              {s === 'pending' ? 'Pending' : 'Available'}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function Balance({ orders, onList }: { orders: OrderView[]; onList: () => void }) {
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
            title="Pending (expected)"
            status="pending"
            cents={sum(pending, 'netCents')}
            note={`${pending.length} sale${pending.length === 1 ? '' : 's'} not shipped yet`}
          />
          <BalanceBox
            title="Available"
            status="paid"
            cents={sum(available, 'netCents')}
            note={`${available.length} shipped sale${available.length === 1 ? '' : 's'}`}
          />
          <div className="flex flex-col gap-2 rounded-slab border border-rule bg-paper p-3 text-sm">
            <p className="font-semibold">All sales</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <dt>Gross</dt>
              <dd className="text-right">
                <Money cents={sum(live, 'grossCents')} />
              </dd>
              <dt>Commission</dt>
              <dd className="text-right">
                <Money cents={-sum(live, 'commissionCents')} />
              </dd>
              <dt className="border-t border-rule pt-1 font-semibold">Net</dt>
              <dd className="border-t border-rule pt-1 text-right font-semibold">
                <Money cents={sum(live, 'netCents')} />
              </dd>
            </dl>
            {reversed > 0 && (
              <p className="text-xs text-ink-muted">
                {reversed} refunded sale{reversed === 1 ? '' : 's'} reversed, not counted.
              </p>
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
}: {
  title: string
  status: 'pending' | 'paid'
  cents: number
  note: string
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-slab border border-rule bg-paper p-3">
      <StatusPill status={status} label={title} />
      <Money cents={cents} className="text-2xl font-bold" />
      <p className="text-xs text-ink-muted">{note}</p>
    </div>
  )
}

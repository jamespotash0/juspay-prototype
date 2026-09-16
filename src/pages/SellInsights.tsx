import { useEffect, useRef, useState } from 'react'
import { INSIGHTS_COPY as T } from '../shared/copy.insights.ts'
import type { SellerLedger } from '../shared/types.ts'
import { Card } from '../ui/Card.tsx'
import { Money } from '../ui/Money.tsx'
import { usd } from '../ui/format.ts'

/** One sale as the page already shows it: `ledger` is the per-sale ledger after the reversed-shows-0 rule. */
export interface InsightSale {
  createdAt: string
  ledger: SellerLedger
}

const DAY = 86_400_000
/** Past this many days the chart groups by week, so columns stay readable. */
const WEEKLY_AFTER = 42
/** A short or single-day history still gets a two-week axis, so one sale isn't one fat column. */
const MIN_DAYS = 14

const sum = (ls: SellerLedger[], k: keyof Omit<SellerLedger, 'balance'>) =>
  ls.reduce((n, l) => n + l[k], 0)

/** Local midnight, so a sale lands on the day the seller saw it. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const dayLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function SellInsights({ sales }: { sales: InsightSale[] }) {
  if (sales.length === 0) return null // Sell.tsx shows the sales empty state.
  const ledgers = sales.map((s) => s.ledger)
  const live = ledgers.filter((l) => l.balance !== 'reversed')
  const reversed = ledgers.filter((l) => l.balance === 'reversed')
  const available = live.filter((l) => l.balance === 'available')
  const pending = live.filter((l) => l.balance === 'pending')

  return (
    <Card as="section" className="flex flex-col gap-5" aria-labelledby="insights-title">
      <div className="flex flex-col gap-1">
        <h2 id="insights-title" className="text-lg font-bold tracking-tight">
          {T.title}
        </h2>
        <p className="max-w-[65ch] text-sm text-ink-muted">{T.lead}</p>
      </div>

      <div className="grid gap-x-10 gap-y-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col text-sm">
          <dl className="grid grid-cols-[1fr_auto] [&>:nth-child(-n+2)]:border-t-0 [&>:nth-child(-n+2)]:pt-0">
            <Row
              label={T.gross}
              note={T.sales(ledgers.length)}
              cents={sum(ledgers, 'grossCents')}
            />
            <Row
              label={T.reversed}
              note={T.refundedSales(reversed.length)}
              cents={-sum(reversed, 'grossCents')}
            />
            <Row
              label={T.commission}
              note={T.commissionNote}
              cents={-sum(live, 'commissionCents')}
            />
            <Row
              label={T.net}
              note={T.sales(live.length)}
              cents={sum(live, 'netCents')}
              strong
            />
          </dl>
          <dl className="grid grid-cols-[1fr_auto]">
            <Row
              label={T.available}
              note={T.shippedSales(available.length)}
              cents={sum(available, 'netCents')}
              swatch="bg-state-paid"
            />
            <Row
              label={T.pending}
              note={T.unshippedSales(pending.length)}
              cents={sum(pending, 'netCents')}
              swatch="bg-chart-pending"
            />
          </dl>
        </div>
        <NetChart sales={sales} />
      </div>
    </Card>
  )
}

function Row({
  label,
  note,
  cents,
  strong,
  swatch,
}: {
  label: string
  note: string
  cents: number
  strong?: boolean
  swatch?: string
}) {
  const weight = strong ? 'font-semibold' : ''
  return (
    <>
      <dt className={`border-t border-rule py-2.5 ${weight}`}>
        <span className="flex items-center gap-2">
          {swatch && (
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${swatch}`}
            />
          )}
          {label}
        </span>
        <span className="block text-xs font-normal text-ink-muted">{note}</span>
      </dt>
      <dd className={`money border-t border-rule py-2.5 pl-4 text-right ${weight}`}>
        <Money cents={cents} />
      </dd>
    </>
  )
}

interface Bucket {
  start: Date
  available: number
  pending: number
  count: number
  refunded: number
}

function buckets(sales: InsightSale[]): { week: boolean; list: Bucket[] } {
  const times = sales.map((s) => startOfDay(new Date(s.createdAt)).getTime())
  const today = startOfDay(new Date()).getTime()
  const last = Math.max(today, ...times)
  const first = Math.min(
    startOfDay(new Date(last - (MIN_DAYS - 1) * DAY)).getTime(),
    ...times,
  )
  const week = Math.round((last - first) / DAY) + 1 > WEEKLY_AFTER
  // Weeks start on Sunday, the US calendar convention.
  const keyOf = (t: number) => {
    const d = new Date(t)
    return week
      ? startOfDay(
          new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()),
        ).getTime()
      : t
  }
  const map = new Map<number, Bucket>()
  // Step by calendar date, not 24h, so daylight-saving days don't skip or double.
  for (
    let d = new Date(keyOf(first));
    d.getTime() <= last;
    d.setDate(d.getDate() + (week ? 7 : 1))
  )
    map.set(d.getTime(), {
      start: new Date(d),
      available: 0,
      pending: 0,
      count: 0,
      refunded: 0,
    })
  sales.forEach((s, i) => {
    const b = map.get(keyOf(times[i]))!
    const { balance, netCents } = s.ledger
    if (balance === 'reversed') b.refunded++
    else {
      b.count++
      b[balance] += netCents
    }
  })
  return { week, list: [...map.values()] }
}

/** Round the top of the scale up to 1, 2, 2.5 or 5 × 10ⁿ dollars, in three steps. */
function niceTop(maxCents: number) {
  const raw = Math.max(maxCents, 100) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  return { step, top: step * 3 }
}

const axisUsd = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

/** A column with a 4px rounded data end and a square base. */
function column(x: number, y: number, w: number, h: number, round: boolean) {
  const r = round ? Math.min(4, w / 2, h) : 0
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function NetChart({ sales }: { sales: InsightSale[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { week, list } = buckets(sales)
  const totals = list.map((b) => b.available + b.pending)
  const { step, top } = niceTop(Math.max(...totals))
  const net = totals.reduce((a, b) => a + b, 0)
  const count = list.reduce((n, b) => n + b.count + b.refunded, 0)
  const periodLabel = (b: Bucket) =>
    week ? T.weekOf(dayLabel(b.start)) : dayLabel(b.start)

  const H = 180
  const left = 52
  const bottom = 24
  const plotW = Math.max(width - left, 0)
  const plotH = H - bottom - 18 // headroom for the peak label
  const slot = plotW / list.length
  const barW = Math.max(Math.min(24, slot * 0.7), 2)
  const y = (c: number) => 18 + plotH - (c / top) * plotH
  const peak = totals.indexOf(Math.max(...totals))
  // First, last and every nth label, so dates never collide at 390px.
  const every = Math.ceil(list.length / Math.max(Math.floor(plotW / 64), 2))

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{T.chartTitle(week)}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <Key swatch="bg-state-paid" label={T.available} />
          <Key swatch="bg-chart-pending" label={T.pending} />
        </span>
      </figcaption>
      <div ref={ref} className="w-full">
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={T.chartSummary(
              usd(net),
              count,
              periodLabel(list[0]),
              periodLabel(list[list.length - 1]),
            )}
          >
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1={left}
                  x2={width}
                  y1={y(step * i)}
                  y2={y(step * i)}
                  className="stroke-rule"
                  strokeWidth={1}
                />
                <text
                  x={left - 8}
                  y={y(step * i)}
                  dy="0.32em"
                  textAnchor="end"
                  className="money fill-ink-muted text-[11px]"
                >
                  {axisUsd(step * i)}
                </text>
              </g>
            ))}
            {list.map((b, i) => {
              const x = left + slot * i + (slot - barW) / 2
              const hA = (b.available / top) * plotH
              const hP = (b.pending / top) * plotH
              const gap = hA > 0 && hP > 0 ? 2 : 0
              const showDate =
                i === 0 ||
                i === list.length - 1 ||
                (i % every === 0 && list.length - 1 - i >= every)
              return (
                <g key={b.start.getTime()}>
                  <title>
                    {`${periodLabel(b)}: ${usd(b.available + b.pending)} net · ${T.sales(b.count)}${b.refunded ? ` · ${T.refundedSales(b.refunded)}` : ''}`}
                  </title>
                  <rect
                    x={left + slot * i}
                    y={0}
                    width={slot}
                    height={H - bottom}
                    fill="transparent"
                  />
                  {hA > 0 && (
                    <path
                      d={column(x, y(b.available), barW, hA, hP === 0)}
                      className="fill-state-paid"
                    />
                  )}
                  {hP > 0 && (
                    <path
                      d={column(x, y(b.available + b.pending), barW, hP - gap, true)}
                      className="fill-chart-pending"
                    />
                  )}
                  {i === peak && totals[i] > 0 && (
                    <text
                      x={i > list.length / 2 ? x + barW : x + barW / 2}
                      y={y(totals[i]) - 6}
                      textAnchor={i > list.length / 2 ? 'end' : 'middle'}
                      className="money fill-ink text-[11px] font-semibold"
                    >
                      {usd(totals[i])}
                    </text>
                  )}
                  {showDate && (
                    <text
                      x={x + barW / 2}
                      y={H - 6}
                      textAnchor={
                        i === 0 ? 'start' : i === list.length - 1 ? 'end' : 'middle'
                      }
                      className="money fill-ink-muted text-[11px]"
                    >
                      {dayLabel(b.start)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        {T.chartSummary(
          usd(net),
          count,
          periodLabel(list[0]),
          periodLabel(list[list.length - 1]),
        )}
      </p>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-accent hover:underline">
          {T.showTable}
        </summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-ink-muted">
            <tr className="border-b border-rule">
              <th className="py-1.5 font-medium">{T.period(week)}</th>
              <th className="py-1.5 text-right font-medium">{T.available}</th>
              <th className="py-1.5 text-right font-medium">{T.pending}</th>
              <th className="py-1.5 text-right font-medium">{T.refunded}</th>
            </tr>
          </thead>
          <tbody className="money">
            {list
              .filter((b) => b.count + b.refunded > 0)
              .map((b) => (
                <tr
                  key={b.start.getTime()}
                  className="border-b border-rule last:border-b-0"
                >
                  <td className="py-1.5">{dayLabel(b.start)}</td>
                  <td className="py-1.5 text-right">
                    <Money cents={b.available} />
                  </td>
                  <td className="py-1.5 text-right">
                    <Money cents={b.pending} />
                  </td>
                  <td className="py-1.5 text-right">{b.refunded}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function Key({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-full ${swatch}`} />
      {label}
    </span>
  )
}

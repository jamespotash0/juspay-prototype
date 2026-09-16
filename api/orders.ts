import { META, type OrdersResponse, type PaymentState } from '../src/shared/types.js'
import { hsFetch } from './_lib/hyperswitch.js'
import { jsonError, toOrderView, type HsPayment } from './_lib/orderView.js'

/** A checkout that never became an order: hidden from buyer and seller lists (W1 decision 3). */
const NOT_AN_ORDER: PaymentState[] = [
  'awaiting_payment',
  'failed',
  'cancelled',
  'unknown',
]
const PAGE = 100
const MAX_PAGES = 20
/** A reviewer opens the demo weeks after the last test run; 90 days keeps its orders, and nothing new is created meanwhile. */
const WINDOW_DAYS = 90

/** GET /api/orders?buyer=<PersonaId> | ?seller=<sellerId> | ?all=1 → OrdersResponse, newest first. */
export async function GET(request: Request): Promise<Response> {
  try {
    const q = new URL(request.url).searchParams
    const buyer = q.get('buyer')
    const seller = q.get('seller')
    const all = q.get('all') === '1'
    if (!buyer && !seller && !all)
      return jsonError(400, 'BAD_REQUEST', 'Pass buyer, seller or all=1')

    // Paging, as probed on the sandbox 2026-09-16: `ending_before=<last id>` walks to OLDER payments and
    // repeats that id as its first row; `starting_after` returns page one again, so paging on it read the
    // newest 100 twenty times (7-11 s) and never reached older orders. `created.gte` needs a Z timestamp.
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
    const byId = new Map<string, HsPayment>()
    let before = ''
    for (let i = 0; i < MAX_PAGES; i++) {
      const path = `/payments/list?limit=${PAGE}&created.gte=${encodeURIComponent(since)}${before ? `&ending_before=${encodeURIComponent(before)}` : ''}`
      // One retry: the sandbox list call fails transiently, and one bad page used to 502 the whole view.
      let page = await hsFetch<{ data: HsPayment[] }>(path)
      if (!page.ok) page = await hsFetch<{ data: HsPayment[] }>(path)
      if (!page.ok) return jsonError(502, 'UPSTREAM', 'Could not load orders')
      for (const p of page.data.data) byId.set(p.payment_id, p)
      if (page.data.data.length < PAGE) break
      before = page.data.data[PAGE - 1].payment_id
    }
    const payments = [...byId.values()]

    // ponytail: last WINDOW_DAYS of payments, at most MAX_PAGES x PAGE, filtered in memory (Hyperswitch v1
    // cannot filter on metadata). An order older than 90 days, or behind 2,000 newer payments, drops off the
    // lists. Upgrade: a Vercel KV index of sellerId / buyerId -> [payment_id] (ids only, never amounts),
    // then fetch just those payments.
    const mine = payments.filter((p) => {
      const m = p.metadata ?? {}
      if (!m[META.sellerId] || m[META.source] !== 'app') return false
      if (buyer) return m[META.buyerId] === buyer
      if (seller) return m[META.sellerId] === seller
      return true
    })

    // Wrapped: .map would pass the index as toOrderView's second (refunds) argument.
    const views = await Promise.all(mine.map((p) => toOrderView(p)))
    const orders = views
      .filter((o) => all || !NOT_AN_ORDER.includes(o.state))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return Response.json({ orders } satisfies OrdersResponse)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong loading orders')
  }
}

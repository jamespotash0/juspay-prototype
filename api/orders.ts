import { META, type OrdersResponse, type PaymentState } from '../src/shared/types.ts'
import { hsFetch } from './_lib/hyperswitch.ts'
import { jsonError, toOrderView, type HsPayment } from './_lib/orderView.ts'

/** A checkout that never became an order: hidden from buyer and seller lists (W1 decision 3). */
const NOT_AN_ORDER: PaymentState[] = [
  'awaiting_payment',
  'failed',
  'cancelled',
  'unknown',
]
const PAGE = 100
const MAX_PAGES = 20

/** GET /api/orders?buyer=<PersonaId> | ?seller=<sellerId> | ?all=1 → OrdersResponse, newest first. */
export async function GET(request: Request): Promise<Response> {
  try {
    const q = new URL(request.url).searchParams
    const buyer = q.get('buyer')
    const seller = q.get('seller')
    const all = q.get('all') === '1'
    if (!buyer && !seller && !all)
      return jsonError(400, 'BAD_REQUEST', 'Pass buyer, seller or all=1')

    const payments: HsPayment[] = []
    let after = ''
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await hsFetch<{ data: HsPayment[] }>(
        `/payments/list?limit=${PAGE}${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`,
      )
      if (!page.ok) return jsonError(502, 'UPSTREAM', 'Could not load orders')
      payments.push(...page.data.data)
      if (page.data.data.length < PAGE) break
      after = page.data.data[PAGE - 1].payment_id
    }

    // ponytail: fetch-all-then-filter — Hyperswitch v1 cannot filter on metadata. Fine at demo volume, O(all payments) per view beyond it. Upgrade: Vercel KV storing sellerId -> [payment_id] only, never amounts.
    const mine = payments.filter((p) => {
      const m = p.metadata ?? {}
      if (!m[META.sellerId] || m[META.source] !== 'app') return false
      if (buyer) return m[META.buyerId] === buyer
      if (seller) return m[META.sellerId] === seller
      return true
    })

    const views = await Promise.all(mine.map(toOrderView))
    const orders = views
      .filter((o) => all || !NOT_AN_ORDER.includes(o.state))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return Response.json({ orders } satisfies OrdersResponse)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong loading orders')
  }
}

import {
  META,
  type Fulfilment,
  type OrderAction,
  type OrderStateRequest,
} from '../src/shared/types.js'
import { hsFetch, isMetadataPropagationError } from './_lib/hyperswitch.js'
import {
  jsonError,
  ORDER_ID,
  findOrder,
  sellerKey,
  toOrderViews,
  type HsPayment,
} from './_lib/orderView.js'

/** Who may do what, from which fulfilment state (engineering.md §3). */
const RULES: Record<
  OrderAction,
  { actor: 'sellerId' | 'buyerId'; from: Fulfilment[]; to: Fulfilment; stamp: string }
> = {
  ship: { actor: 'sellerId', from: ['unshipped'], to: 'shipped', stamp: META.shippedAt },
  receive: {
    actor: 'buyerId',
    from: ['shipped'],
    to: 'received',
    stamp: META.receivedAt,
  },
  dispute: {
    actor: 'buyerId',
    from: ['shipped', 'received'],
    to: 'disputed',
    stamp: META.disputedAt,
  },
}

/** POST /api/order-state — records ship / receive / dispute for one seller's order, in the payment's metadata. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await orderState(request)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong updating the order')
  }
}

async function orderState(request: Request): Promise<Response> {
  const body = (await request
    .json()
    .catch(() => null)) as Partial<OrderStateRequest> | null
  const { paymentId, action, actorId, reason } = body ?? {}
  if (typeof paymentId !== 'string' || !ORDER_ID.test(paymentId))
    return jsonError(400, 'BAD_REQUEST', 'Invalid order id')
  if (typeof action !== 'string' || !Object.hasOwn(RULES, action))
    return jsonError(400, 'BAD_REQUEST', 'Unknown action')
  const rule = RULES[action]

  const found = await findOrder(paymentId)
  if (found instanceof Response) return found
  const current = found.order

  if (!actorId || current[rule.actor] !== actorId)
    return jsonError(403, 'FORBIDDEN', 'You are not allowed to do that on this order')
  if (
    current.state !== 'paid' ||
    !rule.from.includes(current.fulfilment) ||
    (action === 'dispute' && current.refund.state === 'succeeded')
  )
    return jsonError(
      409,
      'INVALID_TRANSITION',
      `This order can't be marked ${rule.to} now`,
    )

  // Only this seller's changed keys: the merge is shallow, so other sellers' keys survive.
  // A legacy payment has no `sellers` key and keeps its bare keys.
  const hsId = current.paymentId
  const key = (k: string) => sellerKey(found.payment.metadata ?? {}, current.sellerId, k)
  const metadata: Record<string, string> = {
    [key(META.fulfilment)]: rule.to,
    [key(rule.stamp)]: new Date().toISOString(),
  }
  if (action === 'dispute')
    metadata[key(META.disputeReason)] = (typeof reason === 'string' ? reason : '')
      .trim()
      .slice(0, 300)

  const write = await hsFetch(`/payments/${hsId}/update_metadata`, {
    method: 'POST',
    body: JSON.stringify({ metadata }),
  })
  // paypal_test reports IR_20 after the write has already landed; the read-back below decides.
  if (!write.ok && !isMetadataPropagationError(write)) {
    console.error(
      `[order-state] ${paymentId} ${action} failed`,
      write.status,
      write.hsCode,
    )
    return jsonError(502, 'UPSTREAM', "We couldn't update the order. Nothing changed.")
  }

  const fresh = await hsFetch<HsPayment>(`/payments/${hsId}`)
  if (!fresh.ok || fresh.data.metadata?.[key(META.fulfilment)] !== rule.to)
    return jsonError(
      502,
      'NOT_SAVED',
      "We couldn't confirm the update was saved. Try again.",
    )
  const views = await toOrderViews(fresh.data)
  return Response.json(views.find((v) => v.sellerId === current.sellerId))
}

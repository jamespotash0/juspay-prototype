import { ISSUES, issueBlock } from '../src/shared/orderState.js'
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
  {
    actor: 'sellerId' | 'buyerId'
    from: Fulfilment[]
    /** null: the fulfilment stays where it is. */
    to: Fulfilment | null
    stamp: string
  }
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
    // Before shipping too: a seller who never ships is the first thing a buyer reports.
    from: ['unshipped', 'shipped', 'received'],
    to: 'disputed',
    stamp: META.disputedAt,
  },
  // A question to the seller is not a refund request, so nothing moves.
  ask: {
    actor: 'buyerId',
    from: ['unshipped', 'shipped', 'received'],
    to: null,
    stamp: META.askedAt,
  },
}

/** POST /api/order-state — records ship / receive / dispute / ask for one seller's order, in the payment's metadata. */
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
  const { paymentId, action, actorId, reason, issue } = body ?? {}
  if (typeof paymentId !== 'string' || !ORDER_ID.test(paymentId))
    return jsonError(400, 'BAD_REQUEST', 'Invalid order id')
  if (typeof action !== 'string' || !Object.hasOwn(RULES, action))
    return jsonError(400, 'BAD_REQUEST', 'Unknown action')
  const rule = RULES[action]
  const text = (typeof reason === 'string' ? reason : '').trim().slice(0, 300)
  if (action === 'dispute' && (!ISSUES.includes(issue!) || issue === 'question'))
    return jsonError(400, 'BAD_REQUEST', 'Pick what the problem is')
  if (action === 'ask' && !text)
    return jsonError(400, 'BAD_REQUEST', 'Write your question for the seller')

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
      "This order can't be changed that way now",
    )
  // The same rule the menu greys out with: e.g. no return on an item sold as ineligible.
  if (action === 'dispute' && issueBlock(current, issue!))
    return jsonError(
      409,
      'ISSUE_NOT_ALLOWED',
      "That option isn't available on this order",
    )

  // Only this seller's changed keys: the merge is shallow, so other sellers' keys survive.
  // A legacy payment has no `sellers` key and keeps its bare keys.
  const hsId = current.paymentId
  const key = (k: string) => sellerKey(found.payment.metadata ?? {}, current.sellerId, k)
  const stamp = new Date().toISOString()
  const metadata: Record<string, string> = { [key(rule.stamp)]: stamp }
  if (rule.to) metadata[key(META.fulfilment)] = rule.to
  if (action === 'dispute') {
    metadata[key(META.disputeReason)] = text
    metadata[key(META.issue)] = issue!
  }
  if (action === 'ask') metadata[key(META.question)] = text

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
  // The stamp is unique to this write, so it proves this write landed (ask doesn't move fulfilment).
  if (!fresh.ok || fresh.data.metadata?.[key(rule.stamp)] !== stamp)
    return jsonError(
      502,
      'NOT_SAVED',
      "We couldn't confirm the update was saved. Try again.",
    )
  const views = await toOrderViews(fresh.data)
  return Response.json(views.find((v) => v.sellerId === current.sellerId))
}

import type { RefundRequest } from '../src/shared/types.js'
import { hsFetch } from './_lib/hyperswitch.js'
import {
  findOrder,
  jsonError,
  ORDER_ID,
  readOrder,
  refundPrefix,
} from './_lib/orderView.js'

/** POST /api/refund — admin only, refunds one seller's order in full. Returns the re-read OrderView. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await refund(request)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong refunding the payment')
  }
}

async function refund(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<RefundRequest> | null
  const { paymentId: id, actorId, reason } = body ?? {}
  if (typeof id !== 'string' || !ORDER_ID.test(id))
    return jsonError(400, 'BAD_REQUEST', 'Invalid order id')
  if (actorId !== 'admin') return jsonError(403, 'FORBIDDEN', 'Only an admin can refund')

  const found = await findOrder(id)
  if (found instanceof Response) return found
  const { order } = found
  if (order.state !== 'paid')
    return jsonError(409, 'INVALID_TRANSITION', 'Only a paid order can be refunded')

  // Refunds are full per seller (product decision): this seller's whole share, and nobody else's.
  // A refund already done or still in flight means there is nothing to send.
  if (order.refund.state === 'succeeded')
    return jsonError(409, 'ALREADY_REFUNDED', 'This order has already been refunded')
  if (order.refund.state === 'pending')
    return jsonError(
      409,
      'REFUND_PENDING',
      'A refund for this order is already in progress',
    )
  const amount = order.breakdown.totalCents

  // Idempotency key: the seller's prefix plus the attempt number. A double-click or retransmission
  // reads the same refund list, so it sends the same id and Hyperswitch dedupes it (HE_01). Only a
  // failed refund moves the count on, allowing a retry. Hyperswitch caps refund_id at 30 chars (ours: 27).
  // ponytail: one retry after a failed refund; a second identical failure dedupes to the first.
  // Add a refund attempt count to OrderView if admins need repeated retries.
  const attempt = order.refund.state === 'failed' ? 2 : 1
  const refundId = refundPrefix(order.paymentId, order.sellerId) + attempt

  const created = await hsFetch('/refunds', {
    method: 'POST',
    body: JSON.stringify({
      payment_id: order.paymentId,
      refund_id: refundId,
      amount,
      reason:
        (typeof reason === 'string' && reason.trim().slice(0, 255)) || 'Dispute resolved',
    }),
  })
  // A duplicate refund_id means this exact refund already exists — fall through to the re-read.
  // A refund the connector declines still exists with status failed, and reads back as refund.state 'failed'.
  if (!created.ok && created.hsCode !== 'HE_01') {
    console.error(`[refund] ${order.orderId} failed`, created.status, created.hsCode)
    return jsonError(
      502,
      'UPSTREAM',
      "The refund couldn't be started. Nothing was refunded.",
    )
  }

  const fresh = await readOrder(order.orderId)
  return fresh instanceof Response ? fresh : Response.json(fresh)
}

import { createHash } from 'node:crypto'
import type { RefundRequest } from '../src/shared/types.ts'
import { hsFetch } from './_lib/hyperswitch.ts'
import { jsonError, PAYMENT_ID, readOrder } from './_lib/orderView.ts'

/** POST /api/refund — admin only, full or partial. Returns the re-read OrderView. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await refund(request)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong refunding the payment')
  }
}

async function refund(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<RefundRequest> | null
  const { paymentId, actorId, amountCents, reason } = body ?? {}
  if (typeof paymentId !== 'string' || !PAYMENT_ID.test(paymentId))
    return jsonError(400, 'BAD_REQUEST', 'Invalid payment id')
  if (actorId !== 'admin') return jsonError(403, 'FORBIDDEN', 'Only an admin can refund')

  const order = await readOrder(paymentId)
  if (order instanceof Response) return order
  if (order.state !== 'paid')
    return jsonError(409, 'INVALID_TRANSITION', 'Only a paid order can be refunded')

  const remaining = order.breakdown.totalCents - order.refund.refundedCents
  const amount = amountCents ?? remaining
  if (!Number.isInteger(amount) || amount <= 0 || amount > remaining)
    return jsonError(
      400,
      'INVALID_AMOUNT',
      'Refund amount must be more than $0 and no more than what is left',
    )

  // Idempotency key: same payment + same amount + same refunded-so-far = same refund, so a
  // double-click or retransmission can't refund twice. Hyperswitch caps refund_id at 30 chars.
  // ponytail: refund.state in the key allows one retry after a failed refund; a second identical
  // failure dedupes to the first. Add a refund count to OrderView if admins need repeated retries.
  const refundId =
    'ckr_' +
    createHash('sha256')
      .update(
        `${paymentId}:${amount}:${order.refund.refundedCents}:${order.refund.state}`,
      )
      .digest('hex')
      .slice(0, 22)

  const created = await hsFetch('/refunds', {
    method: 'POST',
    body: JSON.stringify({
      payment_id: paymentId,
      refund_id: refundId,
      amount,
      reason:
        (typeof reason === 'string' && reason.trim().slice(0, 255)) || 'Dispute resolved',
    }),
  })
  // A duplicate refund_id means this exact refund already exists — fall through to the re-read.
  // A refund the connector declines still exists with status failed, and reads back as refund.state 'failed'.
  if (!created.ok && created.hsCode !== 'HE_01') {
    console.error(`[refund] ${paymentId} failed`, created.status, created.hsCode)
    return jsonError(
      502,
      'UPSTREAM',
      "The refund couldn't be started. Nothing was refunded.",
    )
  }

  const fresh = await readOrder(paymentId)
  return fresh instanceof Response ? fresh : Response.json(fresh)
}

import type { Fulfilment, OrderView, PaymentState, RefundState } from './types.js'

/** Hyperswitch v1 IntentStatus → our PaymentState. See plan/engineering.md §4. */
const MAP: Record<string, PaymentState> = {
  requires_payment_method: 'awaiting_payment',
  requires_confirmation: 'awaiting_payment',
  requires_customer_action: 'action_required',
  processing: 'pending',
  succeeded: 'paid', // also when fully refunded — refund state is read separately
  failed: 'failed',
  expired: 'failed',
  cancelled: 'cancelled',
  cancelled_post_capture: 'refunded',
  requires_capture: 'authorized_unexpected',
  partially_captured: 'paid_partial',
  partially_captured_and_capturable: 'paid_partial',
  partially_authorized_and_requires_capture: 'paid_partial',
  partially_captured_and_processing: 'paid_partial',
  requires_merchant_action: 'review',
  review: 'review',
  conflicted: 'review',
}

export function mapStatus(hsStatus: string): PaymentState {
  return Object.hasOwn(MAP, hsStatus) ? MAP[hsStatus] : 'unknown'
}

/** The one status an order shows: a refund outranks shipping, and shipping only means something once paid. */
export function latestStatus(
  o: Pick<OrderView, 'state' | 'fulfilment' | 'refund'>,
): PaymentState | Fulfilment | RefundState {
  if (o.refund.state !== 'none') return o.refund.state
  return o.state === 'paid' ? o.fulfilment : o.state
}

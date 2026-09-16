import { expect, it } from 'vitest'
import { mapStatus } from '../../src/shared/orderState.ts'

// plan/engineering.md §4 — all 17 Hyperswitch IntentStatus values.
const TABLE = {
  requires_payment_method: 'awaiting_payment',
  requires_confirmation: 'awaiting_payment',
  requires_customer_action: 'action_required',
  processing: 'pending',
  succeeded: 'paid',
  failed: 'failed',
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
  expired: 'failed',
} as const

it('covers 17 statuses', () => expect(Object.keys(TABLE)).toHaveLength(17))

it.each(Object.entries(TABLE))('%s → %s', (hs, ours) => {
  expect(mapStatus(hs)).toBe(ours)
})

it.each(['', 'SUCCEEDED', 'refunded', 'toString', '__proto__'])(
  'unrecognised %j → unknown',
  (s) => expect(mapStatus(s)).toBe('unknown'),
)

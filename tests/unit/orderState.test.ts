import { describe, expect, it } from 'vitest'
import { issueBlock, mapStatus } from '../../src/shared/orderState.ts'
import type { Fulfilment } from '../../src/shared/types.ts'

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

describe('issueBlock', () => {
  const o = (fulfilment: Fulfilment, returnable = true) => ({ fulfilment, returnable })

  it('offers cancel only before shipping', () => {
    expect(issueBlock(o('unshipped'), 'cancel')).toBeNull()
    expect(issueBlock(o('shipped'), 'cancel')).toBe('alreadyShipped')
  })

  it("offers hasn't arrived only while in transit", () => {
    expect(issueBlock(o('unshipped'), 'notArrived')).toBe('notShipped')
    expect(issueBlock(o('shipped'), 'notArrived')).toBeNull()
    expect(issueBlock(o('received'), 'notArrived')).toBe('received')
  })

  it('refuses a return on an ineligible order, but never blocks not as described', () => {
    expect(issueBlock(o('received', false), 'return')).toBe('ineligible')
    expect(issueBlock(o('unshipped', false), 'return')).toBe('ineligible')
    expect(issueBlock(o('received'), 'return')).toBeNull()
    expect(issueBlock(o('received', false), 'notAsDescribed')).toBeNull()
  })

  it('always allows a question', () => {
    for (const f of ['unshipped', 'shipped', 'received'] as Fulfilment[])
      expect(issueBlock(o(f, false), 'question')).toBeNull()
  })
})

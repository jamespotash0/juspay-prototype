import { describe, expect, it } from 'vitest'
import { POST as checkout } from '../../api/checkout.ts'
import { GET as payment } from '../../api/payment.ts'
import { newAttemptId } from '../../src/shared/attempt.ts'
import { COPY } from '../../src/shared/copy.ts'
import { breakdown } from '../../src/shared/money.ts'
import { LISTINGS } from '../../src/shared/seed.ts'
import type { CheckoutResponse, OrderView } from '../../src/shared/types.ts'

// Live Hyperswitch sandbox. vitest.config.ts loads .env into process.env.
const HS = 'https://sandbox.hyperswitch.io'
const KEY = process.env.JUSPAY_API_TEST_KEY
const ORIGIN = 'http://localhost:5190'
const SHIP_TO = {
  name: 'Alex Rivera',
  line1: '1 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
}

// Routing (engineering.md §10): cards with amount >= 50000 cents always go to stripe_test; below
// that, a volume split 80/20 stripe_test/fauxpay. lst_024 is Mike's, total $1,225, so every card
// test on it is deterministic. lst_002 is Mike's too, total $101.12, for the split.
const LISTING = LISTINGS.find((l) => l.id === 'lst_024')!
const SMALL = LISTINGS.find((l) => l.id === 'lst_002')!

const post = (body: unknown) =>
  checkout(
    new Request(`${ORIGIN}/api/checkout`, {
      method: 'POST',
      // Tags the payment source 'test' so it never shows in the demo order lists.
      headers: { 'content-type': 'application/json', 'x-slabbed-source': 'test' },
      body: JSON.stringify(body),
    }),
  )

const order = async (id: string) => {
  const res = await payment(new Request(`${ORIGIN}/api/payment?id=${id}`))
  expect(res.status).toBe(200)
  return (await res.json()) as OrderView
}

async function startCheckout(
  attemptId = newAttemptId(),
  extra: object = {},
  listingId = LISTING.id,
) {
  const res = await post({
    attemptId,
    buyerId: 'alex',
    items: [{ listingId, qty: 1 }],
    shipTo: SHIP_TO,
    ...extra,
  })
  const body = await res.json()
  expect(res.status, JSON.stringify(body)).toBe(200)
  return body as CheckoutResponse
}

/** Server-side confirm: the SDK is browser-only. */
async function confirm(paymentId: string, cardNumber: string, auth = 'no_three_ds') {
  const res = await fetch(`${HS}/payments/${paymentId}/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': KEY! },
    body: JSON.stringify({
      payment_method: 'card',
      payment_method_type: 'credit',
      authentication_type: auth,
      payment_method_data: {
        card: {
          card_number: cardNumber,
          card_exp_month: '12',
          card_exp_year: '2030',
          card_holder_name: 'Alex Rivera',
          card_cvc: '123',
        },
      },
    }),
  })
  return (await res.json()) as {
    status?: string
    error_code?: string | null
    error_message?: string | null
    unified_code?: string | null
    unified_message?: string | null
    connector?: string | null
    next_action?: { type?: string } | null
    error?: { code: string; message: string }
  }
}

describe.skipIf(!KEY)('payment path (live sandbox)', () => {
  it('4242 on a >= $500 order succeeds on stripe_test and reads back as paid', async () => {
    const s = await startCheckout()
    const expected = breakdown([{ listingId: LISTING.id, qty: 1 }], LISTINGS)
    expect(expected.totalCents).toBeGreaterThanOrEqual(50_000)
    expect(s.breakdown).toEqual(expected)
    expect(s.sellerId).toBe('mike')

    const confirmed = await confirm(s.paymentId, '4242424242424242')
    expect(confirmed.status).toBe('succeeded')
    expect(confirmed.connector).toBe('stripe_test')

    const view = await order(s.paymentId)
    expect(view.state).toBe('paid')
    expect(view.connector).toBe('stripe_test')
    expect(view.decline).toBeUndefined()
    expect(view.breakdown).toEqual(expected)
    expect(view.sellerId).toBe('mike')
    expect(view.buyerId).toBe('alex')
    expect(view.listingIds).toEqual([LISTING.id])
    expect(view.fulfilment).toBe('unshipped')
    console.log(`[QA-2] success payment ${s.paymentId}: ${view.state}`)
  })

  it('a duplicate attemptId resumes the same payment', async () => {
    const attemptId = newAttemptId()
    const first = await startCheckout(attemptId)
    const second = await startCheckout(attemptId)
    expect(second.paymentId).toBe(first.paymentId)
    expect(second.clientSecret).toBe(first.clientSecret)

    // Exactly one payment carries this id.
    const res = await fetch(`${HS}/payments/list?customer_id=alex&limit=100`, {
      headers: { 'api-key': KEY! },
    })
    const list = (await res.json()) as { data: { payment_id: string }[] }
    expect(list.data.filter((p) => p.payment_id === attemptId)).toHaveLength(1)
    console.log(
      `[QA-2] duplicate-attempt payment ${attemptId}: left requires_payment_method`,
    )
  })

  it('ignores a client-sent amount', async () => {
    const s = await startCheckout(newAttemptId(), { amount: 1, totalCents: 1 })
    const expected = breakdown([{ listingId: LISTING.id, qty: 1 }], LISTINGS)
    expect(s.breakdown.totalCents).toBe(expected.totalCents)

    const raw = await fetch(`${HS}/payments/${s.paymentId}`, {
      headers: { 'api-key': KEY! },
    })
    expect(((await raw.json()) as { amount: number }).amount).toBe(expected.totalCents)
    console.log(
      `[QA-2] amount-ignored payment ${s.paymentId}: left requires_payment_method`,
    )
  })

  it('refuses buying your own listing with 409 OWN_LISTING', async () => {
    const res = await post({
      attemptId: newAttemptId(),
      buyerId: 'mike',
      items: [{ listingId: LISTING.id, qty: 1 }],
      shipTo: SHIP_TO,
    })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'OWN_LISTING',
    )
  })

  it('rejects an unknown listing id with 400', async () => {
    const res = await post({
      attemptId: newAttemptId(),
      buyerId: 'alex',
      items: [{ listingId: 'lst_nope', qty: 1 }],
      shipTo: SHIP_TO,
    })
    expect(res.status).toBe(400)
  })

  it('rejects items from two sellers with 400', async () => {
    const other = LISTINGS.find(
      (l) => l.sellerId !== LISTING.sellerId && l.sellerId !== 'alex',
    )!
    const res = await post({
      attemptId: newAttemptId(),
      buyerId: 'alex',
      items: [
        { listingId: LISTING.id, qty: 1 },
        { listingId: other.id, qty: 1 },
      ],
      shipTo: SHIP_TO,
    })
    expect(res.status).toBe(400)
  })

  // Probed 2026-09-16 on stripe_test (orders >= $500). Every decline is unified UE_9000, so the
  // reason comes from error_message. 9995 does NOT decline on stripe_test: it succeeds and charges.
  // The soft decline (processing_error, retriable) only reproduces on fauxpay, which routing
  // reaches only for orders < $500, at random. Retriable follows design.md §4.
  it.each([
    ['4000000000000002', 'DC_08', 'Card declined', 'generic', false],
    ['4000000000009987', 'DC_08', 'Lost card', 'lost_or_stolen', false],
    ['4000000000009979', 'DC_08', 'Stolen card', 'lost_or_stolen', false],
    ['4000000000000119', 'DC_04', 'Card not supported', 'generic', false],
  ] as const)(
    '%s declines on stripe_test as failed (%s %s -> %s)',
    async (card, code, rawMessage, reason, retriable) => {
      const s = await startCheckout()
      const c = await confirm(s.paymentId, card)
      expect(c.status, JSON.stringify(c)).toBe('failed')
      expect(c.connector).toBe('stripe_test')
      expect(c.error_code).toBe(code)
      expect(c.error_message).toContain(rawMessage)

      const view = await order(s.paymentId)
      expect(view.state).toBe('failed')
      expect(view.connector).toBe('stripe_test')
      expect(view.decline?.reason).toBe(reason)
      expect(view.decline?.code).toBe(code)
      expect(view.decline?.message).toBe(COPY.decline[reason].message)
      expect(view.decline?.message).not.toContain(rawMessage)
      expect(view.decline?.retriable).toBe(retriable)
      console.log(
        `[QA-4a] decline ${card} ${s.paymentId}: ${c.connector} failed ${c.error_code} -> ${reason} retriable=${retriable}`,
      )
    },
  )

  it('4000000000009995 succeeds on stripe_test (no soft decline there)', async () => {
    const s = await startCheckout()
    const c = await confirm(s.paymentId, '4000000000009995')
    expect([c.status, c.connector]).toEqual(['succeeded', 'stripe_test'])
    const view = await order(s.paymentId)
    expect(view.state).toBe('paid')
    expect(view.decline).toBeUndefined()
    console.log(`[QA-4a] 9995 ${s.paymentId}: ${c.connector} ${c.status}`)
  })

  it('3DS card 4000003800000446 with three_ds needs customer action on stripe_test', async () => {
    const s = await startCheckout()
    const c = await confirm(s.paymentId, '4000003800000446', 'three_ds')
    expect(c.status, JSON.stringify(c)).toBe('requires_customer_action')
    expect(c.connector).toBe('stripe_test')
    expect(c.next_action?.type).toBe('redirect_to_url')
    const view = await order(s.paymentId)
    expect(view.state).toBe('action_required')
    expect(view.connector).toBe('stripe_test')
    expect(view.decline).toBeUndefined()
    console.log(`[QA-4a] 3DS ${s.paymentId}: ${c.connector} ${c.status}`)
  })

  // Only the connector set is asserted: a volume split can land 3/3 on either side.
  it('a < $500 card payment lands on stripe_test or fauxpay, never paypal_test', async () => {
    expect(
      breakdown([{ listingId: SMALL.id, qty: 1 }], LISTINGS).totalCents,
    ).toBeLessThan(50_000)
    for (let i = 0; i < 3; i++) {
      const s = await startCheckout(newAttemptId(), {}, SMALL.id)
      const c = await confirm(s.paymentId, '4242424242424242')
      expect(c.status).toBe('succeeded')
      const view = await order(s.paymentId)
      expect(['stripe_test', 'fauxpay']).toContain(view.connector)
      console.log(`[QA-4a] small 4242 ${s.paymentId}: ${view.connector}`)
    }
  }, 60_000)
})

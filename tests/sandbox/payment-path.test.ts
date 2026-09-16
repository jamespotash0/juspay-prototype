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

// lst_002 is Mike's; Alex buys it.
const LISTING = LISTINGS.find((l) => l.id === 'lst_002')!

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

async function startCheckout(attemptId = newAttemptId(), extra: object = {}) {
  const res = await post({
    attemptId,
    buyerId: 'alex',
    items: [{ listingId: LISTING.id, qty: 1 }],
    shipTo: SHIP_TO,
    ...extra,
  })
  const body = await res.json()
  expect(res.status, JSON.stringify(body)).toBe(200)
  return body as CheckoutResponse
}

/** Server-side confirm: the SDK is browser-only. */
async function confirm(paymentId: string, cardNumber: string) {
  const res = await fetch(`${HS}/payments/${paymentId}/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': KEY! },
    body: JSON.stringify({
      payment_method: 'card',
      payment_method_type: 'credit',
      authentication_type: 'no_three_ds',
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
    error?: { code: string; message: string }
  }
}

describe.skipIf(!KEY)('payment path (live sandbox)', () => {
  it('4242 succeeds and reads back as paid with the server breakdown', async () => {
    const s = await startCheckout()
    const expected = breakdown([{ listingId: LISTING.id, qty: 1 }], LISTINGS)
    expect(s.breakdown).toEqual(expected)
    expect(s.sellerId).toBe('mike')

    const confirmed = await confirm(s.paymentId, '4242424242424242')
    expect(confirmed.status).toBe('succeeded')

    const view = await order(s.paymentId)
    expect(view.state).toBe('paid')
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

  // Probed 2026-09-16 on paypal_test: every one of these declines (status failed, DC_08 or DC_04,
  // unified UE_9000). The reason is only in error_message, so the expected DeclineReason follows
  // what the connector reports, not Stripe's meaning of the card (9995 is processing_error here,
  // not insufficient_funds). Demoing insufficient funds needs a Stripe test connector.
  // Retriable follows design.md §4: soft declines (processing_error) retry, hard ones don't.
  it.each([
    ['4000000000000002', 'Card declined', 'generic', false],
    [
      '4000000000009995',
      'Internal Server Error from Connector',
      'processing_error',
      true,
    ],
    ['4000000000009987', 'Lost card', 'lost_or_stolen', false],
    ['4000000000009979', 'Stolen card', 'lost_or_stolen', false],
    ['4000000000000119', 'Card not supported', 'generic', false],
  ] as const)(
    '%s declines as failed with buyer-safe copy (%s -> %s)',
    async (card, rawMessage, reason, retriable) => {
      const s = await startCheckout()
      const c = await confirm(s.paymentId, card)
      expect(c.status, JSON.stringify(c)).toBe('failed')
      expect(c.error_message).toContain(rawMessage)

      const view = await order(s.paymentId)
      expect(view.state).toBe('failed')
      expect(view.decline?.code).toBe(c.error_code)
      expect(view.decline?.message).toBe(COPY.decline[reason].message)
      expect(view.decline?.message).not.toContain(rawMessage)
      expect(view.decline?.retriable).toBe(retriable)
      console.log(
        `[QA-2] decline ${card} ${s.paymentId}: failed ${c.error_code} ${c.unified_code} -> ${reason} retriable=${view.decline?.retriable}`,
      )
    },
  )
})

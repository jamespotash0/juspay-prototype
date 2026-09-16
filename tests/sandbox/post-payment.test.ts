import { beforeAll, describe, expect, it } from 'vitest'
import { POST as checkout } from '../../api/checkout.ts'
import { POST as orderState } from '../../api/order-state.ts'
import { GET as orders } from '../../api/orders.ts'
import { GET as payment } from '../../api/payment.ts'
import { POST as refund } from '../../api/refund.ts'
import { newAttemptId } from '../../src/shared/attempt.ts'
import { breakdown } from '../../src/shared/money.ts'
import { LISTINGS } from '../../src/shared/seed.ts'
import type {
  CheckoutResponse,
  OrderStateRequest,
  OrderView,
  PersonaId,
  RefundRequest,
} from '../../src/shared/types.ts'

// Live Hyperswitch sandbox. Two payments per run, both tagged source 'test':
// A = ship → receive → full refund. B = ship → dispute → full refund. Refunds are full only.
const HS = 'https://sandbox.hyperswitch.io'
const KEY = process.env.JUSPAY_API_TEST_KEY
const ORIGIN = 'http://localhost:5190'
// Mike's, total $1,225: >= $500, so routing always sends the card to stripe_test.
const LISTING = LISTINGS.find((l) => l.id === 'lst_024')!
const SELLER = LISTING.sellerId as PersonaId

const json = (path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const act = async (body: Partial<OrderStateRequest>) => {
  const res = await orderState(json('/api/order-state', body))
  return { status: res.status, body: (await res.json()) as OrderView & ErrorBody }
}
const refundReq = async (body: Partial<RefundRequest>) => {
  const res = await refund(json('/api/refund', body))
  return { status: res.status, body: (await res.json()) as OrderView & ErrorBody }
}
const read = async (id: string) => {
  const res = await payment(new Request(`${ORIGIN}/api/payment?id=${id}`))
  expect(res.status).toBe(200)
  return (await res.json()) as OrderView
}
const list = async (query: string) => {
  const res = await orders(new Request(`${ORIGIN}/api/orders?${query}`))
  expect(res.status).toBe(200)
  return ((await res.json()) as { orders: OrderView[] }).orders
}
type ErrorBody = { error?: { code: string } }

/** Creates a test-tagged checkout and confirms it server-side with 4242 (the SDK is browser-only). */
async function paidPayment(listingIds = [LISTING.id]): Promise<string> {
  const res = await checkout(
    new Request(`${ORIGIN}/api/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-slabbed-source': 'test' },
      body: JSON.stringify({
        attemptId: newAttemptId(),
        buyerId: 'alex',
        items: listingIds.map((listingId) => ({ listingId, qty: 1 })),
        shipTo: {
          name: 'Alex Rivera',
          line1: '1 Main St',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
        },
      }),
    }),
  )
  expect(res.status).toBe(200)
  const { paymentId } = (await res.json()) as CheckoutResponse
  const confirmed = await fetch(`${HS}/payments/${paymentId}/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': KEY! },
    body: JSON.stringify({
      payment_method: 'card',
      payment_method_type: 'credit',
      authentication_type: 'no_three_ds',
      payment_method_data: {
        card: {
          card_number: '4242424242424242',
          card_exp_month: '12',
          card_exp_year: '2030',
          card_holder_name: 'Alex Rivera',
          card_cvc: '123',
        },
      },
    }),
  })
  expect(((await confirmed.json()) as { status: string }).status).toBe('succeeded')
  return paymentId
}

describe.skipIf(!KEY)('post-payment (live sandbox)', () => {
  let A = ''
  let B = ''
  beforeAll(async () => {
    ;[A, B] = await Promise.all([paidPayment(), paidPayment()])
    console.log(`[QA-3] payments A=${A} B=${B}`)
  }, 60_000)

  it('rejects out-of-order moves and wrong actors before shipping', async () => {
    expect((await act({ paymentId: A, action: 'ship', actorId: 'alex' })).status).toBe(
      403,
    )
    const receive = await act({ paymentId: A, action: 'receive', actorId: 'alex' })
    expect([receive.status, receive.body.error?.code]).toEqual([
      409,
      'INVALID_TRANSITION',
    ])
    // A dispute before shipping is allowed (a seller who never ships); the multi-seller test covers it.
    expect((await refundReq({ paymentId: A, actorId: 'mike' })).status).toBe(403)
    expect((await refundReq({ paymentId: A, actorId: 'alex' })).status).toBe(403)
    expect((await read(A)).fulfilment).toBe('unshipped')
  })

  it('write-then-verify: the connector 400 from update_metadata is not a failure', async () => {
    // The raw call really does 400 (rewriting a value that is already there)…
    const raw = await fetch(`${HS}/payments/${A}/update_metadata`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'api-key': KEY! },
      body: JSON.stringify({ metadata: { source: 'test' } }),
    })
    const rawBody = (await raw.json()) as { error?: { code: string; message: string } }
    expect(raw.status).toBe(400)
    expect(`${rawBody.error?.code} ${rawBody.error?.message}`).toMatch(/IR_20/)

    // …yet ship returns 200 and the value reads back from Hyperswitch itself.
    const ship = await act({ paymentId: A, action: 'ship', actorId: SELLER })
    expect(ship.status, JSON.stringify(ship.body)).toBe(200)
    expect(ship.body.fulfilment).toBe('shipped')
    const hs = await fetch(`${HS}/payments/${A}`, { headers: { 'api-key': KEY! } })
    const meta = ((await hs.json()) as { metadata: Record<string, string> }).metadata
    expect(meta[`${SELLER}.fulfilment`]).toBe('shipped')
    expect(meta[`${SELLER}.shippedAt`]).not.toBe('')
  })

  it('lifecycle A: shipped → balance available → received', async () => {
    const shipped = await read(A)
    expect(shipped.fulfilment).toBe('shipped')
    expect(shipped.ledger.balance).toBe('available')
    expect(shipped.ledger.commissionCents).toBeGreaterThan(0)

    expect((await act({ paymentId: A, action: 'receive', actorId: 'mike' })).status).toBe(
      403,
    )
    const received = await act({ paymentId: A, action: 'receive', actorId: 'alex' })
    expect(received.status, JSON.stringify(received.body)).toBe(200)
    expect(received.body.fulfilment).toBe('received')
    expect((await read(A)).fulfilment).toBe('received')
  })

  it('lifecycle B: ship → dispute with reason → full refund → reversed', async () => {
    expect((await act({ paymentId: B, action: 'ship', actorId: SELLER })).status).toBe(
      200,
    )
    const disputed = await act({
      paymentId: B,
      action: 'dispute',
      actorId: 'alex',
      reason: '  Coin looks cleaned  ',
    })
    expect(disputed.status, JSON.stringify(disputed.body)).toBe(200)
    expect(disputed.body.fulfilment).toBe('disputed')
    const hs = await fetch(`${HS}/payments/${B}`, { headers: { 'api-key': KEY! } })
    const meta = ((await hs.json()) as { metadata: Record<string, string> }).metadata
    expect(meta[`${SELLER}.disputeReason`]).toBe('Coin looks cleaned')
    expect(disputed.body.disputeReason).toBe('Coin looks cleaned')
    expect(Object.keys(disputed.body.fulfilledAt ?? {}).sort()).toEqual([
      'disputedAt',
      'shippedAt',
    ])
    expect(Date.parse(disputed.body.fulfilledAt!.disputedAt!)).not.toBeNaN()

    const refunded = await refundReq({ paymentId: B, actorId: 'admin' })
    expect(refunded.status, JSON.stringify(refunded.body)).toBe(200)
    expect(refunded.body.refund).toEqual({
      state: 'succeeded',
      refundedCents: refunded.body.breakdown.totalCents,
    })
    expect(refunded.body.ledger).toMatchObject({
      balance: 'reversed',
      commissionCents: 0,
      netCents: 0,
      refundedCents: refunded.body.breakdown.totalCents,
      grossCents: LISTING.priceCents + LISTING.shippingCents,
    })

    const again = await act({
      paymentId: B,
      action: 'dispute',
      actorId: 'alex',
      reason: 'x',
    })
    expect([again.status, again.body.error?.code]).toEqual([409, 'INVALID_TRANSITION'])
  })

  it('refunds are full only: A refunds its whole total, and a second refund is 409', async () => {
    const r = await refundReq({ paymentId: A, actorId: 'admin' })
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(r.body.refund).toEqual({
      state: 'succeeded',
      refundedCents: r.body.breakdown.totalCents,
    })
    expect(r.body.ledger).toMatchObject({
      balance: 'reversed',
      commissionCents: 0,
      netCents: 0,
    })
    expect(r.body.fulfilledAt?.receivedAt).toBeDefined()
    expect(r.body.disputeReason).toBeUndefined()

    const again = await refundReq({ paymentId: A, actorId: 'admin' })
    expect([again.status, again.body.error?.code]).toEqual([409, 'ALREADY_REFUNDED'])
  })

  it.each([['buyer=alex'], [`seller=${SELLER}`], ['all=1']])(
    'orders?%s: well-formed, newest first, app-only, no non-orders',
    async (query) => {
      const views = await list(query)
      const ids = views.map((o) => o.paymentId)
      expect(ids).not.toContain(A)
      expect(ids).not.toContain(B)
      for (const o of views) {
        expect(o.paymentId).toMatch(/\S/)
        expect(o.breakdown.totalCents).toBe(
          o.breakdown.itemsCents + o.breakdown.shippingCents + o.breakdown.taxCents,
        )
        expect(['unshipped', 'shipped', 'received', 'disputed']).toContain(o.fulfilment)
        expect(o.ledger.balance).toMatch(/^(pending|available|reversed)$/)
        expect(Number.isNaN(Date.parse(o.createdAt))).toBe(false)
        if (query.startsWith('buyer')) expect(o.buyerId).toBe('alex')
        if (query.startsWith('seller')) expect(o.sellerId).toBe(SELLER)
        if (query !== 'all=1')
          expect(['awaiting_payment', 'failed', 'cancelled', 'unknown']).not.toContain(
            o.state,
          )
      }
      const created = views.map((o) => o.createdAt)
      expect(created).toEqual([...created].sort().reverse())
      // Source 'app' only: every listed id must carry that tag in Hyperswitch.
      for (const id of ids.slice(0, 10)) {
        const hs = await fetch(`${HS}/payments/${id}`, { headers: { 'api-key': KEY! } })
        expect(
          ((await hs.json()) as { metadata: Record<string, string> }).metadata.source,
        ).toBe('app')
      }
      console.log(`[QA-3] orders?${query}: ${views.length} orders`)
    },
    120_000,
  )
})

// One payment for a two-seller cart: each seller's order ships and refunds on its own.
// lst_024 is Mike's; OTHER is a third seller's, so neither is the buyer's own.
const OTHER = LISTINGS.find((l) => l.sellerId !== SELLER && l.sellerId !== 'alex')!

describe.skipIf(!KEY)('multi-seller payment (live sandbox)', () => {
  it('splits into per-seller orders that ship and refund independently', async () => {
    const paymentId = await paidPayment([LISTING.id, OTHER.id])
    const whole = breakdown(
      [
        { listingId: LISTING.id, qty: 1 },
        { listingId: OTHER.id, qty: 1 },
      ],
      LISTINGS,
    )
    const hs = await fetch(`${HS}/payments/${paymentId}`, {
      headers: { 'api-key': KEY! },
    })
    expect(((await hs.json()) as { amount: number }).amount).toBe(whole.totalCents)

    const views = await list(`payment=${paymentId}`)
    expect(views.map((v) => v.sellerId)).toEqual([SELLER, OTHER.sellerId])
    expect(views.reduce((n, v) => n + v.breakdown.totalCents, 0)).toBe(whole.totalCents)
    const [mine, theirs] = views
    expect(mine.orderId).toBe(`${paymentId}.${SELLER}`)

    // A bare payment id is ambiguous once there are two sellers.
    expect((await act({ paymentId, action: 'ship', actorId: SELLER })).status).toBe(400)
    // Mike can't ship the other seller's order.
    expect(
      (await act({ paymentId: theirs.orderId, action: 'ship', actorId: SELLER })).status,
    ).toBe(403)

    const shipped = await act({
      paymentId: mine.orderId,
      action: 'ship',
      actorId: SELLER,
    })
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200)
    expect(shipped.body.fulfilment).toBe('shipped')
    expect((await read(theirs.orderId)).fulfilment).toBe('unshipped')

    const refunded = await refundReq({ paymentId: theirs.orderId, actorId: 'admin' })
    expect(refunded.status, JSON.stringify(refunded.body)).toBe(200)
    expect(refunded.body.refund).toEqual({
      state: 'succeeded',
      refundedCents: theirs.breakdown.totalCents,
    })
    const after = await read(mine.orderId)
    expect(after.refund.state).toBe('none')
    expect(after.ledger.balance).toBe('available')

    console.log(`[QA-3] multi-seller payment ${paymentId}`)
  }, 60_000)
})

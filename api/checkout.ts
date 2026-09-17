import { breakdown } from '../src/shared/money.js'
import { mapStatus } from '../src/shared/orderState.js'
import { LISTINGS, PERSONAS } from '../src/shared/seed.js'
import {
  META,
  type CartLine,
  type CheckoutRequest,
  type CheckoutResponse,
  type Listing,
  type PaymentSource,
  type PaymentState,
  type ShipTo,
} from '../src/shared/types.js'
import { hsFetch } from './_lib/hyperswitch.js'
import { jsonError, type HsPayment } from './_lib/orderView.js'

const ATTEMPT_ID = /^cka_[0-9a-f]{22}$/
const TERMINAL: PaymentState[] = ['paid', 'failed', 'cancelled', 'refunded']
const cents = (v: unknown) => Number.isInteger(v) && (v as number) >= 0
const complete = (a: Partial<ShipTo> | undefined): a is ShipTo =>
  !!a &&
  (['name', 'line1', 'city', 'state', 'zip'] as const).every(
    (k) => typeof a[k] === 'string' && !!a[k].trim(),
  )
const hsAddress = (a: ShipTo) => ({
  address: {
    first_name: a.name,
    line1: a.line1,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: 'US',
  },
})

/**
 * POST /api/checkout — one intent for the whole cart, however many sellers it spans.
 * Each seller's share is recorded in metadata, so it ships, pays out and refunds on its own.
 * The amount is computed here from our own catalogue; nothing money-shaped is read from the body.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    return await checkout(request)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong starting checkout')
  }
}

async function checkout(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<CheckoutRequest> | null
  if (!body) return jsonError(400, 'BAD_REQUEST', 'Expected a JSON body')

  const { attemptId, buyerId, items, userListings, shipTo, billTo } = body
  if (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId))
    return jsonError(400, 'BAD_REQUEST', 'Invalid attemptId')
  const buyer = PERSONAS.find((p) => p.id === buyerId)
  if (!buyer) return jsonError(400, 'BAD_REQUEST', 'Unknown buyer')
  if (!Array.isArray(items) || items.length === 0)
    return jsonError(400, 'BAD_REQUEST', 'No items')
  if (!complete(shipTo))
    return jsonError(400, 'BAD_REQUEST', 'Incomplete ship-to address')
  if (billTo !== undefined && !complete(billTo))
    return jsonError(400, 'BAD_REQUEST', 'Incomplete billing address')
  // Hyperswitch keeps both on the payment; the buyer can change them until they pay.
  const addresses = { shipping: hsAddress(shipTo), billing: hsAddress(billTo ?? shipTo) }

  // Seeded listings always come from the server copy. Client-sent listings count only for usr_ ids
  // (demo simplification in the contract), and only with sane integer prices.
  const catalogue: Listing[] = [
    ...LISTINGS,
    ...(Array.isArray(userListings) ? userListings : []).filter(
      (l) =>
        typeof l?.id === 'string' &&
        l.id.startsWith('usr_') &&
        typeof l.sellerId === 'string' &&
        cents(l.priceCents) &&
        cents(l.shippingCents),
    ),
  ]

  const lines: { listing: Listing; line: CartLine }[] = []
  for (const item of items) {
    const listing = catalogue.find((l) => l.id === item?.listingId)
    if (!listing)
      return jsonError(400, 'UNKNOWN_LISTING', 'A listing in your cart no longer exists')
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 10)
      return jsonError(400, 'BAD_REQUEST', 'Quantity must be 1–10')
    lines.push({ listing, line: { listingId: listing.id, qty: item.qty } })
  }

  if (lines.some((l) => l.listing.sellerId === buyer.id))
    return jsonError(409, 'OWN_LISTING', "You can't buy your own listing")

  // Per seller, in cart order. The charge is the sum of these, so each seller's share can be
  // refunded exactly (breakdown() rounds tax per seller for the same reason).
  const sellerIds = [...new Set(lines.map((l) => l.listing.sellerId))]
  const groups = sellerIds.map((sellerId) => {
    const own = lines.filter((l) => l.listing.sellerId === sellerId)
    return {
      sellerId,
      listingIds: own.map((l) => l.listing.id),
      // A return refunds the whole seller order, so one ineligible item makes the order ineligible.
      noReturns: own.some((l) => l.listing.noReturns === true),
      b: breakdown(
        own.map((l) => l.line),
        catalogue,
      ),
    }
  })
  const b = breakdown(
    lines.map((l) => l.line),
    catalogue,
  )
  if (b.totalCents <= 0) return jsonError(400, 'BAD_REQUEST', 'Nothing to charge')

  const respond = (clientSecret: string) =>
    Response.json({
      paymentId: attemptId,
      clientSecret,
      publishableKey: process.env.JUSPAY_API_PUBLISHABLE_KEY ?? '',
      sellerIds,
      breakdown: b,
    } satisfies CheckoutResponse)

  const created = await hsFetch<HsPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      payment_id: attemptId,
      amount: b.totalCents,
      currency: 'USD',
      capture_method: 'automatic',
      confirm: false,
      customer: { id: buyer.id, email: buyer.email },
      // Lets the SDK offer "save card" and list this buyer's saved cards. A card is only vaulted when the
      // buyer ticks the box (the SDK then sends customer_acceptance on confirm). Repeat collectors
      // buying on-session is the case; no off-session / merchant-initiated charges here.
      setup_future_usage: 'on_session',
      return_url: `${new URL(request.url).origin}/order/${attemptId}`,
      ...addresses,
      metadata: {
        [META.sellers]: sellerIds.join(','),
        [META.buyerId]: buyer.id,
        // ponytail: 3 + 9 keys per seller (+1 if ineligible for return, +3 once disputed and asked). Hyperswitch documents 50 keys (5 sellers); the sandbox accepted
        // 111 (12 sellers) on 2026-09-16. Cap the cart at 5 sellers if a real account enforces the limit.
        ...Object.fromEntries(
          groups.flatMap(({ sellerId, listingIds, noReturns, b: g }) =>
            Object.entries({
              [META.listingIds]: listingIds.join(','),
              [META.itemsCents]: String(g.itemsCents),
              [META.shippingCents]: String(g.shippingCents),
              [META.taxCents]: String(g.taxCents),
              [META.fulfilment]: 'unshipped',
              [META.shippedAt]: '',
              [META.receivedAt]: '',
              [META.disputedAt]: '',
              [META.disputeReason]: '',
              // Eligibility is fixed at purchase: a seller changing policy later doesn't change this order.
              ...(noReturns ? { [META.noReturns]: '1' } : {}),
            }).map(([k, v]) => [`${sellerId}.${k}`, v]),
          ),
        ),
        [META.source]: (request.headers.get('x-slabbed-source') === 'test'
          ? 'test'
          : 'app') satisfies PaymentSource,
      },
    }),
  })
  if (created.ok && created.data.client_secret) return respond(created.data.client_secret)

  // HE_01: this payment_id already exists — a retransmission. Resume it, never create a second.
  if (!created.ok && created.hsCode === 'HE_01') {
    const existing = await hsFetch<HsPayment>(`/payments/${attemptId}`)
    if (!existing.ok)
      return jsonError(502, 'UPSTREAM', 'Could not read the existing payment')
    if (existing.data.amount !== b.totalCents)
      return jsonError(
        409,
        'AMOUNT_MISMATCH',
        'Your cart changed since this payment started',
      )
    if (TERMINAL.includes(mapStatus(existing.data.status)))
      return jsonError(409, 'CONFLICT_SPENT', 'This payment attempt has already finished')
    // Only a not-yet-attempted intent can be (re)mounted in the SDK. Anything else still in flight
    // (processing, review, action_required…) belongs on the order page, which reads its real state.
    if (
      mapStatus(existing.data.status) === 'awaiting_payment' &&
      existing.data.client_secret
    ) {
      // The same attempt after "Edit": the amount can't have changed, but the addresses can.
      // Verified on the sandbox 2026-09-16: POST /payments/{id} updates both before confirmation.
      const updated = await hsFetch(`/payments/${attemptId}`, {
        method: 'POST',
        body: JSON.stringify(addresses),
      })
      if (!updated.ok)
        return jsonError(
          502,
          'UPSTREAM',
          "We couldn't update the address. Nothing was charged.",
        )
      return respond(existing.data.client_secret)
    }
    return Response.json(
      {
        error: { code: 'IN_PROGRESS', message: 'This payment is already in progress' },
        paymentId: attemptId,
      },
      { status: 409 },
    )
  }
  // Raw upstream code goes to the server log only (design.md §4: logged, never printed).
  console.error(
    `[checkout] ${attemptId} create failed`,
    created.ok ? 'no client_secret' : `${created.status} ${created.hsCode}`,
  )
  return jsonError(
    502,
    'UPSTREAM',
    'Nothing has been charged. We could not start the payment.',
  )
}

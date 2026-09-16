import { breakdown } from '../src/shared/money.js'
import { mapStatus } from '../src/shared/orderState.js'
import { LISTINGS, PERSONAS } from '../src/shared/seed.js'
import {
  META,
  type CheckoutRequest,
  type CheckoutResponse,
  type Listing,
  type PaymentSource,
  type PaymentState,
} from '../src/shared/types.js'
import { hsFetch } from './_lib/hyperswitch.js'
import { jsonError, type HsPayment } from './_lib/orderView.js'

const ATTEMPT_ID = /^cka_[0-9a-f]{22}$/
const TERMINAL: PaymentState[] = ['paid', 'failed', 'cancelled', 'refunded']
const cents = (v: unknown) => Number.isInteger(v) && (v as number) >= 0

/**
 * POST /api/checkout — one intent for one seller group.
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

  const { attemptId, buyerId, items, userListings, shipTo } = body
  if (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId))
    return jsonError(400, 'BAD_REQUEST', 'Invalid attemptId')
  const buyer = PERSONAS.find((p) => p.id === buyerId)
  if (!buyer) return jsonError(400, 'BAD_REQUEST', 'Unknown buyer')
  if (!Array.isArray(items) || items.length === 0)
    return jsonError(400, 'BAD_REQUEST', 'No items')
  if (
    !shipTo ||
    (['name', 'line1', 'city', 'state', 'zip'] as const).some(
      (k) => typeof shipTo[k] !== 'string' || !shipTo[k].trim(),
    )
  )
    return jsonError(400, 'BAD_REQUEST', 'Incomplete ship-to address')

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

  const lines = []
  for (const item of items) {
    const listing = catalogue.find((l) => l.id === item?.listingId)
    if (!listing)
      return jsonError(400, 'UNKNOWN_LISTING', 'A listing in your cart no longer exists')
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 10)
      return jsonError(400, 'BAD_REQUEST', 'Quantity must be 1–10')
    lines.push({ listing, line: { listingId: listing.id, qty: item.qty } })
  }

  const sellerId = lines[0].listing.sellerId
  if (lines.some((l) => l.listing.sellerId !== sellerId))
    return jsonError(400, 'MULTIPLE_SELLERS', 'One checkout per seller')
  if (sellerId === buyer.id)
    return jsonError(409, 'OWN_LISTING', "You can't buy your own listing")

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
      sellerId,
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
      shipping: {
        address: {
          first_name: shipTo.name,
          line1: shipTo.line1,
          city: shipTo.city,
          state: shipTo.state,
          zip: shipTo.zip,
          country: 'US',
        },
      },
      metadata: {
        [META.sellerId]: sellerId,
        [META.buyerId]: buyer.id,
        [META.listingIds]: lines.map((l) => l.listing.id).join(','),
        [META.itemsCents]: String(b.itemsCents),
        [META.shippingCents]: String(b.shippingCents),
        [META.taxCents]: String(b.taxCents),
        [META.fulfilment]: 'unshipped',
        [META.shippedAt]: '',
        [META.receivedAt]: '',
        [META.disputedAt]: '',
        [META.disputeReason]: '',
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
    )
      return respond(existing.data.client_secret)
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

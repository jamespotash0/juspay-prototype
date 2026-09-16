import { createHash } from 'node:crypto'
import { COPY, type DeclineReason } from '../../src/shared/copy.js'
import { sellerLedger } from '../../src/shared/money.js'
import { mapStatus } from '../../src/shared/orderState.js'
import {
  META,
  type Breakdown,
  type Decline,
  type Fulfilment,
  type OrderView,
  type PaymentState,
  type RefundState,
} from '../../src/shared/types.js'
import { hsFetch, type HsResult } from './hyperswitch.js'

/** The fields of a Hyperswitch v1 payment we read. */
export interface HsPayment {
  payment_id: string
  status: string
  amount: number
  client_secret: string | null
  created: string
  connector?: string | null
  payment_method_type?: string | null
  payment_method_data?: {
    card?: {
      last4?: string | null
      card_network?: string | null
      card_exp_month?: string | null
      card_exp_year?: string | null
    } | null
  } | null
  metadata?: Record<string, string> | null
  error_code?: string | null
  error_message?: string | null
  unified_code?: string | null
  unified_message?: string | null
  manual_retry_allowed?: boolean | null
}

interface HsRefundList {
  data: { refund_id: string; amount: number; status: string }[]
}

const FULFILMENTS: Fulfilment[] = ['unshipped', 'shipped', 'received', 'disputed']
const REFUNDABLE: PaymentState[] = ['paid', 'paid_partial', 'refunded']

/** Payment ids we accept in a path: ours are cka_…, but any Hyperswitch-shaped id reads. */
export const PAYMENT_ID = /^[A-Za-z0-9_-]{1,64}$/
/** `<paymentId>.<sellerId>`, or a bare paymentId. Neither part can contain a dot. */
export const ORDER_ID = /^([A-Za-z0-9_-]{1,64})(?:\.([A-Za-z0-9_-]{1,64}))?$/

export const orderIdOf = (paymentId: string, sellerId: string) =>
  `${paymentId}.${sellerId}`

/** The metadata key for one seller's field: prefixed on multi-seller payments, bare on legacy ones. */
export const sellerKey = (m: Record<string, string>, sellerId: string, key: string) =>
  m[META.sellers] ? `${sellerId}.${key}` : key

/** Seller ids on a payment, in cart order. */
export const sellersOf = (m: Record<string, string>) =>
  m[META.sellers]
    ? m[META.sellers].split(',').filter(Boolean)
    : m[META.sellerId]
      ? [m[META.sellerId]]
      : []

/**
 * Refund ids are `ckr_<20 hex of paymentId:sellerId>_<n>`, so each refund on a shared payment can
 * be traced to its seller, and n counts retries after a failed refund.
 */
export const refundPrefix = (paymentId: string, sellerId: string) =>
  'ckr_' +
  createHash('sha256').update(`${paymentId}:${sellerId}`).digest('hex').slice(0, 20) +
  '_'

const int = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) ? n : 0
}

const readRefunds = (paymentId: string) =>
  hsFetch<HsRefundList>('/refunds/list', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentId }),
  })

/** Every seller's order on a payment; fetches its refunds (a refunded payment still reads succeeded). */
export async function toOrderViews(
  p: HsPayment,
  /** Already started by the caller, so it runs alongside the payment read. */
  refundsRead?: Promise<HsResult<HsRefundList>>,
): Promise<OrderView[]> {
  const m = p.metadata ?? {}
  const sellers = sellersOf(m)
  const state = mapStatus(p.status)
  // Only money that moved can be refunded, so skip the lookup otherwise (saves N calls in /api/orders).
  const refunds = REFUNDABLE.includes(state)
    ? await (refundsRead ?? readRefunds(p.payment_id))
    : null
  // ponytail: a failed refunds read reports 'none'; the order page re-reads, add an error field if admin needs to see it
  const allRefunds = refunds?.ok ? refunds.data.data : []

  let decline: Decline | undefined
  if (p.error_code || p.unified_code) {
    const reason = declineReason(p)
    decline = {
      reason,
      // error_code (DC_08, card_declined…) tells cases apart; unified_code is UE_9000 for all of them on paypal_test.
      code: p.error_code ?? p.unified_code ?? 'unknown',
      // Buyer-safe copy only; the raw error_message never reaches the browser.
      message: COPY.decline[reason].message,
      retriable: RETRIABLE.includes(reason),
    }
  }

  const card = p.payment_method_data?.card
  const paymentMethod = card?.last4
    ? {
        ...(card.card_network ? { network: card.card_network } : {}),
        last4: card.last4,
        ...(card.card_exp_month && card.card_exp_year
          ? { expiry: `${card.card_exp_month}/${card.card_exp_year.slice(-2)}` }
          : {}),
      }
    : undefined

  return sellers.map((sellerId) => {
    const get = (key: string) => m[sellerKey(m, sellerId, key)]
    const itemsCents = int(get(META.itemsCents))
    const shippingCents = int(get(META.shippingCents))
    const taxCents = int(get(META.taxCents))
    const breakdown: Breakdown = {
      itemsCents,
      shippingCents,
      taxCents,
      totalCents: itemsCents + shippingCents + taxCents,
    }
    const fulfilment = FULFILMENTS.find((f) => f === get(META.fulfilment)) ?? 'unshipped'

    // A legacy payment has one seller, so every refund on it is theirs.
    const prefix = refundPrefix(p.payment_id, sellerId)
    const list = m[META.sellers]
      ? allRefunds.filter((r) => r.refund_id.startsWith(prefix))
      : allRefunds
    const refundedCents = list
      .filter((r) => r.status === 'succeeded')
      .reduce((sum, r) => sum + r.amount, 0)
    const refundState: RefundState = refundedCents
      ? 'succeeded'
      : list.some((r) => r.status === 'pending' || r.status === 'review')
        ? 'pending'
        : list.length
          ? 'failed'
          : 'none'

    // Metadata stores '' for an unset step; emit only the steps that happened.
    const fulfilledAt = Object.fromEntries(
      (['shippedAt', 'receivedAt', 'disputedAt'] as const)
        .filter((k) => get(META[k]))
        .map((k) => [k, get(META[k])]),
    ) as NonNullable<OrderView['fulfilledAt']>
    const disputeReason = get(META.disputeReason)
    const listingIds = get(META.listingIds)

    return {
      orderId: orderIdOf(p.payment_id, sellerId),
      paymentId: p.payment_id,
      state,
      fulfilment,
      refund: { state: refundState, refundedCents },
      breakdown,
      ledger: sellerLedger(breakdown, fulfilment, refundState, !!get(META.shippedAt)),
      sellerId,
      buyerId: m[META.buyerId] ?? '',
      listingIds: listingIds ? listingIds.split(',') : [],
      createdAt: p.created,
      ...(p.connector ? { connector: p.connector } : {}),
      ...(p.payment_method_type ? { paymentMethodType: p.payment_method_type } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(decline ? { decline } : {}),
      ...(disputeReason ? { disputeReason } : {}),
      ...(Object.keys(fulfilledAt).length ? { fulfilledAt } : {}),
    }
  })
}

// Soft declines: the same card may work on a second try (design.md §4). manual_retry_allowed is not
// used: it reads false for every decline on paypal_test and says nothing about the card.
const RETRIABLE: DeclineReason[] = [
  'insufficient_funds',
  'incorrect_cvc',
  'processing_error',
  'network_unreachable',
]

// unified_code is UE_9000 for every paypal_test decline, so the reason comes from the connector's
// own code + message (paypal_test: "Lost card", "Internal Server Error from Connector"; Stripe:
// card_declined / "Your card has insufficient funds.", expired_card, incorrect_cvc, processing_error).
// ponytail: text matching, swap for unified_code once a connector returns specific unified codes.
export function declineReason(
  p: Pick<HsPayment, 'error_code' | 'error_message'>,
): DeclineReason {
  const t = `${p.error_code ?? ''} ${p.error_message ?? ''}`.toLowerCase()
  if (/insufficient/.test(t)) return 'insufficient_funds'
  if (/lost|stolen/.test(t)) return 'lost_or_stolen'
  if (/expired/.test(t)) return 'expired_card'
  if (/cvc|cvv|security code/.test(t)) return 'incorrect_cvc'
  if (/timeout|timed out|unreachable|network/.test(t)) return 'network_unreachable'
  if (/processing|internal server error/.test(t)) return 'processing_error'
  return 'generic'
}

/** Reads a payment and every order on it, or the error Response to return. */
export async function readPayment(
  paymentId: string,
): Promise<{ payment: HsPayment; orders: OrderView[] } | Response> {
  // The refunds read doesn't depend on the payment read, so run both at once rather than one
  // after the other. For an unpaid payment the refunds result is simply unused (hsFetch never throws).
  const refundsRead = readRefunds(paymentId)
  const res = await hsFetch<HsPayment>(`/payments/${paymentId}`)
  if (res.ok)
    return { payment: res.data, orders: await toOrderViews(res.data, refundsRead) }
  if (res.status === 404) return jsonError(404, 'NOT_FOUND', 'Payment not found')
  return jsonError(502, 'UPSTREAM', 'Could not read the payment')
}

/** One seller's order by orderId (or a bare paymentId with one seller), with its payment. */
export async function findOrder(
  id: string,
): Promise<{ payment: HsPayment; order: OrderView } | Response> {
  const match = ORDER_ID.exec(id)
  if (!match) return jsonError(400, 'BAD_REQUEST', 'Invalid order id')
  const read = await readPayment(match[1])
  if (read instanceof Response) return read
  const sellerId = match[2]
  if (!sellerId && read.orders.length > 1)
    return jsonError(
      400,
      'AMBIGUOUS_ORDER',
      'This payment has several orders; pass an order id',
    )
  const order = sellerId
    ? read.orders.find((v) => v.sellerId === sellerId)
    : read.orders[0]
  return order
    ? { payment: read.payment, order }
    : jsonError(404, 'NOT_FOUND', 'Order not found')
}

/** Reads one seller's order, or the error Response to return. */
export async function readOrder(id: string): Promise<OrderView | Response> {
  const found = await findOrder(id)
  return found instanceof Response ? found : found.order
}

export const jsonError = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status })

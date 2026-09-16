import { COPY, type DeclineReason } from '../../src/shared/copy.ts'
import { sellerLedger } from '../../src/shared/money.ts'
import { mapStatus } from '../../src/shared/orderState.ts'
import {
  META,
  type Breakdown,
  type Decline,
  type Fulfilment,
  type OrderView,
  type PaymentState,
  type RefundState,
} from '../../src/shared/types.ts'
import { hsFetch } from './hyperswitch.ts'

/** The fields of a Hyperswitch v1 payment we read. */
export interface HsPayment {
  payment_id: string
  status: string
  amount: number
  client_secret: string | null
  created: string
  connector?: string | null
  metadata?: Record<string, string> | null
  error_code?: string | null
  error_message?: string | null
  unified_code?: string | null
  unified_message?: string | null
  manual_retry_allowed?: boolean | null
}

interface HsRefundList {
  data: { amount: number; status: string }[]
}

const FULFILMENTS: Fulfilment[] = ['unshipped', 'shipped', 'received', 'disputed']
const REFUNDABLE: PaymentState[] = ['paid', 'paid_partial', 'refunded']

/** Payment ids we accept in a path: ours are cka_…, but any Hyperswitch-shaped id reads. */
export const PAYMENT_ID = /^[A-Za-z0-9_-]{1,64}$/

const int = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) ? n : 0
}

/** Builds the one read shape from a payment; fetches its refunds (a refunded payment still reads succeeded). */
export async function toOrderView(p: HsPayment): Promise<OrderView> {
  const m = p.metadata ?? {}
  const itemsCents = int(m[META.itemsCents])
  const shippingCents = int(m[META.shippingCents])
  const taxCents = int(m[META.taxCents])
  const breakdown: Breakdown = {
    itemsCents,
    shippingCents,
    taxCents,
    totalCents: itemsCents + shippingCents + taxCents,
  }
  const fulfilment = FULFILMENTS.find((f) => f === m[META.fulfilment]) ?? 'unshipped'

  const state = mapStatus(p.status)
  // Only money that moved can be refunded, so skip the lookup otherwise (saves N calls in /api/orders).
  const refunds = REFUNDABLE.includes(state)
    ? await hsFetch<HsRefundList>('/refunds/list', {
        method: 'POST',
        body: JSON.stringify({ payment_id: p.payment_id }),
      })
    : null
  // ponytail: a failed refunds read reports 'none'; the order page re-reads, add an error field if admin needs to see it
  const list = refunds?.ok ? refunds.data.data : []
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

  let decline: Decline | undefined
  if (p.error_code || p.unified_code) {
    const reason = declineReason(p)
    decline = {
      // error_code (DC_08, card_declined…) tells cases apart; unified_code is UE_9000 for all of them on paypal_test.
      code: p.error_code ?? p.unified_code ?? 'unknown',
      // Buyer-safe copy only; the raw error_message never reaches the browser.
      message: COPY.decline[reason].message,
      retriable: RETRIABLE.includes(reason),
    }
  }

  return {
    paymentId: p.payment_id,
    state,
    fulfilment,
    refund: { state: refundState, refundedCents },
    breakdown,
    ledger: sellerLedger(breakdown, fulfilment, refundState),
    sellerId: m[META.sellerId] ?? '',
    buyerId: m[META.buyerId] ?? '',
    listingIds: m[META.listingIds] ? m[META.listingIds].split(',') : [],
    createdAt: p.created,
    ...(p.connector ? { connector: p.connector } : {}),
    ...(decline ? { decline } : {}),
  }
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

/** Reads a payment as an OrderView, or the error Response to return. */
export async function readOrder(paymentId: string): Promise<OrderView | Response> {
  const res = await hsFetch<HsPayment>(`/payments/${paymentId}`)
  if (res.ok) return toOrderView(res.data)
  if (res.status === 404) return jsonError(404, 'NOT_FOUND', 'Payment not found')
  return jsonError(502, 'UPSTREAM', 'Could not read the payment')
}

export const jsonError = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status })

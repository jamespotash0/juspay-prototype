// THE CONTRACT. Imported by both src/ (browser) and api/ (server).
// Every agent codes against these shapes. Change only with product sign-off,
// and update plan/tickets.md in the same change.

/** Integer minor units (US cents). Never a float, never a formatted string. */
export type Cents = number

// ── People ──────────────────────────────────────────────────────────────────

/** Demo personas behind the switcher. Alex and Mike can both buy AND sell. */
export type PersonaId = 'alex' | 'mike' | 'admin'

export interface Persona {
  id: PersonaId
  name: string
  email: string
  kind: 'collector' | 'admin'
}

/** A seller's public profile. Collector personas are also sellers: id 'alex' / 'mike'. */
export interface Seller {
  id: string
  handle: string
  rating: number // 0–5, one decimal
  sales: number
  joinedYear: number
  shipsFrom: string // "Columbus, OH"
}

// ── Listings ────────────────────────────────────────────────────────────────

export type Category = 'coin' | 'card'
export type GradingService = 'PCGS' | 'NGC' | 'PSA' | 'BGS' | 'CGC'

export interface Listing {
  /** Seeded: 'lst_…'. Created in the browser: 'usr_…'. */
  id: string
  sellerId: string
  category: Category
  title: string
  priceCents: Cents
  shippingCents: Cents
  imageUrl: string
  graded: boolean
  service?: GradingService
  grade?: string // "MS-65", "PSA 9"
  certNumber?: string
  year?: number
  mintMark?: string
  description: string
  createdAt: string // ISO 8601
}

export interface CartLine {
  listingId: string
  qty: number
}

export interface ShipTo {
  name: string
  line1: string
  city: string
  state: string
  zip: string
}

// ── Money ───────────────────────────────────────────────────────────────────

/** What the BUYER is charged. Tax and total are never shown to the seller. */
export interface Breakdown {
  itemsCents: Cents
  shippingCents: Cents
  taxCents: Cents
  totalCents: Cents
}

/** What the SELLER is credited. Commission is never shown to the buyer. */
export interface SellerLedger {
  grossCents: Cents // items + shipping
  /** While 'pending': the commission that WILL be taken. When 'reversed': 0 — a refunded sale pays no fee. */
  commissionCents: Cents
  /** While 'pending': the expected net. When 'reversed': 0. */
  netCents: Cents
  balance: 'pending' | 'available' | 'reversed'
}

// ── Payment + fulfilment state ──────────────────────────────────────────────

/** Our projection of Hyperswitch's 17 IntentStatus values. See plan/engineering.md §4. */
export type PaymentState =
  | 'awaiting_payment'
  | 'action_required'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'authorized_unexpected'
  | 'paid_partial'
  | 'review'
  | 'unknown'

/** Our state, stored as flat keys in Hyperswitch payment metadata. */
export type Fulfilment = 'unshipped' | 'shipped' | 'received' | 'disputed'

export type RefundState = 'none' | 'pending' | 'succeeded' | 'failed'

/** Flat metadata keys written onto every payment. The merge is shallow — never nest. */
export const META = {
  sellerId: 'sellerId',
  buyerId: 'buyerId',
  listingIds: 'listingIds', // comma-joined
  itemsCents: 'itemsCents', // stringified integers
  shippingCents: 'shippingCents',
  taxCents: 'taxCents',
  fulfilment: 'fulfilment',
  shippedAt: 'shippedAt',
  receivedAt: 'receivedAt',
  disputedAt: 'disputedAt',
  disputeReason: 'disputeReason',
  /** 'app' for real demo orders, 'test' for automated test runs. Order lists show 'app' only. */
  source: 'source',
} as const

export type PaymentSource = 'app' | 'test'

export interface Decline {
  code: string // logged / shown only as a small support ref
  message: string // already buyer-safe copy
  retriable: boolean
}

/** The one read shape every screen renders from. Built server-side only. */
export interface OrderView {
  paymentId: string
  state: PaymentState
  fulfilment: Fulfilment
  refund: { state: RefundState; refundedCents: Cents }
  breakdown: Breakdown
  ledger: SellerLedger
  sellerId: string
  buyerId: string
  listingIds: string[]
  createdAt: string
  connector?: string
  decline?: Decline
}

// ── API contracts ───────────────────────────────────────────────────────────

export interface ApiError {
  error: { code: string; message: string }
}

/** POST /api/checkout — creates one intent for one seller group. No amount inbound. */
export interface CheckoutRequest {
  attemptId: string // becomes Hyperswitch payment_id, ≤30 chars
  buyerId: PersonaId
  items: CartLine[]
  /** Only for 'usr_…' listings: their price is trusted from the client (demo simplification). */
  userListings?: Listing[]
  shipTo: ShipTo
}
export interface CheckoutResponse {
  paymentId: string
  clientSecret: string
  publishableKey: string
  sellerId: string
  breakdown: Breakdown
}

/** GET /api/payment?id=… → OrderView */

/** POST /api/order-state → OrderView */
export type OrderAction = 'ship' | 'receive' | 'dispute'
export interface OrderStateRequest {
  paymentId: string
  action: OrderAction
  actorId: PersonaId
  reason?: string // dispute only
}

/** POST /api/refund → OrderView. Admin only. Omit amount for a full refund. */
export interface RefundRequest {
  paymentId: string
  actorId: PersonaId
  amountCents?: Cents
  reason?: string
}

/** GET /api/orders?buyer=<id> | ?seller=<id> | ?all=1 */
export interface OrdersResponse {
  orders: OrderView[]
}

// ── Business constants ──────────────────────────────────────────────────────

/** Flat sales tax on items (not shipping). Stands in for Avalara/TaxJar. */
export const TAX_RATE_BPS = 800 // 8.00%
/** Commission on items (not shipping), deducted when the seller marks shipped. */
export const COMMISSION_BPS = 500 // 5.00%

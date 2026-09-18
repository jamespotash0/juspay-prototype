// THE CONTRACT. Imported by both src/ (browser) and api/ (server).
// Every agent codes against these shapes. Change only with product sign-off,
// and update plan/tickets.md in the same change.

import type { DeclineReason } from './copy.js'

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
  /** The photo already shows the grading holder, so the UI must not draw one around it. */
  photoShowsSlab?: boolean
  graded: boolean
  service?: GradingService
  grade?: string // "MS-65", "PSA 9"
  certNumber?: string
  year?: number
  mintMark?: string
  description: string
  /** The seller doesn't take this back for a change of mind. "Not as described" still applies. */
  noReturns?: boolean
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
  /** While 'pending': the commission that WILL be taken. When 'reversed': 0 — a fully refunded sale pays no fee. */
  commissionCents: Cents
  /** gross − commission. While 'pending': the expected net. When 'reversed': 0. */
  netCents: Cents
  /** Refunds are full per seller: 0, or this seller's share of the buyer's total once refunded. */
  refundedCents: Cents
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

/**
 * Flat metadata keys written onto every payment. The merge is shallow — never nest.
 * One payment covers the whole cart: `sellers` lists the seller ids, and every per-seller key is
 * written as `<sellerId>.<key>` (e.g. `sel_bluesheet.fulfilment`). Payments made before the
 * multi-seller cart have no `sellers` key and a single unprefixed set, with `sellerId`.
 */
export const META = {
  sellers: 'sellers', // comma-joined seller ids
  /** Legacy single-seller payments only. */
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
  /** The kind of problem the buyer picked (IssueKind). */
  issue: 'issue',
  /** '1' when any item in this seller's order was ineligible for return at purchase. Absent otherwise. */
  noReturns: 'noReturns',
  askedAt: 'askedAt',
  question: 'question',
  /** 'app' for real demo orders, 'test' for automated test runs. Order lists show 'app' only. */
  source: 'source',
} as const

export type PaymentSource = 'app' | 'test'

export interface Decline {
  /** Pages branch on this, never on message text. */
  reason: DeclineReason
  code: string // logged / shown only as a small support ref
  message: string // already buyer-safe copy
  retriable: boolean
}

/**
 * The one read shape every screen renders from. Built server-side only.
 * An order is one seller's share of a payment: a three-seller cart is one payment and three orders.
 */
export interface OrderView {
  /** `<paymentId>.<sellerId>`. Addresses this seller's order in URLs and API calls. */
  orderId: string
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
  /** Hyperswitch payment_method_type: 'credit', 'debit', 'paypal'… */
  paymentMethodType?: string
  /** What the buyer paid with, safe to show: card network, last four and expiry only. */
  paymentMethod?: { network?: string; funding?: Funding; last4?: string; expiry?: string }
  decline?: Decline
  /** Present once the buyer has disputed. */
  disputeReason?: string
  issue?: IssueKind
  /** False when an item was ineligible for return at purchase. */
  returnable: boolean
  /** The buyer's latest question to the seller. */
  question?: string
  /** ISO timestamps from metadata, each present once that step happened. */
  fulfilledAt?: {
    shippedAt?: string
    receivedAt?: string
    disputedAt?: string
    askedAt?: string
  }
}

// ── API contracts ───────────────────────────────────────────────────────────

export interface ApiError {
  error: { code: string; message: string }
}

/** POST /api/checkout — one intent for the whole cart, any number of sellers. No amount inbound. */
export interface CheckoutRequest {
  attemptId: string // becomes Hyperswitch payment_id, ≤30 chars
  buyerId: PersonaId
  items: CartLine[]
  /** Only for 'usr_…' listings: their price is trusted from the client (demo simplification). */
  userListings?: Listing[]
  shipTo: ShipTo
  /** Billing address. Omitted when it's the same as shipping. */
  billTo?: ShipTo
}
export interface CheckoutResponse {
  paymentId: string
  clientSecret: string
  publishableKey: string
  sellerIds: string[]
  /** The whole cart: the sum of each seller's breakdown. */
  breakdown: Breakdown
}

/** GET /api/payment?id=<orderId> → OrderView. A bare paymentId works only for a single-seller payment. */

/** POST /api/order-state → OrderView */
export type OrderAction = 'ship' | 'receive' | 'dispute' | 'ask'
/** What "Have a problem?" offers. Every kind but `question` asks for a refund. */
export type IssueKind = 'cancel' | 'notArrived' | 'notAsDescribed' | 'return' | 'question'
export interface OrderStateRequest {
  /** An orderId; a bare paymentId only for a single-seller payment. */
  paymentId: string
  action: OrderAction
  actorId: PersonaId
  reason?: string // dispute: the buyer's own words; ask: the question
  issue?: IssueKind // dispute only
}

/** POST /api/refund → OrderView. The order's seller only. Always refunds that order in full — there is no amount. */
export interface RefundRequest {
  /** An orderId; a bare paymentId only for a single-seller payment. */
  paymentId: string
  actorId: PersonaId
  reason?: string
}

/** A card Hyperswitch saved for a buyer at checkout. Safe to show: no token, no full number. */
export type Funding = 'credit' | 'debit' | 'prepaid'

export interface SavedCard {
  id: string
  network?: string
  funding?: Funding
  last4: string
  expiry?: string
  /** Hyperswitch's default for this customer: the SDK lists it first and pre-selects it. */
  isDefault?: boolean
}

/** POST /api/save-card — a $0 payment for the SDK to save a card through. */
export interface SaveCardResponse {
  paymentId: string
  clientSecret: string
  publishableKey: string
}

/** GET /api/save-card?id=<paymentId>: how the $0 card-saving payment ended. */
export interface SaveCardStatus {
  state: PaymentState
}

/** GET /api/payment-methods?customer=<id>, and DELETE …&id=<id> */
export interface PaymentMethodsResponse {
  methods: SavedCard[]
}

/** GET /api/orders?buyer=<id> | ?seller=<id> | ?all=1 | ?payment=<paymentId> (every order in one purchase) */
export interface OrdersResponse {
  orders: OrderView[]
}

// ── Business constants ──────────────────────────────────────────────────────

/** Flat sales tax on items (not shipping). Stands in for Avalara/TaxJar. */
export const TAX_RATE_BPS = 800 // 8.00%
/** Commission on items (not shipping), deducted when the seller marks shipped. */
export const COMMISSION_BPS = 500 // 5.00%

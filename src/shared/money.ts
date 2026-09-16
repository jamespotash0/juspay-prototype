import {
  COMMISSION_BPS,
  TAX_RATE_BPS,
  type Breakdown,
  type CartLine,
  type Fulfilment,
  type Listing,
  type RefundState,
  type SellerLedger,
} from './types.js'

/**
 * What the buyer pays, in integer cents. Throws on an unknown listing id.
 * Tax is rounded per seller, so a multi-seller total is exactly the sum of each seller's order
 * and a refund of one seller's order returns exactly what that order added.
 */
export function breakdown(lines: CartLine[], listings: Listing[]): Breakdown {
  let itemsCents = 0
  let shippingCents = 0
  const itemsBySeller = new Map<string, number>()
  for (const line of lines) {
    const listing = listings.find((l) => l.id === line.listingId)
    if (!listing) throw new Error(`Unknown listing: ${line.listingId}`)
    const items = listing.priceCents * line.qty
    itemsCents += items
    shippingCents += listing.shippingCents * line.qty
    itemsBySeller.set(
      listing.sellerId,
      (itemsBySeller.get(listing.sellerId) ?? 0) + items,
    )
  }
  let taxCents = 0
  for (const items of itemsBySeller.values())
    taxCents += Math.round((items * TAX_RATE_BPS) / 10000)
  return {
    itemsCents,
    shippingCents,
    taxCents,
    totalCents: itemsCents + shippingCents + taxCents,
  }
}

/**
 * What the seller is credited. Tax is never the seller's; commission is on items only.
 * 'pending' shows the projected commission and net. Refunds are full per seller, so a succeeded
 * refund reverses this seller's sale: no fee, nets 0, and the buyer gets this order's total back.
 */
export function sellerLedger(
  b: Breakdown,
  fulfilment: Fulfilment,
  refundState: RefundState,
  /** Whether the seller ever shipped. A buyer can dispute before shipping, and that must not release funds. */
  shipped = fulfilment !== 'unshipped',
): SellerLedger {
  const grossCents = b.itemsCents + b.shippingCents
  if (refundState === 'succeeded')
    return {
      grossCents,
      commissionCents: 0,
      netCents: 0,
      refundedCents: b.totalCents,
      balance: 'reversed',
    }
  const commissionCents = Math.round((b.itemsCents * COMMISSION_BPS) / 10000)
  return {
    grossCents,
    commissionCents,
    netCents: grossCents - commissionCents,
    refundedCents: 0,
    balance: shipped ? 'available' : 'pending',
  }
}

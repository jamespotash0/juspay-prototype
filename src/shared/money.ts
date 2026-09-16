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

/** What the buyer pays, in integer cents. Throws on an unknown listing id. */
export function breakdown(lines: CartLine[], listings: Listing[]): Breakdown {
  let itemsCents = 0
  let shippingCents = 0
  for (const line of lines) {
    const listing = listings.find((l) => l.id === line.listingId)
    if (!listing) throw new Error(`Unknown listing: ${line.listingId}`)
    itemsCents += listing.priceCents * line.qty
    shippingCents += listing.shippingCents * line.qty
  }
  const taxCents = Math.round((itemsCents * TAX_RATE_BPS) / 10000)
  return {
    itemsCents,
    shippingCents,
    taxCents,
    totalCents: itemsCents + shippingCents + taxCents,
  }
}

/**
 * What the seller is credited. Tax is never the seller's; commission is on items only.
 * 'pending' shows the projected commission and net. Refunds are full only, so a succeeded
 * refund reverses the sale: no fee, nets 0, and the buyer gets their whole total back.
 */
export function sellerLedger(
  b: Breakdown,
  fulfilment: Fulfilment,
  refundState: RefundState,
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
    balance: fulfilment === 'unshipped' ? 'pending' : 'available',
  }
}

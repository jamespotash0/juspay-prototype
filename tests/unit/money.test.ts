import { describe, expect, it } from 'vitest'
import { breakdown, sellerLedger } from '../../src/shared/money.ts'
import type { Listing } from '../../src/shared/types.ts'

const listing = (id: string, priceCents: number, shippingCents: number): Listing => ({
  id,
  sellerId: 'mike',
  category: 'coin',
  title: id,
  priceCents,
  shippingCents,
  imageUrl: '',
  graded: false,
  description: '',
  createdAt: '2026-01-01T00:00:00Z',
})

const morgan = listing('lst_a', 180_000, 1_200)

describe('breakdown (buyer)', () => {
  it('matches the plan worked example: $1,800 + $12 → tax $144, total $1,956', () => {
    expect(breakdown([{ listingId: 'lst_a', qty: 1 }], [morgan])).toEqual({
      itemsCents: 180_000,
      shippingCents: 1_200,
      taxCents: 14_400,
      totalCents: 195_600,
    })
  })

  it('sums multiple items and quantities', () => {
    const b = breakdown(
      [
        { listingId: 'lst_a', qty: 1 },
        { listingId: 'lst_b', qty: 3 },
      ],
      [morgan, listing('lst_b', 2_500, 500)],
    )
    expect(b).toEqual({
      itemsCents: 187_500,
      shippingCents: 2_700,
      taxCents: 15_000,
      totalCents: 205_200,
    })
  })

  it('rounds tax to whole cents', () => {
    // 8% of $19.99 = 159.92¢ → 160¢
    const b = breakdown([{ listingId: 'x', qty: 1 }], [listing('x', 1_999, 0)])
    expect(b.taxCents).toBe(160)
    expect(Number.isInteger(b.totalCents)).toBe(true)
  })

  it('excludes shipping from the tax base', () => {
    const noShip = breakdown([{ listingId: 'x', qty: 1 }], [listing('x', 10_000, 0)])
    const bigShip = breakdown(
      [{ listingId: 'x', qty: 1 }],
      [listing('x', 10_000, 99_900)],
    )
    expect(bigShip.taxCents).toBe(noShip.taxCents)
    expect(bigShip.taxCents).toBe(800)
  })

  it('rounds tax per seller, so a multi-seller total is the sum of each seller order', () => {
    // $0.06 each: 8% is 0.48 cents, rounding to 0 per seller, where the combined $0.12 would round to 1.
    const a = { ...listing('lst_x', 6, 0), sellerId: 'mike' }
    const b = { ...listing('lst_y', 6, 0), sellerId: 'sel_other' }
    const both = [a, b]
    const one = (id: string) => breakdown([{ listingId: id, qty: 1 }], both)
    const whole = breakdown(
      [
        { listingId: 'lst_x', qty: 1 },
        { listingId: 'lst_y', qty: 1 },
      ],
      both,
    )
    expect(whole.taxCents).toBe(0)
    expect(whole.totalCents).toBe(one('lst_x').totalCents + one('lst_y').totalCents)
  })

  it('throws on an unknown listing', () => {
    expect(() => breakdown([{ listingId: 'nope', qty: 1 }], [morgan])).toThrow()
  })
})

describe('sellerLedger (seller)', () => {
  const b = breakdown([{ listingId: 'lst_a', qty: 1 }], [morgan])

  it('matches the worked example: gross $1,812, commission $90, net $1,722', () => {
    expect(sellerLedger(b, 'shipped', 'none')).toMatchObject({
      grossCents: 181_200,
      commissionCents: 9_000,
      netCents: 172_200,
    })
  })

  it('excludes shipping and tax from the commission base', () => {
    const l = sellerLedger(
      {
        itemsCents: 10_000,
        shippingCents: 50_000,
        taxCents: 80_000,
        totalCents: 140_000,
      },
      'shipped',
      'none',
    )
    expect(l.commissionCents).toBe(500)
    expect(l.grossCents).toBe(60_000) // tax never the seller's
  })

  it('rounds commission to whole cents', () => {
    // 5% of $19.99 = 99.95¢ → 100¢
    const l = sellerLedger(
      { itemsCents: 1_999, shippingCents: 0, taxCents: 160, totalCents: 2_159 },
      'shipped',
      'none',
    )
    expect(l.commissionCents).toBe(100)
    expect(l.netCents).toBe(1_899)
  })

  it('balance: pending until shipped, available after, reversed only on a full refund', () => {
    expect(sellerLedger(b, 'unshipped', 'none').balance).toBe('pending')
    expect(sellerLedger(b, 'shipped', 'none').balance).toBe('available')
    expect(sellerLedger(b, 'received', 'none').balance).toBe('available')
    expect(sellerLedger(b, 'disputed', 'none').balance).toBe('available')
    expect(sellerLedger(b, 'disputed', 'succeeded').balance).toBe('reversed')
    expect(sellerLedger(b, 'unshipped', 'succeeded').balance).toBe('reversed')
  })

  it('pending and available keep commission and net; a full refund zeroes them, gross unchanged', () => {
    const projected = {
      grossCents: 181_200,
      commissionCents: 9_000,
      netCents: 172_200,
      refundedCents: 0,
    }
    expect(sellerLedger(b, 'unshipped', 'none')).toEqual({
      ...projected,
      balance: 'pending',
    })
    expect(sellerLedger(b, 'shipped', 'none')).toEqual({
      ...projected,
      balance: 'available',
    })
    expect(sellerLedger(b, 'disputed', 'succeeded')).toEqual({
      grossCents: 181_200,
      commissionCents: 0,
      netCents: 0,
      refundedCents: 195_600,
      balance: 'reversed',
    })
  })

  it('refunds are full only: any succeeded refund reverses, before or after shipping', () => {
    expect(sellerLedger(b, 'unshipped', 'succeeded')).toMatchObject({
      balance: 'reversed',
      netCents: 0,
      refundedCents: b.totalCents,
    })
    expect(sellerLedger(b, 'shipped', 'succeeded').balance).toBe('reversed')
  })

  it('a pending or failed refund does not reverse the balance', () => {
    expect(sellerLedger(b, 'disputed', 'pending').balance).toBe('available')
    expect(sellerLedger(b, 'disputed', 'failed').balance).toBe('available')
  })
})

import { expect, it } from 'vitest'
import {
  addToCart,
  clearCart,
  getCart,
  groupBySeller,
  switchCartOwner,
} from '../../src/lib/cart.ts'
import type { Listing } from '../../src/shared/types.ts'

// No localStorage in Node: the store falls back to an empty in-memory cart.
const l = (id: string, sellerId: string) => ({ id, sellerId }) as Listing
const listings = [l('a1', 'alex'), l('m1', 'mike'), l('a2', 'alex')]

it('groups lines by seller, keeping cart order and quantities', () => {
  const groups = groupBySeller(
    [
      { listingId: 'a1', qty: 2 },
      { listingId: 'm1', qty: 1 },
      { listingId: 'a2', qty: 5 },
    ],
    listings,
  )
  expect([...groups.keys()]).toEqual(['alex', 'mike'])
  expect(groups.get('alex')).toEqual([
    { listingId: 'a1', qty: 2 },
    { listingId: 'a2', qty: 5 },
  ])
  expect(groups.get('mike')).toEqual([{ listingId: 'm1', qty: 1 }])
})

it('drops lines for unknown listings and handles an empty cart', () => {
  expect(groupBySeller([{ listingId: 'gone', qty: 1 }], listings).size).toBe(0)
  expect(groupBySeller([], listings).size).toBe(0)
})

it('gives each account its own cart and carries a guest cart into sign-in', () => {
  const ids = () => getCart().map((l) => l.listingId)
  clearCart()
  addToCart('g1')
  switchCartOwner('guest', 'alex') // guest signs in as Alex
  addToCart('a1')
  expect(ids()).toEqual(['g1', 'a1'])
  switchCartOwner('alex', 'mike') // switch account
  expect(ids()).toEqual([])
  addToCart('m1')
  switchCartOwner('mike', 'guest') // sign out
  expect(ids()).toEqual([])
  addToCart('g2')
  switchCartOwner('guest', 'alex') // Alex's parked cart comes back, plus the new guest item
  expect(ids()).toEqual(['g1', 'a1', 'g2'])
  switchCartOwner('alex', 'mike')
  expect(ids()).toEqual(['m1'])
})

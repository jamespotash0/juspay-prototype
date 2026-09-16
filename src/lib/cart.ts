import { useSyncExternalStore } from 'react'
import type { CartLine, Listing } from '../shared/types.ts'
import { createStore } from './store.ts'

const store = createStore<CartLine[]>('slabbed.cart', [], (v) =>
  Array.isArray(v) ? (v as CartLine[]) : [],
)

export const getCart = store.get

export function useCart(): CartLine[] {
  return useSyncExternalStore(store.subscribe, store.get)
}

/** Adds qty to an existing line, or appends a new one. */
export function addToCart(listingId: string, qty = 1) {
  const lines = store.get()
  const existing = lines.find((l) => l.listingId === listingId)
  store.set(
    existing
      ? lines.map((l) => (l.listingId === listingId ? { ...l, qty: l.qty + qty } : l))
      : [...lines, { listingId, qty }],
  )
}

export function removeFromCart(listingId: string) {
  store.set(store.get().filter((l) => l.listingId !== listingId))
}

/** Clears the whole cart, or only the given listing ids (one paid seller group). */
export function clearCart(listingIds?: string[]) {
  store.set(
    listingIds ? store.get().filter((l) => !listingIds.includes(l.listingId)) : [],
  )
}

/** Groups lines by the seller of each listing, in cart order. Lines for unknown listings are dropped. */
export function groupBySeller(
  lines: CartLine[],
  listings: Listing[],
): Map<string, CartLine[]> {
  const groups = new Map<string, CartLine[]>()
  for (const line of lines) {
    const sellerId = listings.find((l) => l.id === line.listingId)?.sellerId
    if (!sellerId) continue
    groups.set(sellerId, [...(groups.get(sellerId) ?? []), line])
  }
  return groups
}

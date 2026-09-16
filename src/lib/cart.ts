import { useSyncExternalStore } from 'react'
import type { CartLine, Listing } from '../shared/types.ts'
import { createStore } from './store.ts'

const store = createStore<CartLine[]>('slabbed.cart', [], (v) =>
  Array.isArray(v) ? (v as CartLine[]) : [],
)

// Carts parked by owner (a persona id, or 'guest') while someone else is signed in.
const parked = createStore<Record<string, CartLine[]>>('slabbed.parkedCarts', {}, (v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, CartLine[]>)
    : {},
)

export const getCart = store.get

/**
 * Hands the cart to a new owner: parks the current one and loads theirs.
 * A guest's cart carries into sign-in, so checkout doesn't lose it; the guest is left empty.
 */
export function switchCartOwner(from: string, to: string) {
  if (from === to) return
  const { [to]: theirs = [], ...rest } = parked.get()
  const current = store.get()
  if (from === 'guest') {
    parked.set(rest)
    store.set([
      ...theirs,
      ...current.filter((c) => !theirs.some((t) => t.listingId === c.listingId)),
    ])
  } else {
    parked.set({ ...rest, [from]: current })
    store.set(theirs)
  }
}

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

/** What checkout charges for: lines that still exist, aren't sold, and aren't the buyer's own listings. */
export function checkoutLines(
  lines: CartLine[],
  listings: Listing[],
  sold: Set<string>,
  buyerId: string | undefined,
): CartLine[] {
  return lines.filter((line) => {
    const listing = listings.find((l) => l.id === line.listingId)
    return listing && !sold.has(listing.id) && listing.sellerId !== buyerId
  })
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

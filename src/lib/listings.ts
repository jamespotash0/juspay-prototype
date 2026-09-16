import { useSyncExternalStore } from 'react'
import { LISTINGS } from '../shared/seed.ts'
import type { Listing } from '../shared/types.ts'
import { removeFromCart } from './cart.ts'
import { createStore } from './store.ts'

const store = createStore<Listing[]>('slabbed.userListings', [], (v) =>
  Array.isArray(v) ? (v as Listing[]) : [],
)

// Seeded listings a seller removed in this browser. Created ones are simply deleted from `store`.
const removed = createStore<string[]>('slabbed.removedListings', [], (v) =>
  Array.isArray(v) ? (v as string[]) : [],
)

let cachedUser = store.get()
let cachedRemoved = removed.get()
let cachedAll = build()

function build() {
  return [...LISTINGS, ...cachedUser].filter((l) => !cachedRemoved.includes(l.id))
}

/** Seeded listings plus the ones created in this browser ('usr_…'), minus removed ones. Stable reference between changes. */
export function allListings(): Listing[] {
  if (store.get() !== cachedUser || removed.get() !== cachedRemoved) {
    cachedUser = store.get()
    cachedRemoved = removed.get()
    cachedAll = build()
  }
  return cachedAll
}

const subscribe = (listener: () => void) => {
  const a = store.subscribe(listener)
  const b = removed.subscribe(listener)
  return () => {
    a()
    b()
  }
}

export function userListings(): Listing[] {
  return store.get()
}

export function useListings(): Listing[] {
  return useSyncExternalStore(subscribe, allListings)
}

export function addUserListing(listing: Omit<Listing, 'id' | 'createdAt'>): Listing {
  const created: Listing = {
    ...listing,
    id: 'usr_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16),
    createdAt: new Date().toISOString(),
  }
  store.set([...store.get(), created])
  return created
}

/** Takes a listing down: it leaves the shop, search and this browser's cart. Past orders keep their own data. */
export function removeListing(id: string) {
  if (store.get().some((l) => l.id === id)) store.set(store.get().filter((l) => l.id !== id))
  else if (!removed.get().includes(id)) removed.set([...removed.get(), id])
  removeFromCart(id)
}

import { useSyncExternalStore } from 'react'
import { LISTINGS } from '../shared/seed.ts'
import type { Listing } from '../shared/types.ts'
import { createStore } from './store.ts'

const store = createStore<Listing[]>('slabbed.userListings', [], (v) =>
  Array.isArray(v) ? (v as Listing[]) : [],
)

let cachedUser = store.get()
let cachedAll = [...LISTINGS, ...cachedUser]

/** Seeded listings plus the ones created in this browser ('usr_…'). Stable reference between changes. */
export function allListings(): Listing[] {
  if (store.get() !== cachedUser) {
    cachedUser = store.get()
    cachedAll = [...LISTINGS, ...cachedUser]
  }
  return cachedAll
}

export function userListings(): Listing[] {
  return store.get()
}

export function useListings(): Listing[] {
  return useSyncExternalStore(store.subscribe, allListings)
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

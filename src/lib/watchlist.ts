import { useMemo, useSyncExternalStore } from 'react'
import { createStore } from './store.ts'

// Listings a buyer is watching, in this browser.
const store = createStore<string[]>('slabbed.watchlist', [], (v) =>
  Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [],
)

export function toggleWatch(listingId: string) {
  const ids = store.get()
  store.set(
    ids.includes(listingId) ? ids.filter((id) => id !== listingId) : [...ids, listingId],
  )
}

export function useWatchedIds(): Set<string> {
  const ids = useSyncExternalStore(store.subscribe, store.get)
  return useMemo(() => new Set(ids), [ids])
}

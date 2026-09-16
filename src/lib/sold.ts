import { useMemo, useSyncExternalStore } from 'react'
import { createStore } from './store.ts'

// Listings bought in this browser. Demo-only: another browser won't see them as sold.
const store = createStore<string[]>('slabbed.sold', [], (v) =>
  Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [],
)

export function markSold(listingIds: string[]) {
  const sold = store.get()
  const added = listingIds.filter((id) => !sold.includes(id))
  if (added.length) store.set([...sold, ...added])
}

export function isSold(id: string): boolean {
  return store.get().includes(id)
}

export function useSoldIds(): Set<string> {
  const ids = useSyncExternalStore(store.subscribe, store.get)
  return useMemo(() => new Set(ids), [ids])
}

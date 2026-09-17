import { useSyncExternalStore } from 'react'
import { PERSONAS } from '../shared/seed.ts'
import type { PersonaId, ShipTo } from '../shared/types.ts'
import { createStore } from './store.ts'

// This browser's profile: the name each demo account goes by, and a demo PayPal link.
const names = createStore<Record<string, string>>('slabbed.names', {}, (v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {},
)

const seededName = (id: PersonaId) => PERSONAS.find((p) => p.id === id)?.name ?? id

export function useDisplayName(id: PersonaId): string {
  const all = useSyncExternalStore(names.subscribe, names.get)
  return all[id] || seededName(id)
}

const paypal = createStore<Record<string, string>>('slabbed.paypal', {}, (v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {},
)

/** The PayPal email a demo account has linked, if any. Stored in this browser only. */
export function useLinkedPaypal(id: PersonaId): string | undefined {
  return useSyncExternalStore(paypal.subscribe, paypal.get)[id]
}

export function linkPaypal(id: PersonaId, email: string | null) {
  const { [id]: _old, ...rest } = paypal.get()
  paypal.set(email ? { ...rest, [id]: email } : rest)
}

/** An empty name goes back to the account's own. */
export function setDisplayName(id: PersonaId, name: string) {
  const { [id]: _old, ...rest } = names.get()
  const trimmed = name.trim().slice(0, 60)
  names.set(trimmed && trimmed !== seededName(id) ? { ...rest, [id]: trimmed } : rest)
}

/** Saved addresses for checkout. `billTo` null means billing is the same as shipping. */
export interface SavedAddresses {
  shipTo: ShipTo
  billTo: ShipTo | null
}

const addresses = createStore<Record<string, SavedAddresses>>(
  'slabbed.addresses',
  {},
  (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, SavedAddresses>)
      : {},
)

/** A demo address until the account saves its own, so checkout is never a blank form. */
const demoShipTo = (name: string): ShipTo => ({
  name,
  line1: '1 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
})

export function useSavedAddresses(id: PersonaId): SavedAddresses & { isSaved: boolean } {
  const name = useDisplayName(id)
  const saved = useSyncExternalStore(addresses.subscribe, addresses.get)[id]
  return saved
    ? { ...saved, isSaved: true }
    : { shipTo: demoShipTo(name), billTo: null, isSaved: false }
}

/** Stored in this browser only, like the rest of the demo profile. */
export function saveAddresses(id: PersonaId, next: SavedAddresses) {
  addresses.set({ ...addresses.get(), [id]: next })
}

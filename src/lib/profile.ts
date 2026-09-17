import { useSyncExternalStore } from 'react'
import { PERSONAS } from '../shared/seed.ts'
import type { PersonaId } from '../shared/types.ts'
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

import { useSyncExternalStore } from 'react'
import { PERSONAS } from '../shared/seed.ts'
import type { PersonaId } from '../shared/types.ts'
import { createStore } from './store.ts'

// This browser's profile: the name each demo account goes by, and whether a collector is
// buying or selling. Every collector does both, so the mode only changes what the app leads with.
export type Mode = 'buying' | 'selling'

const names = createStore<Record<string, string>>('slabbed.names', {}, (v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {},
)
const mode = createStore<Mode>('slabbed.mode', 'buying', (v) =>
  v === 'selling' ? 'selling' : 'buying',
)

const seededName = (id: PersonaId) => PERSONAS.find((p) => p.id === id)?.name ?? id

export function useDisplayName(id: PersonaId): string {
  const all = useSyncExternalStore(names.subscribe, names.get)
  return all[id] || seededName(id)
}

/** An empty name goes back to the account's own. */
export function setDisplayName(id: PersonaId, name: string) {
  const { [id]: _old, ...rest } = names.get()
  const trimmed = name.trim().slice(0, 60)
  names.set(trimmed && trimmed !== seededName(id) ? { ...rest, [id]: trimmed } : rest)
}

export const useMode = () => useSyncExternalStore(mode.subscribe, mode.get)
export function setMode(next: Mode) {
  if (mode.get() !== next) mode.set(next)
}

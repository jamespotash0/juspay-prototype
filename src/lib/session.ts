import { useSyncExternalStore } from 'react'
import type { PersonaId } from '../shared/types.ts'
import { createStore } from './store.ts'

const IDS: PersonaId[] = ['alex', 'mike', 'admin']

const store = createStore<PersonaId>('slabbed.persona', 'alex', (v) =>
  IDS.includes(v as PersonaId) ? (v as PersonaId) : 'alex',
)

export const getPersona = store.get
export const setPersona = store.set

export function usePersona(): PersonaId {
  return useSyncExternalStore(store.subscribe, store.get)
}

import { useSyncExternalStore } from 'react'
import type { PersonaId } from '../shared/types.ts'
import { createStore } from './store.ts'

export type AuthProvider = 'google' | 'apple' | 'email'
export type Session = { persona: PersonaId; provider: AuthProvider }

const IDS: PersonaId[] = ['alex', 'mike', 'admin']
const PROVIDERS: AuthProvider[] = ['google', 'apple', 'email']

// Mock sign-in: the "session" is just who you picked. A first-time visitor is signed out (null).
const store = createStore<Session | null>('slabbed.session', null, (v) => {
  const s = v as Partial<Session> | null
  return s && IDS.includes(s.persona!) && PROVIDERS.includes(s.provider!)
    ? { persona: s.persona!, provider: s.provider! }
    : null
})

export function useSession(): Session | null {
  return useSyncExternalStore(store.subscribe, store.get)
}

export function signIn(persona: PersonaId, provider: AuthProvider) {
  store.set({ persona, provider })
}

export function signOut() {
  store.set(null)
}

// ponytail: signed out falls back to 'alex' so public pages keep a PersonaId; guarded pages never see it.
export const getPersona = (): PersonaId => store.get()?.persona ?? 'alex'

/** Switch demo account without re-signing in. No-op while signed out. */
export function setPersona(persona: PersonaId) {
  const s = store.get()
  if (s && s.persona !== persona) store.set({ ...s, persona })
}

export function usePersona(): PersonaId {
  return useSyncExternalStore(store.subscribe, getPersona)
}

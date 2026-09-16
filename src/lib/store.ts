/**
 * A JSON value in localStorage with subscribers, shaped for useSyncExternalStore
 * (get() returns the same reference until the value changes). Syncs across tabs.
 */
export function createStore<T>(
  key: string,
  fallback: T,
  validate: (raw: unknown) => T = (v) => v as T,
) {
  const listeners = new Set<() => void>()
  let value = read()

  function read(): T {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : validate(JSON.parse(raw))
    } catch {
      return fallback
    }
  }

  // Guarded so modules importing a store (cart.ts) can be unit-tested in Node.
  globalThis.window?.addEventListener('storage', (e) => {
    if (e.key !== key && e.key !== null) return
    value = read()
    listeners.forEach((l) => l())
  })

  return {
    get: () => value,
    set(next: T) {
      value = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // storage unavailable: keep the in-memory value for this tab
      }
      listeners.forEach((l) => l())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

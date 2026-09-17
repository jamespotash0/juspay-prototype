import { useMemo, useSyncExternalStore } from 'react'

// A pushState router: enough for ten flat routes, no dependency. Components live in router.tsx.

export type Params = Record<string, string>

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
window.addEventListener('popstate', notify)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function navigate(to: string, { replace = false, scroll = true } = {}) {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  if (scroll) window.scrollTo(0, 0)
  notify()
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname)
}

/** Checkout is an overlay on the current page, so sign-in's `next` and the back button keep working. */
export const openCheckout = () =>
  navigate(`${location.pathname}?checkout`, { scroll: false })

/** The query string, re-rendering on navigate() and back/forward. Read-only: change it with navigate(). */
export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, () => location.search)
  return useMemo(() => new URLSearchParams(search), [search])
}

/** '/order/:paymentId' against '/order/cka_1' → { paymentId: 'cka_1' }, or null. */
export function matchPath(pattern: string, path: string): Params | null {
  const p = pattern.split('/')
  const s = (path.replace(/\/+$/, '') || '/').split('/')
  if (p.length !== s.length) return null
  const params: Params = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) {
      if (!s[i]) return null
      params[p[i].slice(1)] = decodeURIComponent(s[i])
    } else if (p[i] !== s[i]) return null
  }
  return params
}

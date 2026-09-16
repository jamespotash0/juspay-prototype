import {
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ComponentType,
  type MouseEvent,
} from 'react'

// A pushState router: enough for ten flat routes, no dependency.

export type Params = Record<string, string>
export type Route = { path: string; component: ComponentType<{ params: Params }> }

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
window.addEventListener('popstate', notify)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  window.scrollTo(0, 0)
  notify()
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname)
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

export function Router({
  routes,
  notFound: NotFound,
}: {
  routes: Route[]
  notFound: ComponentType
}) {
  const path = usePath()
  for (const { path: pattern, component: Page } of routes) {
    const params = matchPath(pattern, path)
    if (params) return <Page params={params} />
  }
  return <NotFound />
}

export function Link({
  to,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handleClick} {...rest} />
}

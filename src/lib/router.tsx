import { matchPath, navigate, usePath, type Params } from './navigation.ts'
import { type AnchorHTMLAttributes, type ComponentType, type MouseEvent } from 'react'

// Shim so pages importing these from router.tsx keep compiling. Import them from navigation.ts
// instead; delete this line once no page imports them from here.
/* oxlint-disable react/only-export-components */
export {
  matchPath,
  navigate,
  usePath,
  useSearchParams,
  type Params,
} from './navigation.ts'
/* oxlint-enable react/only-export-components */

export type Route = { path: string; component: ComponentType<{ params: Params }> }

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

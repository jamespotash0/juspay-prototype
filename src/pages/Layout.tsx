import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useCart } from '../lib/cart.ts'
import { navigate, usePath } from '../lib/router.tsx'
import { setPersona, usePersona } from '../lib/session.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { Listing } from '../shared/types.ts'
import { TopBar } from '../ui/TopBar.tsx'

// The router only re-renders on a pathname change, so a ?q= change announces
// itself as a popstate (the router listens to that too).
// ponytail: popstate stand-in; swap for a router useSearch() if one is added.
function subscribeSearch(listener: () => void) {
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}

/** The current ?q= search, re-rendering when it changes. */
export function useSearchQuery(): string {
  const search = useSyncExternalStore(subscribeSearch, () => location.search)
  return new URLSearchParams(search).get('q') ?? ''
}

export function setSearchQuery(q: string) {
  const to = q ? `/?q=${encodeURIComponent(q)}` : '/'
  const onHome = location.pathname === '/'
  if (onHome) history.replaceState(null, '', to)
  else {
    refocusSearch = true // the page swaps under the input; put the caret back
    navigate(to)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
  if (!q) {
    const input = document.getElementById('topbar-search') as HTMLInputElement | null
    if (input && document.activeElement !== input) input.value = ''
  }
}

let refocusSearch = false

/** "PCGS MS-65", without doubling a service the grade already names ("PSA 9"). */
export function gradeLabel(l: Listing): string {
  if (!l.graded) return 'Raw'
  if (l.service && l.grade?.startsWith(l.service)) return l.grade
  return [l.service, l.grade].filter(Boolean).join(' ')
}

export function PageLayout({ children, title }: { children: ReactNode; title?: string }) {
  const path = usePath()
  const persona = usePersona()
  const cart = useCart()
  const q = useSearchQuery()
  const isAdmin = PERSONAS.find((p) => p.id === persona)?.kind === 'admin'

  useEffect(() => {
    document.title = title ? `${title} · Slabbed` : 'Slabbed'
  }, [title])

  useEffect(() => {
    if (!refocusSearch) return
    refocusSearch = false
    const input = document.getElementById('topbar-search') as HTMLInputElement | null
    input?.focus()
    input?.setSelectionRange(input.value.length, input.value.length)
  }, [])

  const links = (
    isAdmin
      ? [{ label: 'Admin', href: '/admin' }]
      : [
          { label: 'Shop', href: '/' },
          { label: 'Orders', href: '/orders' },
          { label: 'Sell', href: '/sell' },
        ]
  ).map((l) => ({
    ...l,
    current: l.href === '/' ? path === '/' : path.startsWith(l.href),
  }))

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        personas={PERSONAS}
        activePersonaId={persona}
        onPersonaChange={setPersona}
        onSearch={setSearchQuery}
        searchValue={q}
        links={links}
        cartCount={cart.reduce((n, l) => n + l.qty, 0)}
        onNavigate={navigate}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-16">
        {title && (
          <h1 className="mb-5 font-display text-2xl font-bold tracking-tight">{title}</h1>
        )}
        {children}
      </main>
      <footer className="border-t border-rule">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-ink-muted">
          {/* Local copy: requested for copy.ts */}A demo marketplace. Sellers, listings,
          photos and ratings are synthetic; payments are real Hyperswitch sandbox
          payments.
        </p>
      </footer>
    </div>
  )
}

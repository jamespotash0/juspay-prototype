import { useEffect, type ReactNode } from 'react'
import { useCart } from '../lib/cart.ts'
import { navigate, usePath, useSearchParams } from '../lib/navigation.ts'
import { setPersona, usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import { TopBar } from '../ui/TopBar.tsx'

// Typing on another page takes you to the catalogue; the page swaps under the input, so put the caret back.
let refocusSearch = false

function search(q: string) {
  const onHome = location.pathname === '/'
  if (!onHome) refocusSearch = true
  navigate(q ? `/?q=${encodeURIComponent(q)}` : '/', { replace: onHome })
}

export function PageLayout({ children, title }: { children: ReactNode; title?: string }) {
  const path = usePath()
  const persona = usePersona()
  const cart = useCart()
  const q = useSearchParams().get('q') ?? ''
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
      ? [{ label: COPY.shell.admin, href: '/admin' }]
      : [
          { label: COPY.shell.shop, href: '/' },
          { label: COPY.shell.orders, href: '/orders' },
          { label: COPY.shell.sell, href: '/sell' },
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
        onSearch={search}
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
          {COPY.shell.footer}
        </p>
      </footer>
    </div>
  )
}

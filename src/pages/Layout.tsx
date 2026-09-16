import { useEffect, type ReactNode } from 'react'
import { useCart } from '../lib/cart.ts'
import { navigate, usePath, useSearchParams } from '../lib/navigation.ts'
import { resetDemo } from '../lib/reset.ts'
import { signIn, signOut, useSession } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { PersonaId } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { TopBar } from '../ui/TopBar.tsx'

const ADMIN_ONLY = /^\/admin(\/|$)/
const COLLECTOR_ONLY = /^\/(orders|sell|checkout)(\/|$)/

export function PageLayout({
  children,
  title,
  back,
}: {
  children: ReactNode
  title?: string
  /** A back link, drawn above the heading so it reads before the title. */
  back?: ReactNode
}) {
  const path = usePath()
  const session = useSession()
  const cart = useCart()
  const params = useSearchParams()
  const isAdmin = PERSONAS.find((p) => p.id === session?.persona)?.kind === 'admin'

  function switchAccount(persona: PersonaId) {
    if (!session) return
    const toAdmin = persona === 'admin'
    // Stay put unless the new account can't use this page.
    if (toAdmin ? COLLECTOR_ONLY.test(path) : ADMIN_ONLY.test(path)) navigate('/')
    signIn(persona, session.provider)
  }

  function leave() {
    // Home first, so a guarded page doesn't bounce to /signin as the session clears.
    navigate('/')
    signOut()
  }

  useEffect(() => {
    document.title = title ? `${title} · Slabbed` : 'Slabbed'
  }, [title])

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
        activePersonaId={session?.persona ?? null}
        onPersonaChange={switchAccount}
        onSignOut={leave}
        onSignIn={() => {
          const here = path + (params.size ? `?${params}` : '')
          navigate(`/signin?next=${encodeURIComponent(here)}`)
        }}
        links={links}
        cartCount={cart.reduce((n, l) => n + l.qty, 0)}
        onNavigate={navigate}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-16">
        {back && <div className="mb-3">{back}</div>}
        {title && (
          <h1 className="mb-5 font-display text-2xl font-bold tracking-tight">{title}</h1>
        )}
        {children}
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-end sm:gap-6">
          <div className="flex items-center gap-3 sm:max-w-md">
            <Button variant="secondary" className="h-8 shrink-0 px-3" onClick={resetDemo}>
              {COPY.shell.reset}
            </Button>
            <p>{COPY.shell.resetBody}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

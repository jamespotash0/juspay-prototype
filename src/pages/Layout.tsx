import { useEffect, type ReactNode } from 'react'
import { useCart } from '../lib/cart.ts'
import { navigate, usePath, useSearchParams } from '../lib/navigation.ts'
import { resetDemo } from '../lib/reset.ts'
import { signIn, signOut, useSession } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { PersonaId } from '../shared/types.ts'
import { TopBar } from '../ui/TopBar.tsx'

export function PageLayout({
  children,
  title,
  back,
  width = 'wide',
  eyebrow,
  actions,
}: {
  children: ReactNode
  title?: string
  /** A back link, drawn above the heading so it reads before the title. */
  back?: ReactNode
  /** 'narrow' centres a max-w-3xl column (detail pages); 'wide' is the full container. */
  width?: 'wide' | 'narrow'
  /** Small tracked uppercase line above the title. Only drawn with a title. */
  eyebrow?: string
  /** Right-aligned beside the title (a sort select, a primary action). */
  actions?: ReactNode
}) {
  const path = usePath()
  const session = useSession()
  const cart = useCart()
  const params = useSearchParams()
  const isAdmin = PERSONAS.find((p) => p.id === session?.persona)?.kind === 'admin'

  function switchAccount(persona: PersonaId) {
    if (!session) return
    // A different account starts fresh on its home page, like signing out and back in.
    navigate(persona === 'admin' ? '/admin' : '/')
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
        onReset={resetDemo}
        links={links}
        cartCount={cart.reduce((n, l) => n + l.qty, 0)}
        onNavigate={navigate}
      />
      <main className="w-full flex-1 px-4 pt-5 pb-14 sm:px-6 sm:pt-8 sm:pb-20">
        <div
          className={`mx-auto w-full ${width === 'narrow' ? 'max-w-3xl' : 'max-w-7xl'}`}
        >
          {back && <div className="mb-3">{back}</div>}
          {title && (
            <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6">
              <div className="min-w-0">
                {eyebrow && (
                  <p className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">
                    {eyebrow}
                  </p>
                )}
                <h1 className="text-2xl font-bold tracking-tight sm:text-[1.875rem] sm:leading-tight">
                  {title}
                </h1>
              </div>
              {actions && (
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
              )}
            </header>
          )}
          {children}
        </div>
      </main>
      <footer className="px-4 pb-6 sm:px-6">
        <p className="mx-auto max-w-7xl text-xs text-ink-muted">{COPY.shell.footer}</p>
      </footer>
    </div>
  )
}

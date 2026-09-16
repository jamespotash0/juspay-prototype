import type { MouseEvent } from 'react'
import { COPY } from '../shared/copy'
import { Icon } from './Icon'
import type { Persona, PersonaId } from '../shared/types'

export interface NavLink {
  label: string
  href: string
  current?: boolean
}

interface TopBarProps {
  personas: Persona[]
  /** null while signed out: the bar shows a Sign in button instead of the account area. */
  activePersonaId: PersonaId | null
  onPersonaChange: (id: PersonaId) => void
  onSignOut: () => void
  onSignIn: () => void
  links: NavLink[]
  cartCount: number
  cartHref?: string
  homeHref?: string
  /** If given, links call this instead of a full page load (client-side routing). */
  onNavigate?: (href: string) => void
}

const S = COPY.shell

// Desktop: one row — wordmark, links, account, cart. Search lives on the catalogue, beside its filters.
// Below sm: row 1 wordmark · links · cart; row 2 account. Nothing is hidden.
export function TopBar({
  personas,
  activePersonaId,
  onPersonaChange,
  onSignOut,
  onSignIn,
  links,
  cartCount,
  cartHref = '/cart',
  homeHref = '/',
  onNavigate,
}: TopBarProps) {
  const go = (href: string) => (e: MouseEvent) => {
    if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    onNavigate(href)
  }

  return (
    <header className="sticky top-0 z-10 border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:gap-x-6">
        <a
          href={homeHref}
          onClick={go(homeHref)}
          className="order-1 font-display text-lg sm:order-none font-bold tracking-tight sm:text-xl"
        >
          {S.wordmark}
        </a>

        <nav className="order-2 ml-auto flex items-center gap-4 text-sm sm:order-none">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={go(l.href)}
              aria-current={l.current ? 'page' : undefined}
              className="font-medium text-ink hover:text-accent aria-[current=page]:underline"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {activePersonaId ? (
          <div className="order-5 flex shrink-0 items-center gap-3 sm:order-none">
            {/* The select shows the signed-in name; switching keeps the provider. */}
            <label className="sr-only" htmlFor="topbar-persona">
              {S.switchAccount}
            </label>
            <select
              id="topbar-persona"
              value={activePersonaId}
              onChange={(e) => onPersonaChange(e.target.value as PersonaId)}
              className="h-9 rounded-slab border border-rule bg-paper px-2 text-sm font-medium text-accent hover:border-accent"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id} title={S.personaRole[p.id].long}>
                  {p.name} · {S.personaRole[p.id].short}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSignOut}
              className="text-sm font-medium whitespace-nowrap text-accent hover:underline"
            >
              {S.signOut}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="order-5 inline-flex h-9 shrink-0 items-center rounded-slab border border-accent px-3 text-sm font-semibold text-accent hover:bg-accent/5 sm:order-none"
          >
            {S.signIn}
          </button>
        )}

        <a
          href={cartHref}
          onClick={go(cartHref)}
          className="order-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent sm:order-none"
        >
          <Icon name="cart" className="size-4" />
          {S.cart}
          <span
            aria-label={`${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
            className={`money inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${cartCount > 0 ? 'bg-accent text-accent-ink' : 'border border-rule text-ink-muted'}`}
          >
            {cartCount}
          </span>
        </a>
      </div>
    </header>
  )
}

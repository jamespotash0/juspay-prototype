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
  /** Clears this browser's demo state. The bar asks for confirmation first. */
  onReset: () => void
  links: NavLink[]
  cartCount: number
  cartHref?: string
  homeHref?: string
  /** If given, links call this instead of a full page load (client-side routing). */
  onNavigate?: (href: string) => void
}

const S = COPY.shell

const PILL =
  'inline-flex h-8 shrink-0 items-center rounded-full border border-rule-strong bg-paper text-sm font-medium text-ink transition-colors hover:border-ink'

// Desktop: one row — wordmark, links, account, cart, reset. Search lives on the catalogue.
// Below sm: row 1 wordmark · links · cart · reset; row 2 account. Nothing is hidden.
export function TopBar({
  personas,
  activePersonaId,
  onPersonaChange,
  onSignOut,
  onSignIn,
  onReset,
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
    <header className="sticky top-0 z-10 border-b px-4 sm:px-6 border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1.5 gap-y-1.5 py-2 sm:flex-nowrap sm:gap-x-3">
        <a
          href={homeHref}
          onClick={go(homeHref)}
          className="order-1 inline-flex items-center gap-1.5 font-wordmark text-base font-bold tracking-tight sm:order-none sm:mr-3 sm:text-lg"
        >
          <img src="/favicon.svg" alt="" aria-hidden="true" className="h-[1.25em] w-auto" />
          {S.wordmark}
        </a>

        <nav className="order-2 ml-auto flex items-center text-sm sm:order-none sm:mr-auto sm:ml-0 sm:gap-0.5">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={go(l.href)}
              aria-current={l.current ? 'page' : undefined}
              className="inline-flex h-8 items-center rounded-full px-2 font-medium text-ink-muted sm:px-3.5 transition-colors hover:text-ink aria-[current=page]:bg-bone aria-[current=page]:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {activePersonaId ? (
          <div className="order-5 flex min-w-0 items-center gap-1 max-sm:w-full sm:order-none">
            {/* The select shows the signed-in name; switching keeps the provider. */}
            <label className="sr-only" htmlFor="topbar-persona">
              {S.switchAccount}
            </label>
            <span className="relative inline-flex min-w-0">
              <select
                id="topbar-persona"
                value={activePersonaId}
                onChange={(e) => onPersonaChange(e.target.value as PersonaId)}
                className={`${PILL} min-w-0 cursor-pointer appearance-none truncate pr-8 pl-3.5`}
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id} title={S.personaRole[p.id].long}>
                    {p.name} · {S.personaRole[p.id].short}
                  </option>
                ))}
              </select>
              <Icon
                name="chevronDown"
                className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-muted"
              />
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors hover:bg-bone hover:text-ink"
            >
              {S.signOut}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className={`${PILL} order-5 px-4 font-semibold sm:order-none`}
          >
            {S.signIn}
          </button>
        )}

        <a
          href={cartHref}
          onClick={go(cartHref)}
          className={`${PILL} order-3 gap-1.5 pr-1.5 pl-2.5 sm:order-none sm:pl-3`}
        >
          <Icon name="cart" className="size-4" />
          <span className="max-sm:sr-only">{S.cart}</span>
          <span
            aria-label={`${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
            className={`money inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${cartCount > 0 ? 'bg-primary text-primary-ink' : 'bg-bone text-ink-muted'}`}
          >
            {cartCount}
          </span>
        </a>

        {/* Reset demo: an icon with a hover and focus tooltip, confirmed before it runs. */}
        <span className="group relative order-4 inline-flex sm:order-none">
          <button
            type="button"
            aria-label={S.reset}
            aria-describedby="topbar-reset-tip"
            onClick={() => {
              if (window.confirm(S.resetConfirm)) onReset()
            }}
            className={`${PILL} size-8 justify-center text-ink-muted hover:text-ink`}
          >
            <Icon name="refresh" className="size-4" />
          </button>
          <span
            id="topbar-reset-tip"
            role="tooltip"
            className="pointer-events-none invisible absolute top-full right-0 z-20 mt-2 w-64 rounded-control bg-primary px-3 py-2 text-xs leading-relaxed text-primary-ink opacity-0 shadow-pop transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
          >
            <span className="block font-semibold">{S.reset}</span>
            {S.resetBody}
          </span>
        </span>
      </div>
    </header>
  )
}

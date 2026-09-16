import type { MouseEvent } from 'react'
import { COPY } from '../shared/copy'
import type { Persona, PersonaId } from '../shared/types'

export interface NavLink {
  label: string
  href: string
  current?: boolean
}

interface TopBarProps {
  personas: Persona[]
  activePersonaId: PersonaId
  onPersonaChange: (id: PersonaId) => void
  onSearch: (query: string) => void
  searchValue: string
  links: NavLink[]
  cartCount: number
  cartHref?: string
  homeHref?: string
  /** If given, links call this instead of a full page load (client-side routing). */
  onNavigate?: (href: string) => void
}

const S = COPY.shell

// Desktop: one row — wordmark, search, links, persona, cart.
// Below sm: row 1 wordmark · links · cart; row 2 search · persona. Nothing is hidden.
export function TopBar({
  personas,
  activePersonaId,
  onPersonaChange,
  onSearch,
  searchValue,
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

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="order-4 min-w-0 grow basis-1/2 sm:order-none sm:mx-auto sm:max-w-md sm:basis-auto"
        >
          <label className="sr-only" htmlFor="topbar-search">
            {S.searchLabel}
          </label>
          <input
            id="topbar-search"
            type="search"
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={S.searchPlaceholder}
            className="h-9 w-full rounded-slab border border-rule bg-bone px-3 text-sm placeholder:text-ink-muted focus-visible:border-accent"
          />
        </form>

        <nav className="order-2 ml-auto flex items-center gap-4 text-sm sm:order-none sm:ml-0">
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

        <label className="sr-only" htmlFor="topbar-persona">
          {S.signedInAs}
        </label>
        <select
          id="topbar-persona"
          value={activePersonaId}
          onChange={(e) => onPersonaChange(e.target.value as PersonaId)}
          className="order-5 h-9 max-w-40 shrink-0 rounded-slab border border-rule bg-paper px-2 text-sm font-medium text-accent hover:border-accent sm:order-none sm:max-w-none"
        >
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {/* "Slabbed Admin" already names the role; no suffix, so it fits at 390px. */}
              {p.name}
            </option>
          ))}
        </select>

        <a
          href={cartHref}
          onClick={go(cartHref)}
          className="order-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent sm:order-none"
        >
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

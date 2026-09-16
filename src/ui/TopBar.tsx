import type { MouseEvent } from 'react'
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
  searchValue?: string
  links: NavLink[]
  cartCount: number
  cartHref?: string
  homeHref?: string
  /** If given, links call this instead of a full page load (client-side routing). */
  onNavigate?: (href: string) => void
}

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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:flex-nowrap">
        <a
          href={homeHref}
          onClick={go(homeHref)}
          className="font-display text-xl font-bold tracking-tight"
        >
          Slabbed
        </a>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="order-last w-full sm:order-none sm:mx-auto sm:max-w-md"
        >
          <label className="sr-only" htmlFor="topbar-search">
            Search listings
          </label>
          <input
            id="topbar-search"
            type="search"
            defaultValue={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by title, grade or cert number"
            className="h-9 w-full rounded-slab border border-rule bg-bone px-3 text-sm placeholder:text-ink-muted focus-visible:border-accent"
          />
        </form>

        <nav className="ml-auto flex items-center gap-4 text-sm sm:ml-0">
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

          <label className="sr-only" htmlFor="topbar-persona">
            Signed in as
          </label>
          <select
            id="topbar-persona"
            value={activePersonaId}
            onChange={(e) => onPersonaChange(e.target.value as PersonaId)}
            className="h-9 rounded-slab border border-rule bg-paper px-2 text-sm font-medium text-accent hover:border-accent"
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.kind === 'admin' ? ' (admin)' : ''}
              </option>
            ))}
          </select>

          <a
            href={cartHref}
            onClick={go(cartHref)}
            className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent"
          >
            Cart
            <span
              aria-label={`${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
              className={`money inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${cartCount > 0 ? 'bg-accent text-accent-ink' : 'border border-rule text-ink-muted'}`}
            >
              {cartCount}
            </span>
          </a>
        </nav>
      </div>
    </header>
  )
}

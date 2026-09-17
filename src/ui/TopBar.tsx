import { useEffect, useRef, type MouseEvent } from 'react'
import { COPY } from '../shared/copy'
import { Icon } from './Icon'

export interface NavLink {
  label: string
  href: string
  current?: boolean
}

interface TopBarProps {
  /** null while signed out: the bar shows a Sign in button instead of the account link. */
  account: { name: string } | null
  accountHref?: string
  /** True on the account page itself. */
  accountCurrent?: boolean
  onSignIn: () => void
  onSignOut: () => void
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

// One row at every width: wordmark, links, then the cart and the account menu at the far right.
export function TopBar({
  account,
  accountHref = '/account',
  accountCurrent,
  onSignIn,
  onSignOut,
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
      <div className="mx-auto flex max-w-7xl items-center gap-x-1.5 py-2 sm:gap-x-3">
        <a
          href={homeHref}
          onClick={go(homeHref)}
          className="inline-flex items-center gap-1.5 font-wordmark text-base font-bold tracking-tight sm:mr-3 sm:text-lg"
        >
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="h-[1.25em] w-auto"
          />
          <span className="max-[400px]:sr-only">{S.wordmark}</span>
        </a>

        <nav className="mr-auto flex min-w-0 items-center text-sm sm:gap-0.5">
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

        <a
          href={cartHref}
          onClick={go(cartHref)}
          className={`${PILL} gap-1.5 pr-1.5 pl-2.5 sm:pl-3`}
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

        {account ? (
          <AccountMenu
            name={account.name}
            href={accountHref}
            current={accountCurrent}
            go={go}
            onSignOut={onSignOut}
          />
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className={`${PILL} px-4 font-semibold`}
          >
            {S.signIn}
          </button>
        )}
      </div>
    </header>
  )
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')

/** Initials in a circle with a chevron; opens Account and Sign out. Native <details>, closed by Escape or a click outside. */
function AccountMenu({
  name,
  href,
  current,
  go,
  onSignOut,
}: {
  name: string
  href: string
  current?: boolean
  go: (href: string) => (e: MouseEvent) => void
  onSignOut: () => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current
      if (!el?.open) return
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)
      )
        el.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])
  const shut = () => ref.current && (ref.current.open = false)

  return (
    <details ref={ref} className="group relative">
      <summary
        aria-label={`${S.account}: ${name}`}
        className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-full pr-1 hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-ink ring-offset-2 ring-offset-paper ${current ? 'ring-2 ring-ink' : ''}`}
        >
          {initials(name)}
        </span>
        <Icon
          name="chevronDown"
          className="size-3.5 text-ink-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-control border border-rule bg-paper p-1.5 shadow-pop">
        <p className="truncate px-2.5 pt-1.5 pb-2 text-sm font-semibold">{name}</p>
        <a
          href={href}
          onClick={(e) => {
            shut()
            go(href)(e)
          }}
          aria-current={current ? 'page' : undefined}
          className="block rounded-control px-2.5 py-2 text-sm hover:bg-well aria-[current=page]:font-semibold"
        >
          {S.account}
        </a>
        <button
          type="button"
          onClick={() => {
            shut()
            onSignOut()
          }}
          className="block w-full rounded-control px-2.5 py-2 text-left text-sm text-ink-muted hover:bg-well hover:text-ink"
        >
          {S.signOut}
        </button>
      </div>
    </details>
  )
}

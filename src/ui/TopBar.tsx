import type { MouseEvent } from 'react'
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

// Desktop: one row — wordmark, links, then account and the cart at the far right.
// Below sm: row 1 wordmark · links · cart; row 2 account. Nothing is hidden.
export function TopBar({
  account,
  accountHref = '/account',
  accountCurrent,
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
    <header className="sticky top-0 z-10 border-b px-4 sm:px-6 border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1.5 gap-y-1.5 py-2 sm:flex-nowrap sm:gap-x-3">
        <a
          href={homeHref}
          onClick={go(homeHref)}
          className="order-1 inline-flex items-center gap-1.5 font-wordmark text-base font-bold tracking-tight sm:order-none sm:mr-3 sm:text-lg"
        >
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="h-[1.25em] w-auto"
          />
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

        {account ? (
          <div className="order-5 flex min-w-0 items-center gap-1.5 max-sm:w-full sm:order-none">
            <a
              href={accountHref}
              onClick={go(accountHref)}
              aria-current={accountCurrent ? 'page' : undefined}
              aria-label={`${S.account}: ${account.name}`}
              className={`${PILL} min-w-0 gap-2 pr-3.5 pl-1 aria-[current=page]:border-ink`}
            >
              <span
                aria-hidden="true"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-bone text-xs font-semibold"
              >
                {account.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{account.name}</span>
            </a>
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
      </div>
    </header>
  )
}

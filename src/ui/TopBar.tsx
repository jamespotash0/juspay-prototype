import type { MouseEvent } from 'react'
import { COPY } from '../shared/copy'
import { Icon } from './Icon'
import type { Mode } from '../lib/profile'

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
  /** Collectors only: whether the app leads with buying or selling. */
  mode?: Mode
  onModeChange?: (mode: Mode) => void
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
  account,
  accountHref = '/account',
  accountCurrent,
  mode,
  onModeChange,
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
            {mode && onModeChange && (
              <div
                role="group"
                aria-label={S.modeLabel}
                className="flex shrink-0 rounded-full border border-rule-strong bg-paper p-0.5 text-[13px]"
              >
                {(['buying', 'selling'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => onModeChange(m)}
                    className="h-6.5 rounded-full px-3 font-medium text-ink-muted hover:text-ink aria-pressed:bg-primary aria-pressed:text-primary-ink"
                  >
                    {m === 'buying' ? S.buying : S.selling}
                  </button>
                ))}
              </div>
            )}
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

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.tsx'

/**
 * An overlay over the current page (checkout, adding a payment method). A fixed layer in a portal rather than <dialog showModal>: the
 * Hyperswitch SDK appends its own full-screen iframes to <body>, and the top layer would cover them.
 * #root goes inert instead, so focus and screen readers stay in here.
 */
export function Sheet({
  title,
  closeLabel,
  onClose,
  locked = false,
  children,
}: {
  title: string
  closeLabel: string
  onClose(): void
  locked?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = document.getElementById('root')!
    const html = document.documentElement
    const before = document.activeElement as HTMLElement | null
    root.inert = true
    html.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      root.inert = false
      html.style.overflow = ''
      before?.focus()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && !locked && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && !locked && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-card bg-paper pb-[env(safe-area-inset-bottom,0px)] text-ink shadow-pop outline-none sm:max-h-[90dvh] sm:max-w-lg sm:rounded-card"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-paper px-5 pt-5 pb-3 sm:px-6">
          <h2 id="sheet-title" className="text-xl font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label={closeLabel}
            className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-well hover:text-ink disabled:opacity-40"
          >
            <Icon name="cross" className="size-5" />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

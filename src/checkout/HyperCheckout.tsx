import { loadHyper, type HyperInstance } from '@juspay-tech/hyper-js'
import { HyperElements, UnifiedCheckout, useHyper } from '@juspay-tech/react-hyper-js'
import { useMemo, useState, type FormEvent } from 'react'
import { COPY } from '../shared/copy.ts'
import { Button } from '../ui/Button.tsx'
import { Money } from '../ui/Money.tsx'

interface Props {
  clientSecret: string
  publishableKey: string
  paymentId: string
  /** Server-set total from the checkout session, shown on the Pay button. */
  totalCents?: number
  /** Payment handed to Hyperswitch without a redirect. Go to /order/<paymentId>; the server read decides. */
  onSubmitted(): void
  /** Nothing was submitted (e.g. an incomplete card field). Stay on the page. */
  onError(message: string): void
  /** true just before confirmPayment; false if it returns without leaving the page (e.g. a validation error). */
  onSubmittingChange?: (submitting: boolean) => void
  /** 'save': a $0 payment on the account page that only stores a card. No wallets, no saved-card list. */
  purpose?: 'pay' | 'save'
  /** Where a redirect comes back to. Defaults to this payment's order page. */
  returnUrl?: string
}

// HyperLoader.js may only be added once per page, so one promise per key.
const loaders = new Map<string, Promise<HyperInstance>>()
function hyperFor(key: string) {
  if (!loaders.has(key)) loaders.set(key, loadHyper(key))
  return loaders.get(key)!
}

/** Card data stays inside the SDK iframe. We never read the outcome client-side. */
export default function HyperCheckout(props: Props) {
  // react-hyper-js (dist/bundle.js) re-runs hyper.elements() whenever `options` changes identity,
  // which tears down and rebuilds the card iframes. A fresh object each render meant clicking Pay
  // (which sets state) wiped the card fields before confirm. Keep it stable per client secret.
  const options = useMemo(
    () => ({ clientSecret: props.clientSecret }),
    [props.clientSecret],
  )
  return (
    <HyperElements hyper={hyperFor(props.publishableKey)} options={options}>
      <PayForm {...props} />
    </HyperElements>
  )
}

function PayForm({
  paymentId,
  totalCents,
  onSubmitted,
  onError,
  onSubmittingChange,
  purpose = 'pay',
  returnUrl = `${location.origin}/order/${paymentId}`,
}: Props) {
  const hyper = useHyper()
  const [busy, setBusy] = useState(false)
  // react-hyper-js calls elements.create() on every render of UnifiedCheckout, which restarts the
  // SDK iframes. Build the element once per payment so submit-time state changes can't reset it.
  const element = useMemo(
    () => (
      <UnifiedCheckout
        id="unified-checkout"
        options={
          purpose === 'save'
            ? {
                // Only a new card: saving is the whole point, so no wallets and no saved-card list.
                wallets: { walletReturnUrl: returnUrl, payPal: 'never' },
                displaySavedPaymentMethodsCheckbox: false,
                displaySavedPaymentMethods: false,
              }
            : {
                // Wallets (PayPal) confirm inside the SDK; without this they send return_url "" and 400.
                wallets: { walletReturnUrl: returnUrl },
                // "Save card" checkbox (unticked by default) and this buyer's saved cards. Consent is the tick.
                displaySavedPaymentMethodsCheckbox: true,
                displaySavedPaymentMethods: true,
              }
        }
      />
    ),
    [purpose, returnUrl],
  )

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    onSubmittingChange?.(true)
    try {
      // Redirects (PayPal) leave the page and come back to return_url, the same order page.
      const result = await hyper.confirmPayment({
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      })
      if (result?.error?.type === 'validation_error') {
        onError(result.error.message ?? 'Check your card details.')
        setBusy(false)
        onSubmittingChange?.(false)
        return
      }
      onSubmitted()
    } catch {
      // Unknown whether it went through: the order page reads the truth.
      onSubmitted()
    }
  }

  return (
    <form onSubmit={submit}>
      {element}
      <Button type="submit" disabled={busy} className="mt-4 w-full">
        {busy ? (
          COPY.checkout.submitting
        ) : purpose === 'save' ? (
          COPY.account.saveCard
        ) : totalCents === undefined ? (
          'Pay'
        ) : (
          <>
            Pay <Money cents={totalCents} />
          </>
        )}
      </Button>
    </form>
  )
}

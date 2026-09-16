import { loadHyper, type HyperInstance } from '@juspay-tech/hyper-js'
import { HyperElements, UnifiedCheckout, useHyper } from '@juspay-tech/react-hyper-js'
import { useState, type FormEvent } from 'react'
import { COPY } from '../shared/copy.ts'
import { Button } from '../ui/Button.tsx'

interface Props {
  clientSecret: string
  publishableKey: string
  paymentId: string
  /** Payment handed to Hyperswitch without a redirect. Go to /order/<paymentId>; the server read decides. */
  onSubmitted(): void
  /** Nothing was submitted (e.g. an incomplete card field). Stay on the page. */
  onError(message: string): void
  /** true just before confirmPayment; false if it returns without leaving the page (e.g. a validation error). */
  onSubmittingChange?: (submitting: boolean) => void
}

// HyperLoader.js may only be added once per page, so one promise per key.
const loaders = new Map<string, Promise<HyperInstance>>()
function hyperFor(key: string) {
  if (!loaders.has(key)) loaders.set(key, loadHyper(key))
  return loaders.get(key)!
}

/** Card data stays inside the SDK iframe. We never read the outcome client-side. */
export default function HyperCheckout(props: Props) {
  return (
    <HyperElements
      hyper={hyperFor(props.publishableKey)}
      options={{ clientSecret: props.clientSecret }}
    >
      <PayForm {...props} />
    </HyperElements>
  )
}

function PayForm({ paymentId, onSubmitted, onError, onSubmittingChange }: Props) {
  const hyper = useHyper()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    onSubmittingChange?.(true)
    try {
      // 3DS and other redirects leave the page and come back to return_url, the same order page.
      const result = await hyper.confirmPayment({
        confirmParams: { return_url: `${location.origin}/order/${paymentId}` },
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
      <UnifiedCheckout id="unified-checkout" options={{}} />
      <Button type="submit" disabled={busy} className="mt-4 w-full">
        {busy ? COPY.checkout.submitting : 'Pay'}
      </Button>
    </form>
  )
}

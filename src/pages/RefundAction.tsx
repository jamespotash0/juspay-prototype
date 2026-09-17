import { useState } from 'react'
import { api } from '../lib/api.ts'
import { COPY } from '../shared/copy.ts'
import type { OrderView, PersonaId } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { personName, usd } from '../ui/format.ts'

const A = COPY.orderActions

/** The seller's refund: always this order in full, confirmed first. Used on the sales list and the order page. */
export function RefundAction({
  order,
  sellerId,
  onChange,
  size = 'md',
}: {
  order: OrderView
  sellerId: PersonaId
  onChange: (o: OrderView) => void
  size?: 'sm' | 'md'
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const amount = usd(order.breakdown.totalCents)

  async function refund() {
    setBusy(true)
    setFailed(false)
    try {
      const next = await api.refund({ paymentId: order.orderId, actorId: sellerId })
      if (next.refund.state === 'failed') setFailed(true)
      onChange(next)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <Button
        variant="danger"
        size={size}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        {busy ? A.refunding : A.refundBuyer}
      </Button>
      {failed && (
        <p role="alert" className="basis-full text-sm font-medium text-state-failed">
          {A.refundFailed}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        danger
        busy={busy}
        title={A.refundTitle(amount, personName(order.buyerId))}
        body={<p>{A.refundBody}</p>}
        confirmLabel={busy ? A.refunding : A.refundConfirm(amount)}
        onConfirm={refund}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

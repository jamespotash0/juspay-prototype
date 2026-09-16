import { COPY } from '../shared/copy'
import type { Fulfilment, PaymentState, RefundState } from '../shared/types'
import { Icon, type IconName } from './Icon'

type Status = PaymentState | Fulfilment | RefundState | 'sold'

// Structure carries the state before colour does:
// solid border = settled, dashed = waiting on someone, dotted = held for a human,
// struck text = dead end. Glyph + words always present.
type Look = {
  label: string
  icon: IconName
  tone: string
  border: string
  struck?: boolean
}

const PAID = 'text-state-paid bg-state-paid-bg border-state-paid'
const PENDING = 'text-state-pending bg-state-pending-bg border-state-pending'
const SHIPPED = 'text-state-shipped bg-state-shipped-bg border-state-shipped'
const DISPUTED = 'text-state-disputed bg-state-disputed-bg border-state-disputed'
const FAILED = 'text-state-failed bg-state-failed-bg border-state-failed'
const REFUNDED = 'text-state-refunded bg-state-refunded-bg border-state-refunded'
const REVIEW = 'text-state-review bg-state-review-bg border-state-review'
const NEUTRAL = 'text-state-neutral bg-state-neutral-bg border-state-neutral'

const LOOKS: Record<Status, Look> = {
  // PaymentState
  awaiting_payment: {
    label: 'Awaiting payment',
    icon: 'hollow',
    tone: NEUTRAL,
    border: 'border-dashed',
  },
  action_required: {
    label: 'Action required',
    icon: 'alert',
    tone: PENDING,
    border: 'border-dashed',
  },
  pending: { label: 'Pending', icon: 'clock', tone: PENDING, border: 'border-dashed' },
  paid: { label: 'Paid', icon: 'check', tone: PAID, border: 'border-solid' },
  failed: { label: 'Failed', icon: 'cross', tone: FAILED, border: 'border-solid' },
  cancelled: {
    label: 'Cancelled',
    icon: 'dash',
    tone: NEUTRAL,
    border: 'border-solid',
    struck: true,
  },
  refunded: { label: 'Refunded', icon: 'undo', tone: REFUNDED, border: 'border-solid' },
  authorized_unexpected: {
    label: 'Held, not captured',
    icon: 'eye',
    tone: REVIEW,
    border: 'border-dotted',
  },
  paid_partial: {
    label: 'Partly paid',
    icon: 'eye',
    tone: REVIEW,
    border: 'border-dotted',
  },
  review: { label: 'In review', icon: 'eye', tone: REVIEW, border: 'border-dotted' },
  unknown: {
    label: 'Not confirmed',
    icon: 'question',
    tone: NEUTRAL,
    border: 'border-dotted',
  },
  // Fulfilment
  unshipped: {
    label: 'Not shipped',
    icon: 'box',
    tone: NEUTRAL,
    border: 'border-dashed',
  },
  shipped: { label: 'Shipped', icon: 'box', tone: SHIPPED, border: 'border-solid' },
  received: { label: 'Received', icon: 'home', tone: SHIPPED, border: 'border-solid' },
  disputed: { label: 'Disputed', icon: 'flag', tone: DISPUTED, border: 'border-dotted' },
  // RefundState ('pending' and 'failed' are shared with PaymentState above)
  none: { label: 'No refund', icon: 'dash', tone: NEUTRAL, border: 'border-solid' },
  succeeded: { label: 'Refunded', icon: 'undo', tone: REFUNDED, border: 'border-solid' },
  // Listing: a one-of-one that has been bought. Settled, and not a payment colour.
  sold: { label: COPY.sold.label, icon: 'dash', tone: NEUTRAL, border: 'border-solid' },
}

/** Pass `label` to override the words, e.g. "Refund pending" where context needs it. */
export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const look = LOOKS[status]
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-slab border px-2 text-xs font-semibold whitespace-nowrap ${look.tone} ${look.border}`}
    >
      <Icon name={look.icon} />
      <span className={look.struck ? 'line-through' : ''}>{label ?? look.label}</span>
    </span>
  )
}

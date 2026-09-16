import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
  busy?: boolean
}

/** Native <dialog>. The one overlay in the product: the refund confirmation. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  busy = false,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault() // Esc: let the parent own `open`
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-slab border border-rule bg-paper p-0 text-ink shadow-hair"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id="confirm-title" className="font-display text-lg font-bold">
          {title}
        </h2>
        <div className="text-sm">{body}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}

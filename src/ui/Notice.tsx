import type { ReactNode } from 'react'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'

type Tone = 'info' | 'warning' | 'danger' | 'ambiguous'

// Structural as well as coloured: glyph + border style differ per tone.
const TONES: Record<Tone, { icon: IconName; box: string; role: 'status' | 'alert' }> = {
  info: {
    icon: 'info',
    box: 'border-solid border-rule bg-paper text-ink shadow-card',
    role: 'status',
  },
  warning: {
    icon: 'clock',
    box: 'border-dashed border-state-pending/50 bg-state-pending-bg text-ink',
    role: 'status',
  },
  danger: {
    icon: 'alert',
    box: 'border-solid border-state-failed/40 bg-state-failed-bg text-ink',
    role: 'alert',
  },
  ambiguous: {
    icon: 'question',
    box: 'border-dotted border-2 border-ink/60 bg-paper text-ink',
    role: 'alert',
  },
}

interface NoticeProps {
  tone: Tone
  title: string
  body: ReactNode
  action?: { label: string; onClick: () => void; disabled?: boolean }
  /** Payment id or similar. Shown small and selectable; never a raw decline code. */
  supportRef?: string
}

export function Notice({ tone, title, body, action, supportRef }: NoticeProps) {
  const t = TONES[tone]
  return (
    <div
      role={t.role}
      className={`flex gap-3 rounded-card border px-4 py-3.5 sm:px-5 sm:py-4 ${t.box}`}
    >
      <Icon name={t.icon} className="mt-0.5 size-[18px]" />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <p className="font-semibold">{title}</p>
        <div className="text-sm text-ink-muted">{body}</div>
        {action && (
          <Button
            variant="secondary"
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className="mt-1.5"
          >
            {action.label}
          </Button>
        )}
        {supportRef && (
          <p className="money mt-1 text-xs text-ink-muted">
            Reference{' '}
            <span className="select-all font-medium text-ink">{supportRef}</span>
          </p>
        )}
      </div>
    </div>
  )
}

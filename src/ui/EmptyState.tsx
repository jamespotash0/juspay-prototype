import { Button } from './Button'

interface EmptyStateProps {
  title: string
  /** A fact about how the marketplace works, not an apology. */
  fact: string
  action: { label: string; onClick: () => void }
}

export function EmptyState({ title, fact, action }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-start gap-3 border-y border-rule py-10">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="max-w-[60ch] text-ink-muted">{fact}</p>
      <Button variant="secondary" onClick={action.onClick}>
        {action.label}
      </Button>
    </section>
  )
}

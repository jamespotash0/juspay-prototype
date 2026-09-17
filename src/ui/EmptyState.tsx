import { Button } from './Button'

interface EmptyStateProps {
  title: string
  /** A fact about how the marketplace works, not an apology. */
  fact: string
  action: { label: string; onClick: () => void }
}

export function EmptyState({ title, fact, action }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-start gap-2 rounded-card border border-rule bg-paper px-6 py-10 shadow-card sm:px-10">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="max-w-[60ch] text-sm text-ink-muted">{fact}</p>
      <Button variant="secondary" onClick={action.onClick} className="mt-3">
        {action.label}
      </Button>
    </section>
  )
}

import { navigate, useSearchParams } from '../lib/navigation.ts'
import type { AuthProvider } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/Card.tsx'
import { PageLayout } from './Layout.tsx'

const T = COPY.signIn
const PROVIDERS: AuthProvider[] = ['google', 'apple', 'email']

/** Only same-site paths: "//evil.com" or "https://…" would turn sign-in into an open redirect. */
// oxlint-disable-next-line react/only-export-components
export function safeNext(params: URLSearchParams): string {
  const next = params.get('next') ?? '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function SignIn() {
  const next = safeNext(useSearchParams())
  return (
    <PageLayout title={T.title} width="narrow">
      <Card className="flex max-w-md flex-col gap-4">
        <p className="text-sm text-ink-muted">{T.demo}</p>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((p) => (
            <Button
              key={p}
              variant="secondary"
              className="w-full"
              onClick={() => navigate(`/signin/${p}?next=${encodeURIComponent(next)}`)}
            >
              {T.providers[p]}
            </Button>
          ))}
        </div>
      </Card>
    </PageLayout>
  )
}

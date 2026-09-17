import { useState } from 'react'
import { navigate } from '../lib/navigation.ts'
import { linkPaypal } from '../lib/profile.ts'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/Card.tsx'
import { PageLayout } from './Layout.tsx'

const T = COPY.account

// A demo of linking PayPal: choose an account, see what's shared, come back. Like the demo sign-in,
// it never imitates PayPal's page (no logo, colours or password field) and sends nothing anywhere.
export default function AccountPaypal() {
  const persona = usePersona()
  const own = PERSONAS.find((p) => p.id === persona)
  const [email, setEmail] = useState(own?.email ?? '')

  return (
    <PageLayout title={T.paypalTitle} width="narrow">
      <Card className="flex max-w-md flex-col gap-4">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {COPY.signIn.demoLabel}
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{T.paypalChoose}</legend>
          {PERSONAS.filter((p) => p.kind === 'collector').map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 rounded-control border border-rule-strong px-3 py-2.5 text-sm has-checked:border-ink"
            >
              <input
                type="radio"
                name="paypal"
                value={p.email}
                checked={email === p.email}
                onChange={() => setEmail(p.email)}
              />
              <span className="flex flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-ink-muted">{p.email}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-ink-muted">{T.paypalConsent}</p>
        <div className="flex gap-2">
          <Button
            disabled={!email}
            onClick={() => {
              linkPaypal(persona, email)
              navigate('/account', { replace: true })
            }}
          >
            {COPY.signIn.continue}
          </Button>
          <Button variant="quiet" onClick={() => navigate('/account', { replace: true })}>
            {COPY.common.cancel}
          </Button>
        </div>
      </Card>
    </PageLayout>
  )
}

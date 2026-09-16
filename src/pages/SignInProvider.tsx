import { useEffect, useState, type FormEvent } from 'react'
import { navigate, useSearchParams, type Params } from '../lib/navigation.ts'
import { signIn, type AuthProvider } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { Persona } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Icon } from '../ui/Icon.tsx'
import { PageLayout } from './Layout.tsx'
import { safeNext } from './SignIn.tsx'

const T = COPY.signIn
const REDIRECT_MS = 700

// Mimics the OAuth flow (choose account → consent → redirect back), never a provider's look:
// no logos, brand colours or credential fields. A public look-alike sign-in page reads as phishing.
export default function SignInProvider({ params }: { params: Params }) {
  const provider = params.provider as AuthProvider
  const next = safeNext(useSearchParams())
  const [chosen, setChosen] = useState<Persona | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const known = provider === 'google' || provider === 'apple' || provider === 'email'

  useEffect(() => {
    if (!known) navigate(`/signin?next=${encodeURIComponent(next)}`, { replace: true })
  }, [known, next])

  useEffect(() => {
    if (!redirecting || !chosen) return
    const t = setTimeout(() => {
      signIn(chosen.id, provider)
      navigate(next, { replace: true })
    }, REDIRECT_MS)
    return () => clearTimeout(t)
  }, [redirecting, chosen, provider, next])

  if (!known) return null

  const cancel = () => navigate(`/signin?next=${encodeURIComponent(next)}`)

  if (provider === 'email')
    return (
      <PageLayout title={T.emailTitle}>
        <EmailStep
          onMatch={(p) => {
            setChosen(p)
            setRedirecting(true)
          }}
          redirecting={redirecting}
          onBack={cancel}
        />
      </PageLayout>
    )

  const name = T.providerName[provider]

  return (
    <PageLayout title={T.title}>
      <section
        aria-labelledby="step"
        className="flex max-w-md flex-col rounded-slab border border-rule bg-paper"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
          <h2 id="step" className="font-display text-base font-bold">
            {T.stepHeader(name)}
          </h2>
          <DemoLabel />
        </header>

        <div className="flex flex-col gap-4 p-4">
          {redirecting ? (
            <p role="status" className="flex items-center gap-2 text-sm font-medium">
              <Icon name="clock" />
              {T.redirecting}
            </p>
          ) : !chosen ? (
            <>
              <p className="font-semibold">{T.choose}</p>
              <ul className="flex flex-col border-y border-rule">
                {PERSONAS.map((p) => (
                  <li key={p.id} className="border-b border-rule last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setChosen(p)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:text-accent"
                    >
                      <Initial name={p.name} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="text-xs font-medium text-accent">
                          {COPY.shell.personaRole[p.id].long}
                        </span>
                        <span className="truncate text-sm text-ink-muted">{p.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div>
                <Button variant="quiet" className="px-0" onClick={cancel}>
                  {T.cancel}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Initial name={chosen.name} />
                <span className="flex min-w-0 flex-col text-sm">
                  <span className="font-semibold">{chosen.name}</span>
                  <span className="truncate text-ink-muted">{chosen.email}</span>
                </span>
              </div>
              <div className="flex flex-col gap-2 border-t border-rule pt-4">
                <p className="font-semibold">{T.consentIntro}</p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {T.consentItems.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Icon name="check" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end gap-2 border-t border-rule pt-4">
                <Button variant="quiet" onClick={cancel}>
                  {T.cancel}
                </Button>
                <Button onClick={() => setRedirecting(true)}>{T.continue}</Button>
              </div>
            </>
          )}
        </div>
      </section>
    </PageLayout>
  )
}

function DemoLabel() {
  return (
    <span className="inline-flex h-6 items-center rounded-slab border border-dashed border-state-neutral bg-state-neutral-bg px-2 text-xs font-semibold text-state-neutral">
      {T.demoLabel}
    </span>
  )
}

function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-rule bg-bone font-display text-sm font-bold text-ink"
    >
      {name[0]}
    </span>
  )
}

function EmailStep({
  onMatch,
  redirecting,
  onBack,
}: {
  onMatch: (p: Persona) => void
  redirecting: boolean
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [unknown, setUnknown] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const p = PERSONAS.find((x) => x.email === email.trim().toLowerCase())
    setUnknown(!p)
    if (p) onMatch(p)
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <div>
        <DemoLabel />
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {T.emailLabel}
        <input
          type="email"
          required
          list="demo-emails"
          autoComplete="off"
          value={email}
          disabled={redirecting}
          aria-describedby="email-hint"
          onChange={(e) => {
            setEmail(e.target.value)
            setUnknown(false)
          }}
          className="h-10 w-full rounded-slab border border-rule bg-paper px-3 text-sm focus-visible:border-accent disabled:bg-bone disabled:text-ink-muted"
        />
        <datalist id="demo-emails">
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.email} />
          ))}
        </datalist>
      </label>
      <p id="email-hint" className="-mt-2 text-sm text-ink-muted">
        {T.emailHint} <span>{PERSONAS.map((p) => p.email).join(', ')}</span>
      </p>
      {unknown && (
        <p role="alert" className="text-sm">
          {T.unknownEmail}{' '}
          <span className="font-semibold">{PERSONAS.map((p) => p.email).join(', ')}</span>
        </p>
      )}
      {redirecting ? (
        <p role="status" className="flex items-center gap-2 text-sm font-medium">
          <Icon name="clock" />
          {T.redirecting}
        </p>
      ) : (
        <div className="flex gap-2">
          <Button type="submit">{T.continue}</Button>
          <Button variant="quiet" onClick={onBack}>
            {T.back}
          </Button>
        </div>
      )}
    </form>
  )
}

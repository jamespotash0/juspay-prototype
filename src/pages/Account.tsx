import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { navigate } from '../lib/navigation.ts'
import { setDisplayName, setMode, useDisplayName, useMode } from '../lib/profile.ts'
import { signIn, signOut, useSession } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { PERSONAS } from '../shared/seed.ts'
import type { PersonaId, SavedCard } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Card, SectionHeading } from '../ui/Card.tsx'
import { Notice } from '../ui/Notice.tsx'
import { PageLayout } from './Layout.tsx'

const T = COPY.account

const input =
  'h-10 w-full rounded-control border border-rule-strong bg-paper px-3 text-sm hover:border-ink focus-visible:border-ink'

export default function Account() {
  // The page is behind sign-in, so a session is always here.
  const session = useSession()!
  const persona = PERSONAS.find((p) => p.id === session.persona)!
  const isCollector = persona.kind === 'collector'

  function leave() {
    // Home first, so this guarded page doesn't bounce to /signin as the session clears.
    navigate('/')
    signOut()
  }

  function switchAccount(id: PersonaId) {
    // A different account starts fresh on its home page, like signing out and back in.
    navigate(id === 'admin' ? '/admin' : '/')
    signIn(id, session.provider)
  }

  return (
    <PageLayout
      title={T.title}
      width="narrow"
      actions={
        <Button variant="secondary" size="sm" onClick={leave}>
          {COPY.shell.signOut}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        <Profile
          key={persona.id}
          id={persona.id}
          email={persona.email}
          provider={session.provider}
        />
        {isCollector && <ModeCard />}
        {isCollector && <PaymentMethods key={persona.id} customer={persona.id} />}

        <Card as="section" aria-labelledby="demo">
          <SectionHeading id="demo">{T.demo}</SectionHeading>
          <p className="mb-3 text-sm text-ink-muted">{T.demoFact}</p>
          <label className="sr-only" htmlFor="demo-account">
            {T.demo}
          </label>
          <select
            id="demo-account"
            value={persona.id}
            onChange={(e) => switchAccount(e.target.value as PersonaId)}
            className={`${input} sm:max-w-xs`}
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {COPY.shell.personaRole[p.id].short}
              </option>
            ))}
          </select>
        </Card>
      </div>
    </PageLayout>
  )
}

function Profile({
  id,
  email,
  provider,
}: {
  id: PersonaId
  email: string
  provider: string
}) {
  const name = useDisplayName(id)
  const [draft, setDraft] = useState(name)
  const [saved, setSaved] = useState(false)
  const providerName =
    provider === 'email'
      ? 'email'
      : COPY.signIn.providerName[provider as 'google' | 'apple']

  return (
    <Card as="section" aria-labelledby="profile">
      <SectionHeading id="profile">{T.profile}</SectionHeading>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setDisplayName(id, draft)
          setSaved(true)
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {T.name}
          <div className="flex gap-2">
            <input
              className={input}
              value={draft}
              maxLength={60}
              required
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
            />
            <Button type="submit" variant="secondary" disabled={draft.trim() === name}>
              {COPY.common.save}
            </Button>
          </div>
          <span className="text-xs font-normal text-ink-muted" aria-live="polite">
            {saved ? T.saved : T.nameHint}
          </span>
        </label>
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium">{T.email}</span>
          <span className="text-ink-muted">
            {email} · {T.signedInWith(providerName)}
          </span>
        </div>
      </form>
    </Card>
  )
}

function ModeCard() {
  const mode = useMode()
  return (
    <Card as="section" aria-labelledby="mode">
      <SectionHeading id="mode">{T.mode}</SectionHeading>
      <p className="mb-3 text-sm text-ink-muted">{T.modeFact}</p>
      <div
        role="group"
        aria-label={COPY.shell.modeLabel}
        className="grid gap-2 sm:grid-cols-2"
      >
        {(['buying', 'selling'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className="flex flex-col items-start gap-0.5 rounded-control border border-rule-strong bg-paper px-4 py-3 text-left hover:border-ink aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-ink"
          >
            <span className="text-sm font-semibold">
              {m === 'buying' ? COPY.shell.buying : COPY.shell.selling}
            </span>
            <span className="text-xs opacity-75">
              {m === 'buying' ? T.buyingFact : T.sellingFact}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

function PaymentMethods({ customer }: { customer: PersonaId }) {
  const [cards, setCards] = useState<SavedCard[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    api
      .paymentMethods(customer)
      .then((c) => live && setCards(c))
      .catch(() => live && setLoadFailed(true))
    return () => {
      live = false
    }
  }, [customer, attempt])

  async function remove(card: SavedCard) {
    if (!window.confirm(T.removeConfirm(T.card(card.network, card.last4)))) return
    setBusy(card.id)
    setRemoveFailed(false)
    try {
      setCards(await api.removePaymentMethod(customer, card.id))
    } catch {
      setRemoveFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card as="section" aria-labelledby="methods">
      <SectionHeading id="methods">{T.methods}</SectionHeading>
      {loadFailed ? (
        <Notice
          tone="danger"
          title={T.methodsFailed}
          body={null}
          action={{
            label: COPY.common.tryAgain,
            onClick: () => {
              setLoadFailed(false)
              setAttempt((n) => n + 1)
            },
          }}
        />
      ) : !cards ? (
        <p role="status" className="text-sm text-ink-muted">
          {T.methodsLoading}
        </p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-ink-muted">{T.noCards}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="money inline-flex h-7 min-w-11 items-center justify-center rounded-md border border-rule-strong px-1.5 text-[11px] font-bold uppercase">
                {c.network ?? 'Card'}
              </span>
              <div className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="money font-medium">{T.card(c.network, c.last4)}</span>
                {c.expiry && (
                  <span className="money text-xs text-ink-muted">
                    {T.expires(c.expiry)}
                  </span>
                )}
              </div>
              <Button
                variant="quiet"
                size="sm"
                disabled={busy === c.id}
                onClick={() => remove(c)}
              >
                {T.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {removeFailed && (
        <div className="mt-3">
          <Notice tone="danger" title={T.removeFailed} body={null} />
        </div>
      )}
      <p className="mt-4 border-t border-rule pt-3 text-xs text-ink-muted">
        {T.otherMethods}
      </p>
    </Card>
  )
}

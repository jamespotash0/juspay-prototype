import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { navigate } from '../lib/navigation.ts'
import {
  linkPaypal,
  saveAddresses,
  setDisplayName,
  useDisplayName,
  useLinkedPaypal,
  useSavedAddresses,
} from '../lib/profile.ts'
import { resetDemo } from '../lib/reset.ts'
import { signIn, signOut, useSession } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import { DEMO_PERSONAS, PERSONAS } from '../shared/seed.ts'
import type { PersonaId, SaveCardResponse, SavedCard } from '../shared/types.ts'
import { AddressFields } from '../ui/AddressFields.tsx'
import { Button } from '../ui/Button.tsx'
import { Card, SectionHeading } from '../ui/Card.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Notice } from '../ui/Notice.tsx'
import { Sheet } from '../ui/Sheet.tsx'
import { PageLayout } from './Layout.tsx'

const T = COPY.account

// The SDK is only needed once someone adds a card.
const HyperCheckout = lazy(() => import('../checkout/HyperCheckout.tsx'))

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
        {isCollector && <Addresses key={`addr-${persona.id}`} id={persona.id} />}
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
            {DEMO_PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {COPY.shell.personaRole[p.id].short}
              </option>
            ))}
          </select>
        </Card>

        <Card as="section" aria-labelledby="reset">
          <SectionHeading id="reset">{T.reset}</SectionHeading>
          <p className="mb-3 text-sm text-ink-muted">{T.resetFact}</p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (window.confirm(COPY.shell.resetConfirm)) resetDemo()
            }}
          >
            {T.reset}
          </Button>
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

/** Shipping and billing addresses checkout fills in, so they're typed once. */
function Addresses({ id }: { id: PersonaId }) {
  const current = useSavedAddresses(id)
  const [shipTo, setShipTo] = useState(current.shipTo)
  const [billingSame, setBillingSame] = useState(current.billTo === null)
  const [billTo, setBillTo] = useState(
    current.billTo ?? { ...current.shipTo, line1: '', city: '', state: '', zip: '' },
  )
  const [saved, setSaved] = useState(false)
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setSaved(false)
    }

  return (
    <Card as="section" aria-labelledby="addresses">
      <SectionHeading id="addresses">{T.addresses}</SectionHeading>
      <p className="mb-4 text-sm text-ink-muted">{T.addressesFact}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          saveAddresses(id, { shipTo, billTo: billingSame ? null : billTo })
          setSaved(true)
        }}
      >
        <h3 className="text-sm font-semibold">{COPY.checkoutPage.shipTo}</h3>
        <AddressFields
          value={shipTo}
          onChange={touch(setShipTo)}
          legend={COPY.checkoutPage.shipTo}
        />
        <h3 className="text-sm font-semibold">{COPY.checkoutPage.billing}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={billingSame}
            onChange={(e) => touch(setBillingSame)(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          {COPY.checkoutPage.sameAsShipping}
        </label>
        {!billingSame && (
          <AddressFields
            value={billTo}
            onChange={touch(setBillTo)}
            legend={COPY.checkoutPage.billing}
          />
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" size="sm">
            {COPY.common.save}
          </Button>
          <span className="text-xs text-ink-muted" aria-live="polite">
            {saved ? T.saved : ''}
          </span>
        </div>
      </form>
    </Card>
  )
}

function PaymentMethods({ customer }: { customer: PersonaId }) {
  const [cards, setCards] = useState<SavedCard[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The "Add payment method" overlay is open; `adding` is the $0 setup payment inside it once started.
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<SaveCardResponse | null>(null)
  const [addState, setAddState] = useState<
    'idle' | 'starting' | 'saving' | 'failed' | 'notSaved'
  >('idle')
  const paypal = useLinkedPaypal(customer)

  async function startAdding() {
    setOpen(true)
    setAddState('starting')
    try {
      setAdding(await api.saveCard(customer))
      setAddState('idle')
    } catch {
      setAddState('failed')
    }
  }

  // The SDK doesn't report the outcome; the saved-card list is the truth. It can lag the confirm by a
  // moment, so look a few times before saying it didn't save.
  async function confirmSaved() {
    setAddState('saving')
    const before = new Set(cards?.map((c) => c.id))
    for (let i = 0; i < 5; i++) {
      try {
        const next = await api.paymentMethods(customer)
        if (next.some((c) => !before.has(c.id))) {
          setCards(next)
          closeAdding()
          return
        }
      } catch {
        // try again below
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    setAdding(null)
    setAddState('notSaved')
  }

  function closeAdding() {
    setOpen(false)
    setAdding(null)
    setAddState('idle')
  }

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

  async function makeDefault(card: SavedCard) {
    setBusy(card.id)
    setRemoveFailed(false)
    try {
      setCards(await api.setDefaultPaymentMethod(customer, card.id))
    } catch {
      setRemoveFailed(true)
    } finally {
      setBusy(null)
    }
  }

  async function remove(card: SavedCard) {
    if (!window.confirm(T.removeConfirm(T.card(card.network, card.last4, card.funding))))
      return
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
      ) : cards.length === 0 && !paypal ? (
        <p className="text-sm text-ink-muted">{T.noCards}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0">
              <span className="money inline-flex h-7 min-w-11 items-center justify-center rounded-md border border-rule-strong px-1.5 text-[11px] font-bold uppercase">
                {c.network ?? 'Card'}
              </span>
              <div className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="money flex flex-wrap items-center gap-2 font-medium">
                  {T.card(c.network, c.last4, c.funding)}
                  {c.isDefault && (
                    <span className="rounded-full bg-bone px-2 py-0.5 text-[11px] font-semibold text-ink">
                      {T.defaultBadge}
                    </span>
                  )}
                </span>
                {c.expiry && (
                  <span className="money text-xs text-ink-muted">
                    {T.expires(c.expiry)}
                  </span>
                )}
              </div>
              {!c.isDefault && (
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={busy === c.id}
                  onClick={() => makeDefault(c)}
                >
                  {T.makeDefault}
                </Button>
              )}
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
          {paypal && (
            <li className="flex items-center gap-3 py-3 first:pt-0">
              <span className="inline-flex h-7 min-w-11 items-center justify-center rounded-md border border-rule-strong px-1.5 text-[11px] font-bold">
                {T.paypal}
              </span>
              <div className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="font-medium">{T.paypal}</span>
                <span className="truncate text-xs text-ink-muted">
                  {T.paypalLinked(paypal)}
                </span>
              </div>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => linkPaypal(customer, null)}
              >
                {T.paypalUnlink}
              </Button>
            </li>
          )}
        </ul>
      )}
      {removeFailed && (
        <div className="mt-3">
          <Notice tone="danger" title={T.removeFailed} body={null} />
        </div>
      )}

      {/* The one way in, at the bottom of the list: Hyperswitch lists what can be added. */}
      <div className="mt-4 border-t border-rule pt-4">
        <Button variant="secondary" className="w-full sm:w-auto" onClick={startAdding}>
          <Icon name="plus" className="size-4" />
          {T.addCard}
        </Button>
      </div>

      {open && (
        <Sheet
          title={T.addCard}
          closeLabel={COPY.common.cancel}
          onClose={closeAdding}
          locked={addState === 'saving'}
        >
          <div className="flex flex-col gap-4 px-5 pb-6 sm:px-6">
            <p className="text-sm text-ink-muted">{T.addCardFact}</p>
            {addState === 'failed' ? (
              <Notice
                tone="danger"
                title={T.addCardFailed}
                body={null}
                action={{ label: COPY.common.tryAgain, onClick: startAdding }}
              />
            ) : adding ? (
              <Suspense
                fallback={<p className="text-sm text-ink-muted">{T.methodsLoading}</p>}
              >
                <HyperCheckout
                  purpose="save"
                  clientSecret={adding.clientSecret}
                  publishableKey={adding.publishableKey}
                  paymentId={adding.paymentId}
                  returnUrl={`${location.origin}/account`}
                  onSubmitted={confirmSaved}
                  onError={() => setAddState('notSaved')}
                />
              </Suspense>
            ) : addState === 'notSaved' ? (
              <Notice
                tone="danger"
                title={T.cardNotSaved}
                body={null}
                action={{ label: COPY.common.tryAgain, onClick: startAdding }}
              />
            ) : (
              <p role="status" className="text-sm text-ink-muted">
                {T.methodsLoading}
              </p>
            )}
            {addState === 'saving' && (
              <p role="status" className="text-sm text-ink-muted">
                {T.cardSaving}
              </p>
            )}
            {!paypal && (
              <div className="flex items-center gap-3 border-t border-rule pt-4">
                <span className="inline-flex h-7 min-w-11 items-center justify-center rounded-md border border-rule-strong px-1.5 text-[11px] font-bold">
                  {T.paypal}
                </span>
                <span className="flex-1 text-sm font-medium">{T.paypal}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/account/paypal')}
                >
                  {T.paypalLink}
                </Button>
              </div>
            )}
            <p className="text-xs text-ink-muted">
              {T.paypalDemo} {T.otherMethods}
            </p>
          </div>
        </Sheet>
      )}
    </Card>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { addUserListing } from '../lib/listings.ts'
import { navigate } from '../lib/navigation.ts'
import { usePersona } from '../lib/session.ts'
import { COPY } from '../shared/copy.ts'
import type { Category, GradingService } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Notice } from '../ui/Notice.tsx'
import { dollarsToCents } from '../ui/format.ts'
import { PageLayout } from './Layout.tsx'

const T = COPY.sellNew

const SERVICES: GradingService[] = ['PCGS', 'NGC', 'PSA', 'BGS', 'CGC']

// A neutral slab outline for listings without a photo.
const PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="6" y="6" width="288" height="408" rx="10" fill="#ebe7dd" stroke="#dcd7cb" stroke-width="3"/><rect x="40" y="106" width="220" height="290" rx="4" fill="#f6f3ec" stroke="#dcd7cb"/></svg>',
)}`

const field =
  'h-10 w-full rounded-slab border border-rule bg-paper px-3 text-sm aria-[invalid=true]:border-state-failed'

export default function SellNew() {
  const persona = usePersona()
  const [category, setCategory] = useState<Category>('coin')
  const [graded, setGraded] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (persona === 'admin') {
    return (
      <PageLayout title={T.title}>
        <Notice tone="info" title={T.adminOnly} body={T.adminFact} />
      </PageLayout>
    )
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const err: Record<string, string> = {}

    const title = get('title')
    if (!title) err.title = T.errors.title
    const priceCents = dollarsToCents(get('price'))
    if (priceCents === null || priceCents === 0) err.price = T.errors.price
    const shippingCents = get('shipping') === '' ? 0 : dollarsToCents(get('shipping'))
    if (shippingCents === null) err.shipping = T.errors.shipping
    const description = get('description')
    if (!description) err.description = T.errors.description

    const service = get('service') as GradingService
    const grade = get('grade')
    const certNumber = get('certNumber')
    if (graded) {
      if (!SERVICES.includes(service)) err.service = T.errors.service
      if (!grade) err.grade = T.errors.grade
      if (!certNumber) err.certNumber = T.errors.cert
    }

    const yearRaw = get('year')
    const year = yearRaw === '' ? undefined : Number(yearRaw)
    if (
      category === 'coin' &&
      year !== undefined &&
      !(Number.isInteger(year) && year >= 1700 && year <= new Date().getFullYear())
    )
      err.year = T.errors.year

    setErrors(err)
    if (Object.keys(err).length) return

    const imageUrl = get('imageUrl')
    const created = addUserListing({
      sellerId: persona,
      category,
      title,
      priceCents: priceCents!,
      shippingCents: shippingCents!,
      imageUrl: imageUrl || PLACEHOLDER,
      graded,
      ...(graded ? { service, grade, certNumber } : {}),
      ...(category === 'coin' && year !== undefined ? { year } : {}),
      ...(category === 'coin' && get('mintMark') ? { mintMark: get('mintMark') } : {}),
      description,
    })
    navigate(`/listing/${created.id}`)
  }

  const err = (k: string) => errors[k]

  return (
    <PageLayout title={T.title}>
      <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-5">
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm font-medium text-state-failed">
            {T.fixErrors}
          </p>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">{T.category}</legend>
          <div className="flex gap-2">
            {(['coin', 'card'] as const).map((c) => (
              <label
                key={c}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-slab border border-rule bg-paper px-4 text-sm font-medium has-checked:border-accent has-checked:text-accent"
              >
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                  className="accent-accent"
                />
                {c === 'coin' ? COPY.listing.coin : COPY.listing.card}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={T.listingTitle} name="title" error={err('title')}>
          <input
            id="title"
            name="title"
            className={field}
            aria-invalid={!!err('title')}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={T.price} name="price" error={err('price')} hint={T.priceHint}>
            <input
              id="price"
              name="price"
              inputMode="decimal"
              className={`money ${field}`}
              aria-invalid={!!err('price')}
            />
          </Field>
          <Field
            label={T.shipping}
            name="shipping"
            error={err('shipping')}
            hint={T.shippingHint}
          >
            <input
              id="shipping"
              name="shipping"
              inputMode="decimal"
              defaultValue="0"
              className={`money ${field}`}
              aria-invalid={!!err('shipping')}
            />
          </Field>
        </div>

        {category === 'coin' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={T.year} name="year" error={err('year')} hint={T.optional}>
              <input
                id="year"
                name="year"
                inputMode="numeric"
                className={`money ${field}`}
                aria-invalid={!!err('year')}
              />
            </Field>
            <Field label={T.mintMark} name="mintMark" hint={T.mintMarkHint}>
              <input id="mintMark" name="mintMark" className={field} />
            </Field>
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={graded}
            onChange={(e) => setGraded(e.target.checked)}
            className="size-4 accent-accent"
          />
          {T.graded}
        </label>

        {graded && (
          <div className="grid gap-5 border-l border-rule pl-4 sm:grid-cols-3">
            <Field label={T.service} name="service" error={err('service')}>
              <select
                id="service"
                name="service"
                defaultValue=""
                className={field}
                aria-invalid={!!err('service')}
              >
                <option value="" disabled>
                  {T.choose}
                </option>
                {SERVICES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={T.grade} name="grade" error={err('grade')}>
              <input
                id="grade"
                name="grade"
                placeholder={category === 'coin' ? 'MS-65' : 'PSA 9'}
                className={field}
                aria-invalid={!!err('grade')}
              />
            </Field>
            <Field label={T.cert} name="certNumber" error={err('certNumber')}>
              <input
                id="certNumber"
                name="certNumber"
                className={`money ${field}`}
                aria-invalid={!!err('certNumber')}
              />
            </Field>
          </div>
        )}

        <Field label={T.imageUrl} name="imageUrl" hint={T.imageHint}>
          <input id="imageUrl" name="imageUrl" type="url" className={field} />
        </Field>

        <Field label={T.description} name="description" error={err('description')}>
          <textarea
            id="description"
            name="description"
            rows={4}
            className={`${field} h-auto py-2`}
            aria-invalid={!!err('description')}
          />
        </Field>

        <div>
          <Button type="submit">{T.publish}</Button>
        </div>
      </form>
    </PageLayout>
  )
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string
  name: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
        {hint && <span className="ml-2 font-normal text-ink-muted">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-sm text-state-failed">{error}</p>}
    </div>
  )
}

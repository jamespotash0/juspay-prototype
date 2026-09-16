import { useState, type FormEvent, type ReactNode } from 'react'
import { addUserListing } from '../lib/listings.ts'
import { navigate } from '../lib/router.tsx'
import { usePersona } from '../lib/session.ts'
import type { Category, GradingService } from '../shared/types.ts'
import { Button } from '../ui/Button.tsx'
import { Notice } from '../ui/Notice.tsx'
import { PageLayout } from './Layout.tsx'

// ponytail: local strings pending product adding them to COPY (see handback).
const T = {
  title: 'Create a listing',
  adminOnly: 'Listings are created by collector accounts',
  adminFact: 'Switch to Alex or Mike to list an item.',
  publish: 'Publish listing',
  fixErrors: 'Check the highlighted fields.',
}

const SERVICES: GradingService[] = ['PCGS', 'NGC', 'PSA', 'BGS', 'CGC']

// A neutral slab outline for listings without a photo.
const PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="6" y="6" width="288" height="408" rx="10" fill="#ebe7dd" stroke="#dcd7cb" stroke-width="3"/><rect x="40" y="106" width="220" height="290" rx="4" fill="#f6f3ec" stroke="#dcd7cb"/></svg>',
)}`

/** "12", "12.5", "1,800.00" → integer cents; anything else → null. */
export function dollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, '').replaceAll(',', '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

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
    if (!title) err.title = 'Add a title.'
    const priceCents = dollarsToCents(get('price'))
    if (priceCents === null || priceCents === 0)
      err.price = 'Enter a price in dollars, like 1800 or 24.50.'
    const shippingCents = get('shipping') === '' ? 0 : dollarsToCents(get('shipping'))
    if (shippingCents === null)
      err.shipping = 'Enter shipping in dollars, or 0 for free shipping.'
    const description = get('description')
    if (!description) err.description = 'Add a description.'

    const service = get('service') as GradingService
    const grade = get('grade')
    const certNumber = get('certNumber')
    if (graded) {
      if (!SERVICES.includes(service)) err.service = 'Choose the grading service.'
      if (!grade) err.grade = 'Add the grade on the slab.'
      if (!certNumber) err.certNumber = 'Add the cert number on the slab.'
    }

    const yearRaw = get('year')
    const year = yearRaw === '' ? undefined : Number(yearRaw)
    if (
      category === 'coin' &&
      year !== undefined &&
      !(Number.isInteger(year) && year >= 1700 && year <= new Date().getFullYear())
    )
      err.year = 'Enter a four-digit year.'

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
          <legend className="mb-1.5 text-sm font-semibold">Category</legend>
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
                {c === 'coin' ? 'Coin' : 'Card'}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Title" name="title" error={err('title')}>
          <input
            id="title"
            name="title"
            className={field}
            aria-invalid={!!err('title')}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Price" name="price" error={err('price')} hint="US dollars">
            <input
              id="price"
              name="price"
              inputMode="decimal"
              className={`money ${field}`}
              aria-invalid={!!err('price')}
            />
          </Field>
          <Field
            label="Shipping"
            name="shipping"
            error={err('shipping')}
            hint="0 for free shipping"
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
            <Field label="Year" name="year" error={err('year')} hint="Optional">
              <input
                id="year"
                name="year"
                inputMode="numeric"
                className={`money ${field}`}
                aria-invalid={!!err('year')}
              />
            </Field>
            <Field label="Mint mark" name="mintMark" hint="Optional, e.g. CC, S, D">
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
          Graded
        </label>

        {graded && (
          <div className="grid gap-5 border-l border-rule pl-4 sm:grid-cols-3">
            <Field label="Service" name="service" error={err('service')}>
              <select
                id="service"
                name="service"
                defaultValue=""
                className={field}
                aria-invalid={!!err('service')}
              >
                <option value="" disabled>
                  Choose
                </option>
                {SERVICES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Grade" name="grade" error={err('grade')}>
              <input
                id="grade"
                name="grade"
                placeholder={category === 'coin' ? 'MS-65' : 'PSA 9'}
                className={field}
                aria-invalid={!!err('grade')}
              />
            </Field>
            <Field label="Cert number" name="certNumber" error={err('certNumber')}>
              <input
                id="certNumber"
                name="certNumber"
                className={`money ${field}`}
                aria-invalid={!!err('certNumber')}
              />
            </Field>
          </div>
        )}

        <Field
          label="Image URL"
          name="imageUrl"
          hint="Optional. Without one, the listing shows a plain slab outline."
        >
          <input id="imageUrl" name="imageUrl" type="url" className={field} />
        </Field>

        <Field label="Description" name="description" error={err('description')}>
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

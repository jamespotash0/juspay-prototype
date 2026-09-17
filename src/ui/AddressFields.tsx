import { COPY } from '../shared/copy.ts'
import type { ShipTo } from '../shared/types.ts'

const input =
  'h-10 w-full rounded-control border border-rule-strong bg-paper px-3 text-sm font-normal hover:border-ink focus-visible:border-ink disabled:border-rule disabled:bg-well disabled:text-ink-muted'

/** Name, street, city, state, ZIP: the one US address form, used by checkout and the account page. */
export function AddressFields({
  value,
  onChange,
  legend,
  disabled = false,
}: {
  value: ShipTo
  onChange: (a: ShipTo) => void
  legend: string
  disabled?: boolean
}) {
  const T = COPY.checkoutPage.fields
  const field = (
    k: keyof ShipTo,
    label: string,
    className: string,
    autoComplete: string,
  ) => (
    <label className={`flex flex-col gap-1 text-sm font-medium ${className}`}>
      {label}
      <input
        required
        className={input}
        value={value[k]}
        autoComplete={autoComplete}
        onChange={(e) => onChange({ ...value, [k]: e.target.value })}
      />
    </label>
  )
  return (
    <fieldset className="grid grid-cols-6 gap-3" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      {field('name', T.name, 'col-span-6', 'name')}
      {field('line1', T.line1, 'col-span-6', 'address-line1')}
      {field('city', T.city, 'col-span-6 sm:col-span-3', 'address-level2')}
      {field('state', T.state, 'col-span-2 sm:col-span-1', 'address-level1')}
      {field('zip', T.zip, 'col-span-4 sm:col-span-2', 'postal-code')}
    </fieldset>
  )
}

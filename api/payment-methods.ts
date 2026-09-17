import { PERSONAS } from '../src/shared/seed.js'
import type { PaymentMethodsResponse, SavedCard } from '../src/shared/types.js'
import { hsFetch } from './_lib/hyperswitch.js'
import { fundingOf, jsonError } from './_lib/orderView.js'

interface HsCustomerMethods {
  customer_payment_methods: {
    payment_method_id: string
    payment_method: string
    payment_method_type?: string | null
    default_payment_method_set?: boolean
    card?: {
      scheme?: string | null
      card_type?: string | null
      last4_digits?: string | null
      expiry_month?: string | null
      expiry_year?: string | null
    } | null
  }[]
}

/** Saved cards only: network, credit/debit, last four and expiry. Never a token or a full number. */
async function savedCards(customer: string): Promise<SavedCard[] | Response> {
  const res = await hsFetch<HsCustomerMethods>(
    `/customers/${encodeURIComponent(customer)}/payment_methods`,
  )
  // A buyer who never saved anything has no Hyperswitch customer record yet.
  if (!res.ok && res.status === 404) return []
  if (!res.ok) return jsonError(502, 'UPSTREAM', "We couldn't load your saved cards")
  return res.data.customer_payment_methods
    .filter((m) => m.payment_method === 'card' && m.card?.last4_digits)
    .map((m) => {
      const funding = fundingOf(m.payment_method_type, m.card!.card_type)
      return {
        id: m.payment_method_id,
        ...(m.card!.scheme ? { network: m.card!.scheme } : {}),
        ...(funding ? { funding } : {}),
        last4: m.card!.last4_digits!,
        ...(m.card!.expiry_month && m.card!.expiry_year
          ? { expiry: `${m.card!.expiry_month}/${m.card!.expiry_year.slice(-2)}` }
          : {}),
        ...(m.default_payment_method_set ? { isDefault: true } : {}),
      }
    })
}

// ponytail: the customer id comes from the mocked sign-in, like every other endpoint here. Real auth
// would take it from the session instead of the query.
const collector = (id: string | null) =>
  PERSONAS.some((p) => p.id === id && p.kind === 'collector') ? id! : null

/** GET /api/payment-methods?customer=<PersonaId> → the cards Hyperswitch saved for this buyer. */
export async function GET(request: Request): Promise<Response> {
  try {
    const customer = collector(new URL(request.url).searchParams.get('customer'))
    if (!customer) return jsonError(400, 'BAD_REQUEST', 'Unknown customer')
    const methods = await savedCards(customer)
    return methods instanceof Response
      ? methods
      : Response.json({ methods } satisfies PaymentMethodsResponse)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong loading saved cards')
  }
}

/** DELETE /api/payment-methods?customer=<PersonaId>&id=<pm_…> → the remaining cards. */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const q = new URL(request.url).searchParams
    const customer = collector(q.get('customer'))
    const id = q.get('id')
    if (!customer || !id) return jsonError(400, 'BAD_REQUEST', 'Pass customer and id')
    // Only a card this customer owns: the id alone would let anyone delete anyone's card.
    const before = await savedCards(customer)
    if (before instanceof Response) return before
    if (!before.some((m) => m.id === id))
      return jsonError(404, 'NOT_FOUND', 'That card is not saved on this account')
    const removed = await hsFetch(`/payment_methods/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!removed.ok) return jsonError(502, 'UPSTREAM', "We couldn't remove that card")
    return Response.json({
      methods: before.filter((m) => m.id !== id),
    } satisfies PaymentMethodsResponse)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong removing the card')
  }
}

/**
 * POST /api/payment-methods { customer, id } → makes that card the customer's default in Hyperswitch.
 * Verified on the sandbox 2026-09-16: POST /customers/{id}/payment_methods/{pm}/default; setting the
 * current default again answers 400 IR_16, which is treated as done.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as {
      customer?: string
      id?: string
    } | null
    const customer = collector(body?.customer ?? null)
    const id = body?.id
    if (!customer || typeof id !== 'string')
      return jsonError(400, 'BAD_REQUEST', 'Pass customer and id')
    // Only a card this customer owns.
    const before = await savedCards(customer)
    if (before instanceof Response) return before
    if (!before.some((m) => m.id === id))
      return jsonError(404, 'NOT_FOUND', 'That card is not saved on this account')
    const set = await hsFetch(
      `/customers/${encodeURIComponent(customer)}/payment_methods/${encodeURIComponent(id)}/default`,
      { method: 'POST' },
    )
    if (!set.ok && set.hsCode !== 'IR_16')
      return jsonError(502, 'UPSTREAM', "We couldn't change your default card")
    const after = await savedCards(customer)
    return after instanceof Response
      ? after
      : Response.json({ methods: after } satisfies PaymentMethodsResponse)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong changing your default card')
  }
}

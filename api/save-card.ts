import { newAttemptId } from '../src/shared/attempt.js'
import { mapStatus } from '../src/shared/orderState.js'
import { PERSONAS } from '../src/shared/seed.js'
import type { SaveCardStatus, SaveCardResponse } from '../src/shared/types.js'
import { hsFetch } from './_lib/hyperswitch.js'
import { jsonError, type HsPayment } from './_lib/orderView.js'

/**
 * POST /api/save-card { customer } — a $0 payment that only saves a card, for the account page.
 * The card is typed into Hyperswitch's SDK, never our inputs; nothing is charged.
 * Verified on the sandbox 2026-09-16: a $0 on-session payment with the buyer's consent succeeds on
 * stripe_test and fauxpay and stores the card. (payment_type setup_mandate is not implemented there.)
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as { customer?: string } | null
    const buyer = PERSONAS.find((p) => p.id === body?.customer && p.kind === 'collector')
    if (!buyer) return jsonError(400, 'BAD_REQUEST', 'Unknown customer')

    // Same id shape as a checkout attempt, with its own prefix so it never reads as an order.
    const paymentId = newAttemptId().replace(/^cka_/, 'cks_')
    const created = await hsFetch<HsPayment>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: paymentId,
        amount: 0,
        currency: 'USD',
        confirm: false,
        customer: { id: buyer.id, email: buyer.email },
        setup_future_usage: 'on_session',
        // Clicking "Add a card" is the consent. The SDK only sends this itself when its save
        // checkbox is ticked, and a checkbox makes no sense on a form whose only job is saving.
        customer_acceptance: {
          acceptance_type: 'online',
          accepted_at: new Date().toISOString(),
          online: {
            ip_address:
              request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0',
            user_agent: request.headers.get('user-agent') ?? 'unknown',
          },
        },
        return_url: `${new URL(request.url).origin}/account`,
        // No `sellers` key: order lists skip it.
        metadata: { buyerId: buyer.id, source: 'save_card' },
      }),
    })
    if (!created.ok || !created.data.client_secret) {
      console.error(
        '[save-card] create failed',
        created.ok ? 'no client_secret' : created.hsCode,
      )
      return jsonError(
        502,
        'UPSTREAM',
        "We couldn't start saving a card. Nothing was saved.",
      )
    }
    return Response.json({
      paymentId,
      clientSecret: created.data.client_secret,
      publishableKey: process.env.JUSPAY_API_PUBLISHABLE_KEY ?? '',
    } satisfies SaveCardResponse)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong starting to save a card')
  }
}

/**
 * GET /api/save-card?id=<cks_…> → the $0 payment's state.
 * The saved-card list can't answer "did this save work": Hyperswitch dedupes a card the buyer
 * already has to the same payment_method_id, so a successful re-save adds nothing to the list.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? ''
    // Only ids this endpoint issues: anything else is a checkout payment or someone guessing.
    if (!/^cks_[0-9a-f]{22}$/.test(id))
      return jsonError(400, 'BAD_REQUEST', 'Invalid save-card id')
    const read = await hsFetch<HsPayment>(`/payments/${id}`)
    if (!read.ok) return jsonError(502, 'UPSTREAM', "We couldn't read that card save")
    return Response.json({ state: mapStatus(read.data.status) } satisfies SaveCardStatus)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong reading that card save')
  }
}

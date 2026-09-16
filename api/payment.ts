import { jsonError, PAYMENT_ID, readOrder } from './_lib/orderView.js'

/** GET /api/payment?id=… → OrderView. The authoritative status read. */
export async function GET(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? ''
    if (!PAYMENT_ID.test(id)) return jsonError(400, 'BAD_REQUEST', 'Invalid payment id')
    const order = await readOrder(id)
    return order instanceof Response ? order : Response.json(order)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong reading the payment')
  }
}

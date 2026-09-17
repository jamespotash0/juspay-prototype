import { jsonError, readOrder } from './_lib/orderView.js'

/** GET /api/payment?id=<orderId> → OrderView. The authoritative status read. */
export async function GET(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? ''
    const order = await readOrder(id)
    return order instanceof Response ? order : Response.json(order)
  } catch {
    return jsonError(500, 'INTERNAL', 'Something went wrong reading the payment')
  }
}

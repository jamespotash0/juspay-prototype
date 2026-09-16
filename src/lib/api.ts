import type {
  ApiError,
  CheckoutRequest,
  CheckoutResponse,
  OrderStateRequest,
  OrderView,
  OrdersResponse,
  PersonaId,
  RefundRequest,
} from '../shared/types.ts'

/** Thrown for any non-2xx or unreachable API. `status` 0 means we never got a response. */
export class ApiRequestError extends Error {
  status: number
  code: string
  /** Set on checkout's 409 IN_PROGRESS: the payment already in flight — route to /order/<paymentId>. */
  paymentId?: string
  constructor(status: number, body: ApiError & { paymentId?: string }) {
    super(body.error.message)
    this.status = status
    this.code = body.error.code
    if (typeof body.paymentId === 'string') this.paymentId = body.paymentId
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiRequestError(0, {
      error: { code: 'NETWORK', message: 'Could not reach the server' },
    })
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      body?.error
        ? (body as ApiError)
        : { error: { code: `HTTP_${res.status}`, message: res.statusText } },
    )
  }
  return body as T
}

const post = <T>(path: string, body: unknown) =>
  call<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  checkout: (req: CheckoutRequest) => post<CheckoutResponse>('/api/checkout', req),
  payment: (id: string) => call<OrderView>(`/api/payment?id=${encodeURIComponent(id)}`),
  orderState: (req: OrderStateRequest) => post<OrderView>('/api/order-state', req),
  refund: (req: RefundRequest) => post<OrderView>('/api/refund', req),
  orders: (filter: { buyer: PersonaId } | { seller: string } | { all: true }) =>
    call<OrdersResponse>(
      '/api/orders?' +
        new URLSearchParams(
          'all' in filter ? { all: '1' } : (filter as Record<string, string>),
        ),
    ),
}

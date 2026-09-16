import type { ApiError } from '../../src/shared/types.js'

export const HS_BASE_URL = 'https://sandbox.hyperswitch.io'

export type HsResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false
      status: number
      /** Raw Hyperswitch code, e.g. HE_01, CE_00, IR_16. 'NETWORK' / 'BAD_RESPONSE' when we never got one. */
      hsCode: string
      /** Normalised body, safe to return to the browser. Message keeps the raw text, so IR_20 shows up here. */
      error: ApiError
    }

/** Server-only call to the Hyperswitch sandbox with the secret key. Never throws. */
export async function hsFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<HsResult<T>> {
  const apiKey = process.env.JUSPAY_API_TEST_KEY
  if (!apiKey) return fail(500, 'CONFIG', 'JUSPAY_API_TEST_KEY is not set')

  let res: Response
  try {
    res = await fetch(HS_BASE_URL + path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...init.headers,
        'api-key': apiKey,
      },
    })
  } catch (e) {
    return fail(502, 'NETWORK', e instanceof Error ? e.message : 'Network error')
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return fail(
      res.ok ? 502 : res.status,
      'BAD_RESPONSE',
      `Non-JSON response (HTTP ${res.status})`,
    )
  }

  if (res.ok) return { ok: true, status: res.status, data: body as T }
  const err = (body as { error?: { code?: string; message?: string } })?.error
  return fail(
    res.status,
    err?.code ?? `HTTP_${res.status}`,
    err?.message ?? `Hyperswitch returned HTTP ${res.status}`,
  )
}

function fail(status: number, code: string, message: string): HsResult<never> {
  return { ok: false, status, hsCode: code, error: { error: { code, message } } }
}

/** True for the dummy connector's "metadata written, propagation not implemented" 400 (engineering.md §3). */
export function isMetadataPropagationError(r: HsResult<unknown>): boolean {
  if (r.ok) return false
  return (
    r.hsCode === 'IR_20' ||
    (r.hsCode === 'CE_00' && r.error.error.message.includes('IR_20'))
  )
}

import { newAttemptId } from '../shared/attempt.ts'
import type { CartLine } from '../shared/types.ts'

// One live attempt id for the cart, in localStorage so a refresh, a second tab or a
// retransmission resumes the same Hyperswitch payment instead of creating another.
const KEY = 'slabbed.attempt'

interface Stored {
  attemptId: string
  contents: string
}

/** The cart's attempt id, reused while its contents are unchanged. Written before any fetch. */
export function attemptFor(lines: CartLine[]): string {
  const contents = JSON.stringify(lines.map((l) => [l.listingId, l.qty]).sort())
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null
    if (stored?.contents === contents) return stored.attemptId
  } catch {
    // unreadable: start a new attempt
  }
  const attemptId = newAttemptId()
  try {
    localStorage.setItem(KEY, JSON.stringify({ attemptId, contents }))
  } catch {
    // ponytail: no storage means no resume across refresh; HE_01 recovery still covers this tab
  }
  return attemptId
}

/** Forget the attempt once it is terminal, so the next checkout starts a fresh payment. */
export function clearAttempt(attemptId: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null
    if (stored?.attemptId === attemptId) localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

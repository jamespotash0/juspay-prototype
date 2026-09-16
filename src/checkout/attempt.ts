import { newAttemptId } from '../shared/attempt.ts'
import type { CartLine } from '../shared/types.ts'

// One live attempt id per seller group, in localStorage so a refresh, a second tab or a
// retransmission resumes the same Hyperswitch payment instead of creating another.
const key = (sellerId: string) => `slabbed.attempt.${sellerId}`

interface Stored {
  attemptId: string
  contents: string
}

/** The group's attempt id, reused while its contents are unchanged. Written before any fetch. */
export function attemptFor(sellerId: string, lines: CartLine[]): string {
  const contents = JSON.stringify(lines.map((l) => [l.listingId, l.qty]).sort())
  try {
    const stored = JSON.parse(
      localStorage.getItem(key(sellerId)) ?? 'null',
    ) as Stored | null
    if (stored?.contents === contents) return stored.attemptId
  } catch {
    // unreadable: start a new attempt
  }
  const attemptId = newAttemptId()
  try {
    localStorage.setItem(key(sellerId), JSON.stringify({ attemptId, contents }))
  } catch {
    // ponytail: no storage means no resume across refresh; HE_01 recovery still covers this tab
  }
  return attemptId
}

/** Forget the attempt once it is terminal, so the next checkout starts a fresh payment. */
export function clearAttempt(sellerId: string, attemptId: string) {
  try {
    const stored = JSON.parse(
      localStorage.getItem(key(sellerId)) ?? 'null',
    ) as Stored | null
    if (stored?.attemptId === attemptId) localStorage.removeItem(key(sellerId))
  } catch {
    // nothing to clear
  }
}

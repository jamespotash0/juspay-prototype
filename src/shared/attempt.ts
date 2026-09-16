/** Checkout attempt id, used as Hyperswitch payment_id: 'cka_' + 22 lowercase hex = 26 chars. */
export function newAttemptId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(11))
  return 'cka_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

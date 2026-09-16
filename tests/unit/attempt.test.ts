import { expect, it } from 'vitest'
import { newAttemptId } from '../../src/shared/attempt.ts'

it('is cka_ + 22 lowercase hex, 26 chars, within the 30-char payment_id limit', () => {
  const id = newAttemptId()
  expect(id).toMatch(/^cka_[0-9a-f]{22}$/)
  expect(id).toHaveLength(26)
  expect(id.length).toBeLessThanOrEqual(30)
})

it('is unique across many calls', () => {
  const ids = Array.from({ length: 10_000 }, newAttemptId)
  expect(new Set(ids).size).toBe(ids.length)
  ids.forEach((id) => expect(id).toMatch(/^cka_[0-9a-f]{22}$/))
})

import { expect, test } from '@playwright/test'
import { COPY } from '../src/shared/copy.ts'
import {
  logPayment,
  payByCard,
  payExpectingDecline,
  readOrder,
  startCheckout,
  switchPersona,
} from './helpers.ts'

// lst_014 (double_eagle_desk, total $3,146.20): >= $500, so the card goes to stripe_test deterministically.
test('5. Hard decline (generic): the buyer stays in checkout with the cart intact', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  await switchPersona(page, 'alex')
  const id = await startCheckout(page, 'lst_014')
  logPayment('journey5-decline', id)

  // A declined payment can't be confirmed again, so the sheet starts a fresh one behind the notice.
  const retry = page.waitForResponse(
    (r) => r.url().includes('/api/checkout') && r.request().method() === 'POST',
  )
  const notice = await payExpectingDecline(
    page,
    '4000000000000002',
    COPY.decline.generic.message,
  )
  await expect(notice).toContainText(COPY.checkout.hardDecline)

  const order = await readOrder(request, id)
  expect(order.state).toBe('failed')
  expect(order.connector).toBe('stripe_test')
  expect(order.decline?.reason).toBe('generic')
  expect(order.decline?.retriable).toBe(false)

  // Still in checkout, with the item, and on a new payment rather than the failed one.
  const next = (await (await retry).json()) as {
    paymentId: string
    breakdown: { totalCents: number }
  }
  expect(next.paymentId).not.toBe(id)
  // Same cart, same total: nothing was lost, and the form is ready for another card.
  expect(next.breakdown.totalCents).toBe(order.breakdown.totalCents)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Pay\b/ })).toBeVisible({
    timeout: 30_000,
  })
})

test('5b. Lost or stolen card: same treatment, and the next card pays', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  await switchPersona(page, 'alex')
  const id = await startCheckout(page, 'lst_014')
  logPayment('journey5b-lost-card', id)

  const notice = await payExpectingDecline(
    page,
    '4000000000009987',
    COPY.decline.lost_or_stolen.message,
  )
  await expect(notice).toContainText(COPY.checkout.hardDecline)

  const failed = await readOrder(request, id)
  expect(failed.state).toBe('failed')
  expect(failed.decline?.reason).toBe('lost_or_stolen')
  expect(failed.decline?.retriable).toBe(false)

  // The point of staying in checkout: another card pays without starting over.
  const paidId = await payByCard(page, '4242424242424242')
  logPayment('journey5b-recovered', paidId)
  expect(paidId).not.toBe(id)
  const paid = await readOrder(request, paidId)
  expect(paid.state).toBe('paid')
})

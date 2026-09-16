import { expect, test } from '@playwright/test'
import { COPY } from '../src/shared/copy.ts'
import {
  logPayment,
  payByCard,
  readOrder,
  startCheckout,
  switchPersona,
} from './helpers.ts'

// lst_014 (double_eagle_desk, total $3,146.20): >= $500, so the card goes to stripe_test deterministically.
test('5. Hard decline (generic): decline copy, and the cart keeps the item', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  await switchPersona(page, 'alex')
  await startCheckout(page, 'lst_014')
  const id = await payByCard(page, '4000000000000002')
  logPayment('journey5-decline', id)

  const notice = page.getByRole('alert').filter({ hasText: COPY.decline.generic.message })
  await expect(notice).toBeVisible({ timeout: 45_000 })
  await expect(notice).toContainText(COPY.checkout.hardDecline)

  const order = await readOrder(request, id)
  expect(order.state).toBe('failed')
  expect(order.connector).toBe('stripe_test')
  expect(order.decline?.reason).toBe('generic')
  expect(order.decline?.retriable).toBe(false)

  // The cart survives: badge still 1, and the retry action lands on a checkout that still has the item.
  await expect(page.getByLabel('1 item')).toBeVisible()
  await notice.getByRole('button', { name: COPY.decline.generic.action }).click()
  await expect(page).toHaveURL(/\/checkout\/sel_doubleeagle$/)
  await expect(page.getByText(COPY.checkoutPage.emptyGroup)).toBeHidden()
  await expect(page.getByText('1908 Saint-Gaudens Double Eagle')).toBeVisible()
})

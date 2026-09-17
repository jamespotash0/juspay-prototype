import { expect, test } from '@playwright/test'
import type { OrderView } from '../src/shared/types.ts'
import { logPayment, payByCard, readOrder } from './helpers.ts'

// A real two-seller purchase: one Check out button, one card payment, two seller orders after.
test('a two-seller cart checks out as one payment and confirms both orders', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem(
      'slabbed.session',
      JSON.stringify({ persona: 'alex', provider: 'email' }),
    )
    localStorage.setItem(
      'slabbed.cart',
      JSON.stringify([
        { listingId: 'lst_024', qty: 1 },
        { listingId: 'lst_005', qty: 1 },
      ]),
    )
  })
  await page.goto('/cart')
  await expect(page.getByRole('button', { name: /^Check out with/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Proceed to Checkout', exact: true }).click()

  const created = page.waitForResponse((r) => r.url().includes('/api/checkout'))
  await page.getByRole('button', { name: 'Continue to Payment' }).click()
  const body = (await (await created).json()) as {
    paymentId: string
    sellerIds: string[]
  }
  expect(body.sellerIds).toHaveLength(2)
  logPayment('multi-seller', body.paymentId)

  const id = await payByCard(page, '4242424242424242')
  expect(id).toBe(body.paymentId)
  await expect(page.getByText(id, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Shipped by / })).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByText('Visa ending in 4242')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Status' })).toHaveCount(2)

  // Report an issue on the first seller's order before it ships: only that order changes,
  // and the seller's money stays pending.
  await page.getByRole('button', { name: 'Have an issue?' }).first().click()
  const saved = page.waitForResponse((r) => r.url().includes('/api/order-state'))
  await page.getByRole('button', { name: "It hasn't shipped" }).click()
  await page.getByRole('button', { name: 'Request refund' }).click()
  const disputed = (await (await saved).json()) as OrderView
  expect(disputed.fulfilment).toBe('disputed')
  expect(disputed.ledger.balance).toBe('pending')
  const other = await readOrder(page.request, `${id}.sel_bluesheet`)
  expect(other.fulfilment).toBe('unshipped')
  await expect(page.getByRole('button', { name: 'Have an issue?' })).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath('order.png'), fullPage: true })
})

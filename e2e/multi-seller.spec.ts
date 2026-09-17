import { expect, test } from '@playwright/test'
import { LISTINGS } from '../src/shared/seed.ts'
import type { OrderView } from '../src/shared/types.ts'
import { logPayment, payByCard, readOrder } from './helpers.ts'

// A real two-seller purchase: one Check out button, one card payment, two seller orders after.
test('a two-seller cart checks out as one payment and confirms both orders', async ({
  page,
}) => {
  // Every seeded listing is Mike's, so the second seller is a created (usr_) listing.
  const bluesheet = {
    ...LISTINGS.find((l) => l.id === 'lst_005')!,
    id: 'usr_multiseller_e2e',
    sellerId: 'sel_bluesheet',
  }
  await page.addInitScript((other) => {
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('slabbed.userListings', JSON.stringify([other]))
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem(
      'slabbed.session',
      JSON.stringify({ persona: 'alex', provider: 'email' }),
    )
    localStorage.setItem(
      'slabbed.cart',
      JSON.stringify([
        { listingId: 'lst_024', qty: 1 },
        { listingId: other.id, qty: 1 },
      ]),
    )
  }, bluesheet)
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
  await expect(page.locator('[aria-current="step"]')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByText('Visa ending in 4242')).toBeVisible()

  // Report an issue on the first seller's order before it ships: only that order changes,
  // and the seller's money stays pending.
  await page.getByText('Have a problem?').first().click()
  const saved = page.waitForResponse((r) => r.url().includes('/api/order-state'))
  await page.getByRole('button', { name: 'Cancel and refund' }).click()
  await page.getByRole('button', { name: 'Request cancellation' }).click()
  const disputed = (await (await saved).json()) as OrderView
  expect(disputed.fulfilment).toBe('disputed')
  expect(disputed.ledger.balance).toBe('pending')
  const other = await readOrder(page.request, `${id}.sel_bluesheet`)
  expect(other.fulfilment).toBe('unshipped')
  await expect(page.getByText('Have a problem?')).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath('order.png'), fullPage: true })
})

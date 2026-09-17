import { expect, test } from '@playwright/test'

// Starts a real (unconfirmed) sandbox payment: the SDK only mounts after "Continue to payment"
// has fetched a client_secret. No card entry.
test('checkout mounts the Hyperswitch SDK iframe for a seeded listing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'slabbed.session',
      JSON.stringify({ persona: 'alex', provider: 'email' }),
    )
    localStorage.setItem(
      'slabbed.cart',
      JSON.stringify([{ listingId: 'lst_002', qty: 1 }]),
    )
  })
  await page.goto('/cart?checkout')
  await page.getByRole('button', { name: 'Continue to Payment' }).click()
  await expect(page.locator('iframe[src*="hyperswitch.io"]').first()).toBeVisible({
    timeout: 20_000,
  })
})

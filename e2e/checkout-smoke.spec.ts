import { expect, test } from '@playwright/test'

// Starts a real (unconfirmed) sandbox payment: the SDK only mounts after "Continue to payment"
// has fetched a client_secret. No card entry.
test('checkout mounts the Hyperswitch SDK iframe for a seeded listing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('slabbed.persona', JSON.stringify('alex'))
    localStorage.setItem('slabbed.cart', JSON.stringify([{ listingId: 'lst_002', qty: 1 }]))
  })
  await page.goto('/checkout/mike')
  await page.getByRole('button', { name: 'Continue to payment' }).click()
  await expect(page.locator('iframe[src*="hyperswitch.io"]').first()).toBeVisible({
    timeout: 20_000,
  })
})

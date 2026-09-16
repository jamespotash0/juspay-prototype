import { expect, test } from '@playwright/test'

// The account page against the live sandbox: Alex's saved Visa is read from Hyperswitch.
// Nothing is deleted: removing a card is checked only for a card this account doesn't own.
test('account: name, saved cards, buying/selling switch, sign out', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem(
      'slabbed.session',
      JSON.stringify({ persona: 'alex', provider: 'google' }),
    )
  })
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible()

  await page.getByLabel('Name').fill('Alex R.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Account: Alex R.' })).toBeVisible()

  await expect(page.getByText(/Visa ending in 4242/).first()).toBeVisible({
    timeout: 20_000,
  })
  const foreign = await page.request.delete(
    '/api/payment-methods?customer=alex&id=pm_not_this_customers',
  )
  expect(foreign.status()).toBe(404)
  await page.screenshot({ path: test.info().outputPath('account.png'), fullPage: true })

  const bar = page.getByRole('banner')
  await bar.getByRole('button', { name: 'Selling' }).click()
  await expect(page).toHaveURL(/\/sell$/)
  await expect(bar.getByRole('link', { name: 'Orders' })).toHaveCount(0)
  await bar.getByRole('button', { name: 'Buying' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(bar.getByRole('link', { name: 'Orders' })).toBeVisible()

  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(bar.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

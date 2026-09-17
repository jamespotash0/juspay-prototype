import { expect, test } from '@playwright/test'

// The account page against the live sandbox: Alex's saved Visa is read from Hyperswitch.
// Nothing is deleted: removing a card is checked only for a card this account doesn't own.
test('account: name, saved cards, nav, sign out', async ({ page }) => {
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
  for (const name of ['Shop', 'Orders', 'Sell'])
    await expect(bar.getByRole('link', { name, exact: true })).toBeVisible()

  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(bar.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

// Saves a real card through the SDK on a $0 payment, sees it listed, then removes it again.
test('account: add a card through Hyperswitch, link demo PayPal, reset', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem(
      'slabbed.session',
      JSON.stringify({ persona: 'mike', provider: 'email' }),
    )
  })
  await page.goto('/account')
  const methods = page.locator('section[aria-labelledby="methods"]')
  await expect(methods.getByText(/Loading saved cards/)).toHaveCount(0, {
    timeout: 20_000,
  })
  await page.getByRole('button', { name: 'Add a card' }).click()

  const fields = page
    .frameLocator(
      'iframe[name="orca-payment-element-iframeRef-orca-elements-payment-element-unified-checkout"]',
    )
    .frameLocator(
      'iframe[name="orca-payment-element-iframeRef-parent-card-inner-iframe-container"]',
    )
  const inputs = [
    [fields.locator('[data-testid="cardNoInput"]'), '5555555555554444'],
    [fields.locator('[data-testid="expiryInput"]'), '1131'],
    [fields.locator('[data-testid="cvvInput"]'), '123'],
  ] as const
  await expect(inputs[0][0]).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: test.info().outputPath('add-card.png'), fullPage: true })
  await expect(async () => {
    for (const [input, value] of inputs) {
      await input.clear()
      await input.pressSequentially(value)
    }
    for (const [input] of inputs)
      await expect(input).not.toHaveValue('', { timeout: 1_000 })
  }).toPass({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Save card' }).click()

  const saved = methods.getByText('Mastercard ending in 4444')
  await expect(saved).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: test.info().outputPath('saved.png'), fullPage: true })

  page.once('dialog', (d) => d.accept())
  await methods
    .locator('li')
    .filter({ hasText: 'Mastercard ending in 4444' })
    .getByRole('button', { name: 'Remove' })
    .click()
  await expect(saved).toHaveCount(0, { timeout: 20_000 })

  await page.getByRole('button', { name: 'Link PayPal' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Linked as mike@example.com')).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Sign in' }),
  ).toBeVisible()
})

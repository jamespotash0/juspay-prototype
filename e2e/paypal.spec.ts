import { expect, test } from '@playwright/test'
import {
  logPayment,
  paypalButton,
  readOrder,
  startCheckout,
  switchPersona,
} from './helpers.ts'

// PayPal always routes to paypal_test, whatever the amount. lst_005 (blue_sheet_coins) keeps it small.
test('6. PayPal: redirect to the simulated PayPal page, complete it, back to a paid order', async ({
  page,
  request,
}, info) => {
  test.setTimeout(150_000)
  await switchPersona(page, 'alex')
  const id = await startCheckout(page, 'lst_005')

  // Keep the SDK's confirm answer (status + Hyperswitch error code only) to explain a failed redirect.
  let confirm = 'no confirm request seen'
  page.on('request', (r) => {
    if (r.url().endsWith(`/payments/${id}/confirm`))
      confirm = 'confirm sent, no answer yet'
  })
  page.on('response', async (r) => {
    if (!r.url().endsWith(`/payments/${id}/confirm`)) return
    const body = (await r.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string }
    }
    confirm = `confirm ${r.status()} ${body.error?.code ?? ''} ${body.error?.message ?? ''}`
  })
  // The wallet button renders before its PayPal script is ready and ignores early clicks.
  // Click again only while no confirm has been sent, so this can never confirm twice.
  await expect(async () => {
    if (confirm === 'no confirm request seen') await paypalButton(page).click()
    await expect
      .poll(() => confirm, { timeout: 5_000 })
      .not.toBe('no confirm request seen')
  }).toPass({ timeout: 60_000 })
  await page
    .waitForURL((url) => url.hostname !== 'localhost', { timeout: 45_000 })
    .catch(async () => {
      await page.screenshot({
        path: info.outputPath('paypal-no-redirect.png'),
        fullPage: true,
      })
      throw new Error(
        `No redirect to PayPal after clicking the SDK's PayPal button: ${confirm}`,
      )
    })
  await page.waitForLoadState('domcontentloaded')
  await page.screenshot({
    path: info.outputPath('paypal-simulated-page.png'),
    fullPage: true,
  })
  console.log(`PAYPAL_PAGE ${new URL(page.url()).origin}${new URL(page.url()).pathname}`)

  // The simulator's completion control. Recorded with a screenshot above in case its wording changes.
  await page
    .getByRole('button', { name: /complete|authori[sz]e|approve|pay|success|continue/i })
    .first()
    .click({ timeout: 30_000 })

  await page.waitForURL(new RegExp(`/order/${id}`), { timeout: 60_000 })
  logPayment('journey6-paypal', id)
  await expect(page.locator('[aria-current="step"]').first()).toBeVisible({
    timeout: 45_000,
  })
  const order = await readOrder(request, id)
  expect(order.state).toBe('paid')
  expect(order.paymentMethodType).toBe('paypal')
  expect(order.connector).toBe('paypal_test')
})

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import type { OrderView, PersonaId } from '../src/shared/types.ts'

// Browser checkouts are tagged source 'app': each paid one becomes a real demo order.
// Every id is logged so the run can report what it created.
export function logPayment(label: string, id: string) {
  console.log(`PAYMENT_ID ${label} ${id}`)
}

/** Switch persona the way a reviewer does: the demo account select on the account page. */
export async function switchPersona(page: Page, persona: PersonaId) {
  await page.goto('/account')
  await page.getByLabel('Demo account').selectOption(persona)
}

/** Listing page → Buy now → demo sign-in → Continue to payment. Leaves the SDK mounted. */
export async function startCheckout(page: Page, listingId: string) {
  await page.goto(`/listing/${listingId}`)
  await page.getByRole('button', { name: 'Buy now' }).click()
  // The demo sign-in gate shows once per browser session per persona, so only click it if it's there.
  const gate = page.getByRole('button', { name: 'Continue with email' })
  const next = page.getByRole('button', { name: 'Continue to payment' })
  await expect(gate.or(next)).toBeVisible()
  if (await gate.isVisible()) await gate.click()
  const created = page.waitForResponse((r) => r.url().includes('/api/checkout'))
  await page.getByRole('button', { name: 'Continue to payment' }).click()
  const { paymentId } = (await (await created).json()) as { paymentId: string }
  logPayment(`created-for-${listingId}`, paymentId)
  return paymentId
}

const sdk = (page: Page) =>
  page.frameLocator(
    'iframe[name="orca-payment-element-iframeRef-orca-elements-payment-element-unified-checkout"]',
  )

/** Card details go into the Hyperswitch iframe only, never our DOM. Returns the new order's payment id. */
export async function payByCard(page: Page, card: string): Promise<string> {
  const fields = sdk(page).frameLocator(
    'iframe[name="orca-payment-element-iframeRef-parent-card-inner-iframe-container"]',
  )
  const inputs = [
    [fields.locator('[data-testid="cardNoInput"]'), card],
    [fields.locator('[data-testid="expiryInput"]'), '1230'],
    [fields.locator('[data-testid="cvvInput"]'), '123'],
  ] as const
  // A buyer with a saved card sees that card first; typing a card needs the new-method form.
  const newMethod = sdk(page).getByText('New payment methods')
  // The two live in different iframes, so .or() can't combine them: poll for either.
  await expect(async () => {
    expect((await inputs[0][0].isVisible()) || (await newMethod.isVisible())).toBe(true)
  }).toPass({ timeout: 30_000 })
  if (await newMethod.isVisible()) await newMethod.click()
  await expect(inputs[0][0]).toBeVisible({ timeout: 30_000 })
  // The SDK can re-render its fields just after they appear and drop what was typed; retype until all three hold.
  await expect(async () => {
    for (const [input, value] of inputs) {
      await input.clear()
      await input.pressSequentially(value)
    }
    for (const [input] of inputs)
      await expect(input).not.toHaveValue('', { timeout: 1_000 })
  }).toPass({ timeout: 30_000 })
  // The button reads "Pay $X.XX" once the server total is known.
  await page.getByRole('button', { name: /^Pay\b/ }).click()
  await page
    .waitForURL(/\/order\/cka_[0-9a-f]{22}$/, { timeout: 45_000 })
    .catch(async (err) => {
      await page.screenshot({
        path: test.info().outputPath('pay-stuck.png'),
        fullPage: true,
      })
      throw err
    })
  return page.url().split('/order/')[1]
}

export function paypalButton(page: Page) {
  // The wallet button has no text or label, only the PayPal logo; it is the first button in the SDK frame.
  return sdk(page).locator('button').first()
}

export async function readOrder(
  request: APIRequestContext,
  id: string,
): Promise<OrderView> {
  const res = await request.get(`/api/payment?id=${id}`)
  expect(res.status()).toBe(200)
  return (await res.json()) as OrderView
}

/** A sale row on /sell. Rows don't show the payment id, so find its position in the list the page loaded. */
export async function saleRow(page: Page, paymentId: string) {
  const loaded = page.waitForResponse((r) => r.url().includes('/api/orders?seller='), {
    timeout: 30_000,
  })
  await page.goto('/sell')
  const { orders } = (await (await loaded).json()) as { orders: OrderView[] }
  const index = orders.findIndex((o) => o.paymentId === paymentId)
  expect(index, `sale ${paymentId} on /sell`).toBeGreaterThanOrEqual(0)
  const row = page.locator('section:has(> h2:text-is("Your sales")) > ul > li').nth(index)
  // The page can fire this request more than once (persona change, dev-mode double effects), and a
  // cold /api/orders takes ~5 s — so the list may still read "Loading sales…" after the first reply.
  await expect(row).toBeVisible({ timeout: 30_000 })
  return row
}

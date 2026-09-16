import { expect, test, type Page } from '@playwright/test'
import { COPY } from '../src/shared/copy.ts'
import {
  logPayment,
  payByCard,
  readOrder,
  saleRow,
  startCheckout,
  switchPersona,
} from './helpers.ts'

// Journeys 1–4 share state (the order bought in 1 is shipped in 2, received in 3), so they run in order
// on one page, switching persona through the top bar like a reviewer would.
// lst_024 is Mike's, total $1,225: >= $500, so routing always picks stripe_test.
const LISTING = 'lst_024'

test.describe.configure({ mode: 'serial', timeout: 120_000 })

let page: Page
let first = ''
let second = ''

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage({ baseURL: info.project.use.baseURL })
})
test.afterAll(async () => {
  await page.close()
})

async function buy(label: string) {
  await switchPersona(page, 'alex')
  await startCheckout(page, LISTING)
  const id = await payByCard(page, '4242424242424242')
  logPayment(label, id)
  await expect(page.getByText(COPY.checkout.succeeded)).toBeVisible({ timeout: 45_000 })
  return id
}

async function ship(id: string) {
  await switchPersona(page, 'mike')
  const row = await saleRow(page, id)
  // Wait on the write itself: the row shows a "Pending → Available" track before shipping,
  // so waiting for the word "Available" returned before the ship had landed.
  const saved = page.waitForResponse(
    (r) => r.url().includes('/api/order-state') && r.request().method() === 'POST',
  )
  await row.getByRole('button', { name: COPY.orderActions.ship }).click()
  expect((await saved).status()).toBe(200)
}

test('1. Alex buys a >= $500 listing with 4242: paid on stripe_test', async ({
  request,
}) => {
  first = await buy('journey1')
  const order = await readOrder(request, first)
  expect(order.state).toBe('paid')
  expect(order.connector).toBe('stripe_test')
})

test('2. Mike marks the sale shipped: ledger available', async ({ request }) => {
  await ship(first)
  expect((await readOrder(request, first)).ledger.balance).toBe('available')
})

test('3. Alex marks the order received', async ({ request }) => {
  await switchPersona(page, 'alex')
  await page.goto(`/order/${first}`)
  await page.getByRole('button', { name: COPY.orderActions.receive }).click()
  await expect(page.getByRole('button', { name: COPY.orderActions.receive })).toBeHidden({
    timeout: 20_000,
  })
  expect((await readOrder(request, first)).fulfilment).toBe('received')
})

test('4. Dispute → admin sees it → full refund → order refunded, sale reversed', async ({
  request,
}) => {
  const reason = `E2E: slab cracked in transit (${Date.now()})`
  second = await buy('journey4')
  await ship(second)

  // Alex disputes with a reason.
  await switchPersona(page, 'alex')
  await page.goto(`/order/${second}`)
  await page.getByRole('button', { name: COPY.orderActions.dispute }).click()
  await page.getByLabel(COPY.order.disputeReason).fill(reason)
  const disputed = page.waitForResponse(
    (r) => r.url().includes('/api/order-state') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: COPY.orderActions.dispute }).click()
  expect((await disputed).status()).toBe(200)

  // Admin: the disputes filter lists it; its payment page shows the reason; refund in full.
  await switchPersona(page, 'admin')
  await page.goto('/admin')
  await page.getByRole('button', { name: /^Disputes/ }).click()
  await page.getByRole('link', { name: second }).click({ timeout: 30_000 })
  await expect(page.getByText(reason)).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: COPY.orderActions.refund, exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Refund \$/ })
    .click()
  await expect(page.getByText(COPY.adminPayment.refundDoneTitle)).toBeVisible({
    timeout: 30_000,
  })

  // Alex's order shows refunded.
  await switchPersona(page, 'alex')
  await page.goto(`/order/${second}`)
  await expect(page.getByText(COPY.postPayment.refundSucceededBuyer)).toBeVisible({
    timeout: 20_000,
  })
  const order = await readOrder(request, second)
  expect(order.refund.state).toBe('succeeded')
  expect(order.ledger.balance).toBe('reversed')

  // Mike's sale is reversed, fee and net $0.
  await switchPersona(page, 'mike')
  const row = await saleRow(page, second)
  await expect(row.getByText(COPY.sell.reversed, { exact: true })).toBeVisible()
  const ledger = row.locator('dl')
  await expect(ledger.locator('dd').nth(1)).toHaveText('$0.00')
  await expect(ledger.locator('dd').nth(2)).toHaveText('$0.00')
})

import { expect, test } from '@playwright/test'
import type { OrderView } from '../src/shared/types.ts'

// No real payment: GET /api/payment is stubbed to stay 'pending' forever, so the order page's
// ~30 s polling window runs out. That window is the app's own, hence the long timeout.
const ID = 'cka_00000000000000000000e2'
const PENDING: OrderView = {
  orderId: `${ID}.mike`,
  paymentId: ID,
  state: 'pending',
  fulfilment: 'unshipped',
  refund: { state: 'none', refundedCents: 0 },
  breakdown: {
    itemsCents: 112500,
    shippingCents: 1000,
    taxCents: 9000,
    totalCents: 122500,
  },
  ledger: {
    grossCents: 113500,
    commissionCents: 5625,
    netCents: 107875,
    refundedCents: 0,
    balance: 'pending',
  },
  sellerId: 'mike',
  buyerId: 'alex',
  listingIds: ['lst_024'],
  createdAt: new Date().toISOString(),
}

test('7. Polling times out → ambiguous notice → Check again only re-reads', async ({
  page,
}) => {
  test.setTimeout(120_000)
  let reads = 0
  const writes: string[] = []
  await page.route(
    (url) => url.pathname === '/api/payment',
    (route) => {
      reads++
      return route.fulfill({ json: PENDING })
    },
  )
  page.on('request', (r) => {
    const url = r.url()
    if (url.includes('/api/') && !url.includes('/api/payment'))
      writes.push(`${r.method()} ${url}`)
    if (url.includes('hyperswitch.io')) writes.push(`${r.method()} ${url}`)
  })

  await page.goto(`/order/${ID}`)
  const notice = page.getByRole('alert').filter({
    hasText: "We're not sure whether that went through. Don't pay again yet.",
  })
  await expect(notice).toBeVisible({ timeout: 45_000 })

  const before = reads
  await notice.getByRole('button', { name: 'Check again' }).click()
  await expect(notice).toBeHidden()
  await expect.poll(() => reads).toBeGreaterThan(before)
  // A full second round: it ends ambiguous again, having only read.
  await expect(notice).toBeVisible({ timeout: 45_000 })
  expect(writes).toEqual([])
})

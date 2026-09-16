// Seller insights on /sell (DES-7b). Kept apart from copy.ts, which DES-7a owns in W4.

const sales = (n: number) => `${n} ${n === 1 ? 'sale' : 'sales'}`

export const INSIGHTS_COPY = {
  title: 'Sales and payouts',
  lead: 'What you have earned after commission, sale by sale and over time.',

  gross: 'Gross sold (items + shipping)',
  reversed: 'Reversed by refund',
  commission: 'Commission',
  net: 'Net earned',
  available: 'Available now',
  pending: 'Pending (expected)',
  sales,
  shippedSales: (n: number) => `${sales(n)} shipped`,
  unshippedSales: (n: number) => `${sales(n)} not shipped yet`,
  refundedSales: (n: number) => `${sales(n)} refunded`,
  commissionNote: 'Taken when you mark a sale shipped. None on refunded sales.',

  chartTitle: (week: boolean) => (week ? 'Net earned per week' : 'Net earned per day'),
  chartSummary: (net: string, count: number, from: string, to: string) =>
    `${net} net from ${sales(count)} between ${from} and ${to}. Refunded sales count as $0.`,
  weekOf: (date: string) => `Week of ${date}`,
  showTable: 'Show as a table',
  period: (week: boolean) => (week ? 'Week of' : 'Day'),
  refunded: 'Refunded',
}

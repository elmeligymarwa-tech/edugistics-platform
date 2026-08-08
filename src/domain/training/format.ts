/** Simple currency formatting for the training module — kept separate from src/lib/format.ts, which is built around the school-planning app's CurrencyMeta and shouldn't be reused for an unrelated domain. */
export function formatCourseFee(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount)}`
}

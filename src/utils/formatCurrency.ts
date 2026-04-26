export function formatCurrency(value: number, currency = 'NGN'): string {
  if (!isFinite(value)) return '—'
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  }
  const sym = symbols[currency] ?? currency + ' '
  if (Math.abs(value) >= 1_000_000_000)
    return `${sym}${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000)
    return `${sym}${(value / 1_000_000).toFixed(2)}M`
  return `${sym}${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

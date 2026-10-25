// Ledger aggregates can exceed Number's cent precision even when individual payments do not.
export function decimalCents(value: string): bigint {
  if (!/^\d{1,40}(\.\d{1,2})?$/.test(value))
    throw new Error('Importe de cuenta inesperado.')
  const [whole = '0', fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export function accountMoney(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error('Importe de cuenta inesperado.')
  const cents = decimalCents(String(value))
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}
export function formatAccountMoney(value: string): string {
  const cents = decimalCents(value)
  return `S/ ${new Intl.NumberFormat('es-PE').format(cents / 100n)}.${(cents % 100n).toString().padStart(2, '0')}`
}

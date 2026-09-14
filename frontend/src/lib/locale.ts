const money = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const date = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Lima',
})
export function formatMoney(value: number): string {
  return `S/ ${money.format(value)}`
}
export function formatDate(value: Date): string {
  return date.format(value)
}

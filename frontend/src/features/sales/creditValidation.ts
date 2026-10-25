import type { PaymentMethod } from '../../lib/payments.ts'
export function creditSaleError(
  method: PaymentMethod,
  customerId: number | null,
  total: number,
): string {
  if (method !== 'CREDIT') return ''
  if (customerId === null)
    return 'Selecciona un cliente para registrar una venta fiada.'
  return total <= 0 ? 'La venta fiada debe tener un importe mayor a cero.' : ''
}

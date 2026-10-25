import { payments } from '../../lib/payments.ts'
import type { PaymentMethod } from '../../lib/payments.ts'
export interface CustomerPurchase {
  id: number
  total: number
  paymentMethod: PaymentMethod
  createdAt: string
}
export interface CustomerPurchases {
  items: CustomerPurchase[]
  total: number
  page: number
  size: number
}
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function parseCustomerPurchases(value: unknown): CustomerPurchases {
  if (!value || typeof value !== 'object')
    throw new Error('Historial de compras inesperado.')
  const page = value as Record<string, unknown>
  if (
    !Array.isArray(page.items) ||
    !integer(page.total) ||
    !integer(page.page) ||
    !integer(page.size) ||
    page.size < 1 ||
    page.size > 100 ||
    page.items.length > page.size
  )
    throw new Error('Historial de compras inesperado.')
  const items = page.items.map((value: unknown): CustomerPurchase => {
    if (!value || typeof value !== 'object')
      throw new Error('Compra inesperada.')
    const row = value as Record<string, unknown>
    if (
      !integer(row.id) ||
      row.id < 1 ||
      typeof row.total !== 'number' ||
      !Number.isFinite(row.total) ||
      row.total < 0 ||
      typeof row.paymentMethod !== 'string' ||
      !Object.hasOwn(payments, row.paymentMethod) ||
      typeof row.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(row.createdAt))
    )
      throw new Error('Compra inesperada.')
    return {
      id: row.id,
      total: row.total,
      paymentMethod: row.paymentMethod as PaymentMethod,
      createdAt: row.createdAt,
    }
  })
  return { items, total: page.total, page: page.page, size: page.size }
}

export const payments = {
  CASH: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia',
} as const
export type PaymentMethod = keyof typeof payments
export interface SaleRow {
  id: number
  total: number
  paymentMethod: PaymentMethod
  createdBy: number
  createdAt: string
}
export interface SaleItem {
  productId: number
  productName: string
  unitPrice: number
  quantity: number
  subtotal: number
}
export interface Sale extends SaleRow {
  items: SaleItem[]
}
export interface SalePage {
  items: SaleRow[]
  total: number
  page: number
  size: number
}
export interface SaleSummary {
  total: number
  count: number
  date: string
}
export interface SaleRequest {
  requestId: string
  paymentMethod: PaymentMethod
  items: { productId: number; quantity: number }[]
}
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
function number(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}
function integer(v: unknown): v is number {
  return number(v) && Number.isSafeInteger(v)
}
export function parseRow(v: unknown): SaleRow {
  if (
    !record(v) ||
    !integer(v.id) ||
    v.id < 1 ||
    !number(v.total) ||
    !integer(v.createdBy) ||
    typeof v.createdAt !== 'string' ||
    typeof v.paymentMethod !== 'string' ||
    !Object.hasOwn(payments, v.paymentMethod)
  )
    throw new Error('No pudimos leer la venta.')
  return {
    id: v.id,
    total: v.total,
    createdBy: v.createdBy,
    createdAt: v.createdAt,
    paymentMethod: v.paymentMethod as PaymentMethod,
  }
}
export function parseSale(v: unknown): Sale {
  const row = parseRow(v)
  if (!record(v) || !Array.isArray(v.items))
    throw new Error('No pudimos leer el detalle.')
  const items = v.items.map((item: unknown): SaleItem => {
    if (
      !record(item) ||
      !integer(item.productId) ||
      !integer(item.quantity) ||
      item.quantity < 1 ||
      typeof item.productName !== 'string' ||
      !number(item.unitPrice) ||
      !number(item.subtotal)
    )
      throw new Error('Detalle de venta inesperado.')
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }
  })
  return { ...row, items }
}
export function parseSales(v: unknown): SalePage {
  if (
    !record(v) ||
    !Array.isArray(v.items) ||
    !integer(v.total) ||
    !integer(v.page) ||
    !integer(v.size)
  )
    throw new Error('No pudimos leer las ventas.')
  return {
    items: v.items.map(parseRow),
    total: v.total,
    page: v.page,
    size: v.size,
  }
}
export function parseSaleSummary(v: unknown): SaleSummary {
  if (
    !record(v) ||
    !number(v.total) ||
    !integer(v.count) ||
    typeof v.date !== 'string'
  )
    throw new Error('No pudimos leer el resumen de ventas.')
  return { total: v.total, count: v.count, date: v.date }
}

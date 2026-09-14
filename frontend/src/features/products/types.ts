export interface Product {
  id: number
  name: string
  sku: string | null
  salePrice: number
  costPrice: number | null
  stock: number
  minimumStock: number
  lowStock: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}
export interface ProductPage {
  items: Product[]
  total: number
  page: number
  size: number
}
export interface ProductSummary {
  activeProducts: number
  lowStockProducts: number
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function money(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 99999999.99
  )
}
export function parseProduct(value: unknown): Product {
  if (
    !object(value) ||
    !count(value.id) ||
    value.id === 0 ||
    typeof value.name !== 'string' ||
    !(value.sku === null || typeof value.sku === 'string') ||
    !money(value.salePrice) ||
    !(value.costPrice === null || money(value.costPrice)) ||
    !count(value.stock) ||
    !count(value.minimumStock) ||
    typeof value.active !== 'boolean' ||
    typeof value.lowStock !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  )
    throw new Error('No pudimos leer el producto. Intenta nuevamente.')
  return {
    id: value.id,
    name: value.name,
    sku: value.sku,
    salePrice: value.salePrice,
    costPrice: value.costPrice,
    stock: value.stock,
    minimumStock: value.minimumStock,
    active: value.active,
    lowStock: value.lowStock,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}
export function parsePage(value: unknown): ProductPage {
  if (
    !object(value) ||
    !Array.isArray(value.items) ||
    !count(value.total) ||
    !count(value.page) ||
    !count(value.size)
  )
    throw new Error('No pudimos leer tus productos.')
  return {
    items: value.items.map(parseProduct),
    total: value.total,
    page: value.page,
    size: value.size,
  }
}
export function parseSummary(value: unknown): ProductSummary {
  if (
    !object(value) ||
    !count(value.activeProducts) ||
    !count(value.lowStockProducts)
  )
    throw new Error('No pudimos consultar el resumen.')
  return {
    activeProducts: value.activeProducts,
    lowStockProducts: value.lowStockProducts,
  }
}

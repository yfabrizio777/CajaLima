import { decimalCents } from '../accounts/money.ts'
import { collectionMethods } from '../../lib/payments.ts'
import type { CollectionMethod } from '../../lib/payments.ts'
export type Kind = 'expenses' | 'purchases'
export const categories = {
  RENT: 'Alquiler',
  SERVICES: 'Servicios',
  TRANSPORT: 'Transporte',
  SUPPLIES: 'Insumos',
  MAINTENANCE: 'Mantenimiento',
  OTHER: 'Otros',
}
export interface Line {
  productId: number
  productName: string
  quantity: string
  unitCost: string
}
export interface Values {
  description: string
  category: string
  amount: string
  paymentMethod: string
  date: string
  notes: string
  supplierName: string
  items: Line[]
}
export function peruToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
export function initialSpending(): Values {
  return {
    description: '',
    category: 'OTHER',
    amount: '',
    paymentMethod: 'CASH',
    date: peruToday(),
    notes: '',
    supplierName: '',
    items: [],
  }
}
export function validDate(date: unknown): date is string {
  return (
    typeof date === 'string' &&
    /^20\d{2}-\d{2}-\d{2}$|^2100-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  )
}
function cents(value: string, digits: number) {
  if (!new RegExp(`^\\d{1,${digits}}(\\.\\d{1,2})?$`).test(value))
    throw new Error('Revisa el importe.')
  return decimalCents(value)
}
function money(c: bigint) {
  return `${c / 100n}.${String(c % 100n).padStart(2, '0')}`
}
export function purchaseTotal(lines: Line[]) {
  return money(
    lines.reduce(
      (sum, line) => sum + cents(line.unitCost, 8) * BigInt(line.quantity),
      0n,
    ),
  )
}
export function validateSpending(
  kind: Kind,
  v: Values,
  editing = false,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!v.description.trim() || v.description.trim().length > 160)
    errors.description = 'Escribe una descripción de hasta 160 caracteres.'
  if (v.notes.trim().length > 500) errors.notes = 'Usa hasta 500 caracteres.'
  if (v.supplierName.trim().length > 160)
    errors.supplierName = 'Usa hasta 160 caracteres.'
  if (editing) return errors
  if (!Object.hasOwn(collectionMethods, v.paymentMethod))
    errors.paymentMethod = 'Selecciona cómo pagaste.'
  if (!validDate(v.date))
    errors.date = 'Elige una fecha válida entre 2000 y 2100.'
  if (kind === 'expenses') {
    if (!Object.hasOwn(categories, v.category))
      errors.category = 'Elige una categoría.'
    try {
      if (cents(v.amount, 12) <= 0n) throw new Error()
    } catch {
      errors.amount = 'Escribe un monto mayor a cero con hasta dos decimales.'
    }
  } else {
    try {
      if (
        !v.items.length ||
        v.items.length > 100 ||
        new Set(v.items.map((i) => i.productId)).size !== v.items.length
      )
        throw new Error()
      for (const i of v.items)
        if (
          !Number.isSafeInteger(i.productId) ||
          i.productId <= 0 ||
          !/^\d{1,7}$/.test(i.quantity) ||
          Number(i.quantity) < 1 ||
          Number(i.quantity) > 1000000 ||
          cents(i.unitCost, 8) <= 0n
        )
          throw new Error()
      if (decimalCents(purchaseTotal(v.items)) > 99999999999999n)
        throw new Error()
    } catch {
      errors.items =
        'Agrega productos distintos, cantidades de 1 a 1 000 000 y costos positivos de hasta dos decimales. Revisa el total.'
    }
  }
  return errors
}
export interface SpendingRow {
  id: number
  description: string
  category: keyof typeof categories | null
  supplierName: string | null
  amount: string
  paymentMethod: CollectionMethod
  date: string
  notes: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
}
export interface SpendingPage {
  items: SpendingRow[]
  total: number
  page: number
  size: number
}
export interface Detail {
  record: SpendingRow
  items: {
    id: number
    productId: number
    productName: string
    quantity: number
    unitCost: string
    subtotal: string
  }[]
}
export function object(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
function count(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
}
function financial(v: unknown): string {
  if (
    typeof v !== 'string' ||
    !/^\d{1,12}\.\d{2}$/.test(v) ||
    decimalCents(v) <= 0n
  )
    throw new Error('Importe inesperado.')
  return v
}
export function parseRow(kind: Kind, v: unknown): SpendingRow {
  if (
    !object(v) ||
    !count(v.id) ||
    !v.id ||
    typeof v.description !== 'string' ||
    !v.description.trim() ||
    typeof v.paymentMethod !== 'string' ||
    !Object.hasOwn(collectionMethods, v.paymentMethod) ||
    !count(v.createdBy) ||
    !v.createdBy ||
    typeof v.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(v.createdAt)) ||
    typeof v.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(v.updatedAt)) ||
    !(v.notes === null || typeof v.notes === 'string')
  )
    throw new Error('No pudimos leer el registro.')
  const date = kind === 'expenses' ? v.expenseDate : v.purchaseDate
  if (!validDate(date)) throw new Error('Fecha inesperada.')
  if (
    kind === 'expenses' &&
    (typeof v.category !== 'string' || !Object.hasOwn(categories, v.category))
  )
    throw new Error('Categoría inesperada.')
  if (
    kind === 'purchases' &&
    !(v.supplierName === null || typeof v.supplierName === 'string')
  )
    throw new Error('Proveedor inesperado.')
  return {
    id: v.id,
    description: v.description,
    category:
      kind === 'expenses' ? (v.category as keyof typeof categories) : null,
    supplierName:
      kind === 'purchases' ? (v.supplierName as string | null) : null,
    amount: financial(kind === 'expenses' ? v.amount : v.total),
    paymentMethod: v.paymentMethod as CollectionMethod,
    date,
    notes: v.notes,
    createdBy: v.createdBy,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }
}
export function parseSpendingPage(kind: Kind, v: unknown): SpendingPage {
  if (
    !object(v) ||
    !Array.isArray(v.items) ||
    !count(v.total) ||
    !count(v.page) ||
    !count(v.size) ||
    v.size < 1 ||
    v.size > 100 ||
    v.items.length > v.size ||
    v.total < v.items.length
  )
    throw new Error('No pudimos leer el listado.')
  return {
    items: v.items.map((row) => parseRow(kind, row)),
    total: v.total,
    page: v.page,
    size: v.size,
  }
}
export function parseDetail(kind: Kind, v: unknown): Detail {
  if (kind === 'expenses') return { record: parseRow(kind, v), items: [] }
  if (
    !object(v) ||
    !Array.isArray(v.items) ||
    !v.items.length ||
    v.items.length > 100
  )
    throw new Error('Compra inesperada.')
  const record = parseRow(kind, v.purchase)
  const items = v.items.map((i) => {
    if (
      !object(i) ||
      !count(i.id) ||
      !i.id ||
      !count(i.productId) ||
      !i.productId ||
      typeof i.productName !== 'string' ||
      !count(i.quantity) ||
      i.quantity < 1 ||
      i.quantity > 1000000
    )
      throw new Error('Línea inesperada.')
    const unitCost = financial(i.unitCost),
      subtotal = financial(i.subtotal)
    if (decimalCents(unitCost) * BigInt(i.quantity) !== decimalCents(subtotal))
      throw new Error('Subtotal inesperado.')
    return {
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitCost,
      subtotal,
    }
  })
  if (
    new Set(items.map((i) => i.productId)).size !== items.length ||
    items.reduce((s, i) => s + decimalCents(i.subtotal), 0n) !==
      decimalCents(record.amount)
  )
    throw new Error('Total inesperado.')
  return { record, items }
}
export function createBody(kind: Kind, v: Values, requestId: string) {
  const common = {
    requestId,
    description: v.description.trim(),
    paymentMethod: v.paymentMethod,
    notes: v.notes.trim() || null,
  }
  return kind === 'expenses'
    ? { ...common, category: v.category, amount: v.amount, expenseDate: v.date }
    : {
        ...common,
        supplierName: v.supplierName.trim() || null,
        purchaseDate: v.date,
        items: v.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitCost: i.unitCost,
        })),
      }
}

import { collectionMethods } from '../../lib/payments.ts'
import type { CollectionMethod } from '../../lib/payments.ts'
import { accountMoney, decimalCents } from './money.ts'
export interface CustomerAccount {
  customerId: number
  customerName: string
  outstandingBalance: string
  totalCredit: string
  totalPaid: string
  lastMovementAt: string | null
}
export interface AccountMovement {
  id: number
  customerId: number
  saleId: number | null
  type: 'CREDIT' | 'PAYMENT'
  amount: number
  paymentMethod: CollectionMethod | null
  note: string | null
  createdBy: number
  createdByName: string
  createdAt: string
}
export interface MovementPage {
  items: AccountMovement[]
  total: number
  page: number
  size: number
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Respuesta de cuenta inesperada.')
  return value as Record<string, unknown>
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Dato de cuenta inesperado.')
  return value
}
function money(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(Math.round(value * 100))
  )
    throw new Error('Importe de cuenta inesperado.')
  return value
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error('Dato de cuenta inesperado.')
  return value
}
function date(value: unknown): string {
  const result = text(value, 64)
  if (!Number.isFinite(Date.parse(result)))
    throw new Error('Fecha de cuenta inesperada.')
  return result
}
export function parseAccount(value: unknown): CustomerAccount {
  const a = record(value)
  const balance = accountMoney(a.outstandingBalance)
  const credit = accountMoney(a.totalCredit)
  const paid = accountMoney(a.totalPaid)
  if (
    decimalCents(credit) - decimalCents(paid) !== decimalCents(balance) ||
    integer(a.customerId) < 1
  )
    throw new Error('Saldo de cuenta inesperado.')
  return {
    customerId: integer(a.customerId),
    customerName: text(a.customerName, 160),
    outstandingBalance: balance,
    totalCredit: credit,
    totalPaid: paid,
    lastMovementAt: a.lastMovementAt === null ? null : date(a.lastMovementAt),
  }
}
export function parseAccountMovement(value: unknown): AccountMovement {
  const m = record(value)
  const amount = money(m.amount)
  if (
    integer(m.id) < 1 ||
    integer(m.customerId) < 1 ||
    integer(m.createdBy) < 1 ||
    amount <= 0 ||
    !['CREDIT', 'PAYMENT'].includes(String(m.type))
  )
    throw new Error('Movimiento de cuenta inesperado.')
  if (
    m.type === 'PAYMENT' &&
    (m.saleId !== null ||
      typeof m.paymentMethod !== 'string' ||
      !Object.hasOwn(collectionMethods, m.paymentMethod))
  )
    throw new Error('Pago inesperado.')
  if (
    m.type === 'CREDIT' &&
    (m.paymentMethod !== null || integer(m.saleId) < 1)
  )
    throw new Error('Fiado inesperado.')
  return {
    id: integer(m.id),
    customerId: integer(m.customerId),
    saleId: m.saleId === null ? null : integer(m.saleId),
    type: m.type as 'CREDIT' | 'PAYMENT',
    amount,
    paymentMethod: m.paymentMethod as CollectionMethod | null,
    note: m.note === null ? null : text(m.note, 240),
    createdBy: integer(m.createdBy),
    createdByName: text(m.createdByName, 120),
    createdAt: date(m.createdAt),
  }
}
export function parseAccountMovements(value: unknown): MovementPage {
  const page = record(value)
  if (
    !Array.isArray(page.items) ||
    integer(page.size) < 1 ||
    integer(page.size) > 100 ||
    page.items.length > Number(page.size)
  )
    throw new Error('Historial de cuenta inesperado.')
  return {
    items: page.items.map(parseAccountMovement),
    total: integer(page.total),
    page: integer(page.page),
    size: integer(page.size),
  }
}
export function validatePayment(
  amount: string,
  method: string,
  note: string,
  balance: string | number,
): Partial<Record<'amount' | 'paymentMethod' | 'note', string>> {
  const errors: Partial<Record<'amount' | 'paymentMethod' | 'note', string>> =
    {}
  const value = Number(amount)
  if (
    !/^\d{1,12}(\.\d{1,2})?$/.test(amount) ||
    value <= 0 ||
    value > 999999999999.99 ||
    decimalCents(amount) > decimalCents(String(balance))
  )
    errors.amount =
      'Ingresa un monto mayor a cero y que no supere el saldo pendiente.'
  if (!Object.hasOwn(collectionMethods, method))
    errors.paymentMethod = 'Elige cómo pagó el cliente.'
  if (note.trim().length > 240) errors.note = 'Usa hasta 240 caracteres.'
  return errors
}

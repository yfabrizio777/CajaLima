import { collectionMethods } from '../../lib/payments.ts'
import type { CollectionMethod } from '../../lib/payments.ts'
export interface PaymentIntent {
  requestId: string
  amount: string
  paymentMethod: CollectionMethod
  note: string | null
}
const key = (actor: number, customer: number) =>
  `cajalima.payment.${actor}.${customer}`
export function readPaymentIntent(
  actor: number,
  customer: number,
): PaymentIntent | null {
  try {
    const raw = sessionStorage.getItem(key(actor, customer))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') throw new Error('Intento inválido')
    const v = value as Record<string, unknown>
    if (
      typeof v.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(v.requestId) ||
      typeof v.amount !== 'string' ||
      !/^\d{1,12}(\.\d{1,2})?$/.test(v.amount) ||
      Number(v.amount) <= 0 ||
      typeof v.paymentMethod !== 'string' ||
      !Object.hasOwn(collectionMethods, v.paymentMethod) ||
      !(v.note === null || (typeof v.note === 'string' && v.note.length <= 240))
    )
      throw new Error('Intento inválido')
    return {
      requestId: v.requestId,
      amount: v.amount,
      paymentMethod: v.paymentMethod as CollectionMethod,
      note: v.note as string | null,
    }
  } catch {
    return null
  }
}
export function savePaymentIntent(
  actor: number,
  customer: number,
  intent: PaymentIntent,
): void {
  sessionStorage.setItem(key(actor, customer), JSON.stringify(intent))
}
export function clearPaymentIntent(actor: number, customer: number): void {
  sessionStorage.removeItem(key(actor, customer))
}

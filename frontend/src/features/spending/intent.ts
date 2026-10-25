import { object, validateSpending } from './types.ts'
import type { Kind, Values } from './types.ts'
export interface Intent {
  requestId: string
  values: Values
}
function key(actor: number, kind: Kind) {
  return `cajalima.spending.${actor}.${kind}`
}
export function readIntent(actor: number, kind: Kind): Intent | null {
  try {
    const raw = sessionStorage.getItem(key(actor, kind))
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    if (
      !object(v) ||
      typeof v.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        v.requestId,
      ) ||
      !object(v.values)
    )
      return null
    const r = v.values
    if (
      typeof r.description !== 'string' ||
      typeof r.category !== 'string' ||
      typeof r.amount !== 'string' ||
      typeof r.paymentMethod !== 'string' ||
      typeof r.date !== 'string' ||
      typeof r.notes !== 'string' ||
      typeof r.supplierName !== 'string' ||
      !Array.isArray(r.items) ||
      r.items.length > 100
    )
      return null
    const items = r.items.map((i) => {
      if (
        !object(i) ||
        typeof i.productId !== 'number' ||
        typeof i.productName !== 'string' ||
        i.productName.length > 160 ||
        typeof i.quantity !== 'string' ||
        typeof i.unitCost !== 'string'
      )
        throw new Error()
      return {
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitCost: i.unitCost,
      }
    })
    const values = {
      description: r.description,
      category: r.category,
      amount: r.amount,
      paymentMethod: r.paymentMethod,
      date: r.date,
      notes: r.notes,
      supplierName: r.supplierName,
      items,
    }
    if (Object.keys(validateSpending(kind, values)).length) return null
    return { requestId: v.requestId, values }
  } catch {
    return null
  }
}
export function saveIntent(actor: number, kind: Kind, intent: Intent) {
  try {
    sessionStorage.setItem(key(actor, kind), JSON.stringify(intent))
  } catch {
    throw new Error(
      'No pudimos conservar la referencia del registro. Habilita el almacenamiento de esta pestaña antes de registrar.',
    )
  }
}
export function clearIntent(actor: number, kind: Kind) {
  try {
    sessionStorage.removeItem(key(actor, kind))
  } catch {
    /* Resolved records remain safe to replay with the same UUID. */
  }
}

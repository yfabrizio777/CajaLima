export const documentTypes = {
  DNI: 'DNI',
  RUC: 'RUC',
  CE: 'Carné de extranjería',
  OTHER: 'Otro',
}
export type DocumentType = keyof typeof documentTypes
export function isDocumentType(value: string): value is DocumentType {
  return Object.hasOwn(documentTypes, value)
}
export interface CustomerInput {
  name: string
  documentType: DocumentType | null
  documentNumber: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}
export interface Customer extends CustomerInput {
  id: number
  active: boolean
  createdAt: string
  updatedAt: string
}
export interface CustomerPage {
  items: Customer[]
  total: number
  page: number
  size: number
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Respuesta de clientes inesperada.')
  return value as Record<string, unknown>
}
function optional(value: unknown, max: number): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > max)
    throw new Error('Dato de cliente inesperado.')
  return value
}
function integer(value: unknown, minimum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new Error('Listado de clientes inesperado.')
  return value
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new Error('Fecha de cliente inesperada.')
  return value
}
export function parseCustomer(value: unknown): Customer {
  const c = object(value)
  if (
    typeof c.name !== 'string' ||
    !c.name.trim() ||
    c.name.length > 160 ||
    typeof c.active !== 'boolean' ||
    !(
      c.documentType === null ||
      (typeof c.documentType === 'string' && isDocumentType(c.documentType))
    )
  )
    throw new Error('Respuesta de cliente inesperada.')
  return {
    id: integer(c.id, 1),
    name: c.name,
    documentType: c.documentType,
    documentNumber: optional(c.documentNumber, 32),
    phone: optional(c.phone, 32),
    email: optional(c.email, 180),
    address: optional(c.address, 240),
    notes: optional(c.notes, 1000),
    active: c.active,
    createdAt: timestamp(c.createdAt),
    updatedAt: timestamp(c.updatedAt),
  }
}
export function parseCustomers(value: unknown): CustomerPage {
  const page = object(value)
  if (!Array.isArray(page.items))
    throw new Error('Listado de clientes inesperado.')
  const size = integer(page.size, 1)
  if (size > 100 || page.items.length > size)
    throw new Error('Listado de clientes inesperado.')
  return {
    items: page.items.map(parseCustomer),
    total: integer(page.total, 0),
    page: integer(page.page, 0),
    size,
  }
}
export function customerDocument(customer: Customer): string {
  return customer.documentNumber
    ? `${customer.documentType ?? 'OTHER'} ${customer.documentNumber}`
    : 'Sin documento'
}

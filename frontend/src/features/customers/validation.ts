import { isDocumentType } from './types.ts'
import type { CustomerInput } from './types.ts'
export interface CustomerValues {
  name: string
  documentType: string
  documentNumber: string
  phone: string
  email: string
  address: string
  notes: string
}
export type CustomerErrors = Partial<Record<keyof CustomerValues, string>>
const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
export function customerBody(values: CustomerValues): CustomerInput {
  const documentNumber =
    values.documentNumber.replace(/\s+/g, '').toUpperCase() || null
  return {
    name: clean(values.name),
    documentType: isDocumentType(values.documentType)
      ? values.documentType
      : documentNumber
        ? 'OTHER'
        : null,
    documentNumber,
    phone: values.phone.replace(/[\s()-]+/g, '') || null,
    email: values.email.trim().toLowerCase() || null,
    address: clean(values.address) || null,
    notes: values.notes.trim() || null,
  }
}
export function validateCustomer(values: CustomerValues): CustomerErrors {
  const body = customerBody(values)
  const errors: CustomerErrors = {}
  if (!body.name || body.name.length > 160)
    errors.name = 'Escribe un nombre de hasta 160 caracteres.'
  if (values.documentType && !isDocumentType(values.documentType))
    errors.documentType = 'Elige un tipo de documento.'
  if (body.documentNumber) {
    const format =
      body.documentType === 'DNI'
        ? /^\d{8}$/
        : body.documentType === 'RUC'
          ? /^\d{11}$/
          : /^[A-Z0-9][A-Z0-9./-]{0,31}$/
    if (!format.test(body.documentNumber))
      errors.documentNumber =
        body.documentType === 'DNI'
          ? 'El DNI debe tener 8 dígitos.'
          : body.documentType === 'RUC'
            ? 'El RUC debe tener 11 dígitos.'
            : 'Usa hasta 32 letras, números, puntos, barras o guiones.'
  }
  if (body.phone && !/^\+?\d{1,20}$/.test(body.phone))
    errors.phone = 'Revisa el teléfono; usa números y un + inicial opcional.'
  if (
    body.email &&
    (body.email.length > 180 || !/^[^\s@]+@[^\s@]+$/.test(body.email))
  )
    errors.email = 'Escribe un correo válido.'
  if (body.address && body.address.length > 240)
    errors.address = 'Usa hasta 240 caracteres.'
  if (body.notes && body.notes.length > 1000)
    errors.notes = 'Usa hasta 1000 caracteres.'
  return errors
}

export interface ProductValues {
  name: string
  sku: string
  salePrice: string
  costPrice: string
  initialStock: string
  minimumStock: string
  active: boolean
}
export type ProductErrors = Partial<Record<keyof ProductValues, string>>
export function validQuantity(value: string): boolean {
  return /^\d{1,7}$/.test(value) && Number(value) <= 1000000
}
export function validMoney(value: string): boolean {
  return /^\d{1,8}(\.\d{1,2})?$/.test(value) && Number(value) <= 99999999.99
}
export function validateProduct(
  v: ProductValues,
  creating: boolean,
): ProductErrors {
  const errors: ProductErrors = {}
  if (!v.name.trim() || v.name.trim().length > 160)
    errors.name = 'Escribe un nombre de hasta 160 caracteres.'
  if (v.sku.trim() && !/^[A-Z0-9][A-Z0-9._-]{0,63}$/i.test(v.sku.trim()))
    errors.sku = 'Usa hasta 64 letras, números, puntos o guiones, sin espacios.'
  if (!validMoney(v.salePrice))
    errors.salePrice = 'Escribe un precio válido con hasta dos decimales.'
  if (v.costPrice && !validMoney(v.costPrice))
    errors.costPrice = 'Escribe un costo válido con hasta dos decimales.'
  if (creating && !validQuantity(v.initialStock))
    errors.initialStock = 'Usa un número entero entre 0 y 1 000 000.'
  if (!validQuantity(v.minimumStock))
    errors.minimumStock = 'Usa un número entero entre 0 y 1 000 000.'
  return errors
}

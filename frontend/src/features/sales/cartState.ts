import type { Product } from '../products/types'
export interface CartLine {
  product: Product
  quantity: number
}
export function changeQuantity(
  cart: CartLine[],
  product: Product,
  quantity: number,
): CartLine[] {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > product.stock ||
    !product.active
  )
    return cart
  if (quantity === 0)
    return cart.filter((line) => line.product.id !== product.id)
  if (!cart.some((line) => line.product.id === product.id))
    return cart.length >= 100 ? cart : [...cart, { product, quantity }]
  return cart.map((line) =>
    line.product.id === product.id ? { product, quantity } : line,
  )
}
export function cartTotal(cart: CartLine[]): number {
  return (
    cart.reduce(
      (sum, line) =>
        sum + Math.round(line.product.salePrice * 100) * line.quantity,
      0,
    ) / 100
  )
}

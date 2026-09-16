import { formatMoney } from '../../lib/locale'
import { payments } from './types'
import type { PaymentMethod } from './types'
import type { CartLine } from './cartState'
import type { Product } from '../products/types'
import { cartTotal } from './cartState'
export function Cart({
  lines,
  payment,
  locked,
  busy,
  uncertain,
  onQuantity,
  onPayment,
  onClear,
  onSubmit,
}: {
  lines: CartLine[]
  payment: PaymentMethod
  locked: boolean
  busy: boolean
  uncertain: boolean
  onQuantity: (p: Product, quantity: number) => void
  onPayment: (v: PaymentMethod) => void
  onClear: () => void
  onSubmit: () => void
}) {
  const total = cartTotal(lines)
  return (
    <section
      id="cart"
      className="pos-cart"
      aria-labelledby="cart-title"
      tabIndex={-1}
    >
      <header>
        <h2 id="cart-title">Tu venta</h2>
        <button disabled={locked || !lines.length} onClick={onClear}>
          Vaciar
        </button>
      </header>
      {!lines.length ? (
        <p className="cart-empty">
          Tu carrito está vacío. Agrega un producto para empezar.
        </p>
      ) : (
        <ul className="cart-lines">
          {lines.map((line) => (
            <li key={line.product.id}>
              <h3>{line.product.name}</h3>
              <div className="cart-controls">
                <div className="quantity-control">
                  <button
                    aria-label={'Disminuir ' + line.product.name}
                    disabled={locked}
                    onClick={() => onQuantity(line.product, line.quantity - 1)}
                  >
                    −
                  </button>
                  <span aria-label={'Cantidad de ' + line.product.name}>
                    {line.quantity}
                  </span>
                  <button
                    aria-label={'Aumentar ' + line.product.name}
                    disabled={locked || line.quantity >= line.product.stock}
                    onClick={() => onQuantity(line.product, line.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <strong>
                  {formatMoney(
                    (Math.round(line.product.salePrice * 100) * line.quantity) /
                      100,
                  )}
                </strong>
              </div>
              <button
                className="remove-item"
                disabled={locked}
                aria-label={'Eliminar ' + line.product.name}
                onClick={() => onQuantity(line.product, 0)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sale-total">
        Total <strong>{formatMoney(total)}</strong>
      </p>
      <p className="field-hint">
        El total final se confirma con los precios vigentes al registrar.
      </p>
      <fieldset className="payment-options" disabled={locked}>
        <legend>¿Cómo te pagaron?</legend>
        {Object.entries(payments).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="payment"
              value={value}
              checked={payment === value}
              onChange={() => onPayment(value as PaymentMethod)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="field-hint">
        Registro manual. No verifica pagos con Yape, Plin ni bancos.
      </p>
      <button
        className="button button-primary register-sale"
        disabled={busy || !lines.length || total > 999999999999.99}
        onClick={onSubmit}
      >
        {busy
          ? 'Registrando…'
          : uncertain
            ? 'Comprobar y reintentar'
            : 'Registrar venta'}
      </button>
    </section>
  )
}

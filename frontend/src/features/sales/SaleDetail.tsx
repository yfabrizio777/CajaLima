import { formatDate, formatMoney } from '../../lib/locale'
import { payments } from './types'
import type { Sale } from './types'
export function SaleDetail({ sale }: { sale: Sale }) {
  return (
    <div className="sale-detail">
      <p>
        Venta #{sale.id} · {formatDate(new Date(sale.createdAt))}
      </p>
      <ul>
        {sale.items.map((item) => (
          <li key={item.productId}>
            <span>
              {item.productName}
              <small>
                {item.quantity} × {formatMoney(item.unitPrice)}
              </small>
            </span>
            <strong>{formatMoney(item.subtotal)}</strong>
          </li>
        ))}
      </ul>
      <p>
        Pago: <strong>{payments[sale.paymentMethod]}</strong>
      </p>
      <p className="sale-total">
        Total <strong>{formatMoney(sale.total)}</strong>
      </p>
    </div>
  )
}

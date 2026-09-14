import { formatMoney } from '../../lib/locale'
import type { Product } from './types'
export function ProductList({
  products,
  admin,
  onEdit,
  onAdjust,
  onStatus,
  busy,
}: {
  products: Product[]
  admin: boolean
  onEdit: (p: Product) => void
  onAdjust: (p: Product) => void
  onStatus: (p: Product) => void
  busy: boolean
}) {
  const status = (p: Product) => (
    <span
      className={`product-badge ${!p.active ? 'inactive' : p.lowStock ? 'low-stock' : 'normal-stock'}`}
    >
      {!p.active ? 'Inactivo' : p.lowStock ? 'Poco stock' : 'Stock normal'}
    </span>
  )
  const actions = (p: Product) =>
    admin && (
      <div className="product-actions">
        <button disabled={busy} onClick={() => onEdit(p)}>
          Editar
        </button>
        <button disabled={busy} onClick={() => onAdjust(p)}>
          Ajustar stock
        </button>
        <button disabled={busy} onClick={() => onStatus(p)}>
          {p.active ? 'Desactivar' : 'Reactivar'}
        </button>
      </div>
    )
  return (
    <>
      <div className="products-table">
        <table>
          <caption className="sr-only">Productos de tu negocio</caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Código</th>
              <th scope="col">Precio</th>
              <th scope="col">Stock</th>
              <th scope="col">Estado</th>
              {admin && <th scope="col">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                <td>{p.sku || 'Sin código'}</td>
                <td className="money">{formatMoney(p.salePrice)}</td>
                <td>{p.stock} unidades</td>
                <td>{status(p)}</td>
                {admin && <td>{actions(p)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="products-cards">
        {products.map((p) => (
          <article className="product-card" key={p.id} aria-label={p.name}>
            <header>
              <h2>{p.name}</h2>
              <span>{p.sku || 'Sin código'}</span>
            </header>
            <div className="product-card-values">
              <strong>{formatMoney(p.salePrice)}</strong>
              <div>
                <span>{p.stock} unidades</span>
                {status(p)}
              </div>
            </div>
            {actions(p)}
          </article>
        ))}
      </div>
    </>
  )
}

import { customerDocument } from './types'
import type { Customer } from './types'

export function CustomerList({
  customers,
  admin,
  busy,
  onView,
  onEdit,
  onStatus,
}: {
  customers: Customer[]
  admin: boolean
  busy: boolean
  onView: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onStatus: (customer: Customer) => void
}) {
  const status = (c: Customer) => (
    <span className={`product-badge ${c.active ? 'normal-stock' : 'inactive'}`}>
      {c.active ? 'Activo' : 'Inactivo'}
    </span>
  )
  const actions = (c: Customer) => (
    <div className="product-actions" aria-label={`Acciones de ${c.name}`}>
      <button disabled={busy} onClick={() => onView(c)}>
        Ver
      </button>
      <button disabled={busy} onClick={() => onEdit(c)}>
        Editar
      </button>
      {admin && (
        <button disabled={busy} onClick={() => onStatus(c)}>
          {c.active ? 'Desactivar' : 'Reactivar'}
        </button>
      )}
    </div>
  )
  return (
    <>
      <div className="products-table">
        <table>
          <caption className="sr-only">Clientes de tu negocio</caption>
          <thead>
            <tr>
              {['Cliente', 'Documento', 'Teléfono', 'Estado', 'Acciones'].map(
                (title) => (
                  <th scope="col" key={title}>
                    {title}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.name}</th>
                <td>{customerDocument(c)}</td>
                <td>{c.phone || 'Sin teléfono'}</td>
                <td>{status(c)}</td>
                <td>{actions(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="products-cards">
        {customers.map((c) => (
          <article
            className="product-card customer-card"
            key={c.id}
            aria-label={c.name}
          >
            <header>
              <h2>{c.name}</h2>
              <span>{customerDocument(c)}</span>
            </header>
            <p>{c.phone || 'Sin teléfono'}</p>
            {status(c)}
            {actions(c)}
          </article>
        ))}
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatDate, formatMoney } from '../../lib/locale'
import { payments } from '../../lib/payments'
import { useCustomersApi } from './api'
import type { CustomerPurchases } from './purchases'

export function CustomerPurchaseHistory({
  id,
  onClose,
}: {
  id: number
  onClose: () => void
}) {
  const api = useCustomersApi()
  const [page, setPage] = useState(0)
  const [data, setData] = useState<CustomerPurchases | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api
      .purchases(id, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error
              ? e.message
              : 'No pudimos consultar sus compras.',
          )
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [api, id, page, revision])
  return (
    <section
      className="customer-purchases"
      aria-labelledby="customer-history-title"
    >
      <h3 id="customer-history-title">Historial de compras</h3>
      {loading ? (
        <output>Consultando compras…</output>
      ) : error ? (
        <div role="alert" className="form-alert">
          {error}
          <button
            className="button button-secondary"
            onClick={() => {
              setError('')
              setLoading(true)
              setRevision((value) => value + 1)
            }}
          >
            Volver a intentar
          </button>
        </div>
      ) : (
        data &&
        (data.items.length ? (
          <>
            <ul>
              {data.items.map((sale) => (
                <li key={sale.id}>
                  <div>
                    <strong>Venta #{sale.id}</strong>
                    <span>{formatDate(new Date(sale.createdAt))}</span>
                  </div>
                  <div>
                    <strong>{formatMoney(sale.total)}</strong>
                    <span>{payments[sale.paymentMethod]}</span>
                  </div>
                  <Link
                    to={`/app/sales/history?sale=${sale.id}`}
                    onClick={onClose}
                    aria-label={`Ver venta ${sale.id}`}
                  >
                    Ver venta
                  </Link>
                </li>
              ))}
            </ul>
            {data.total > data.size && (
              <nav
                className="pagination"
                aria-label="Páginas de compras del cliente"
              >
                <button
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1)
                    setLoading(true)
                    setError('')
                  }}
                >
                  Anterior
                </button>
                <span>
                  Página {page + 1} de {Math.ceil(data.total / data.size)}
                </span>
                <button
                  disabled={(page + 1) * data.size >= data.total}
                  onClick={() => {
                    setPage(page + 1)
                    setLoading(true)
                    setError('')
                  }}
                >
                  Siguiente
                </button>
              </nav>
            )}
          </>
        ) : (
          <p>Este cliente todavía no tiene compras registradas.</p>
        ))
      )}
    </section>
  )
}

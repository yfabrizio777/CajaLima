import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Dialog } from '../../components/ui/Dialog'
import { formatDate, formatMoney } from '../../lib/locale'
import { SaleDetail } from './SaleDetail'
import { useSalesApi } from './api'
import { payments } from './types'
import type { Sale, SalePage } from './types'
export function SalesHistoryPage() {
  const api = useSalesApi()
  const [date, setDate] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<SalePage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Sale | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    api
      .list(date, page, controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) {
          setData(v)
          setError('')
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : 'No pudimos cargar las ventas.',
          )
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [api, date, page])
  async function open(id: number) {
    try {
      setDetail(await api.detail(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar el detalle.')
    }
  }
  return (
    <>
      <section className="products-heading">
        <div>
          <h1>Ventas registradas</h1>
          <p>Consulta lo que vendiste, con sus precios del momento.</p>
        </div>
        <Link className="button button-primary" to="/app/sales">
          Nueva venta
        </Link>
      </section>
      <div className="history-filter">
        <label htmlFor="sale-date">Fecha (Perú)</label>
        <input
          id="sale-date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPage(0)
            setLoading(true)
          }}
        />
        <button
          className="button button-secondary"
          onClick={() => {
            setDate('')
            setPage(0)
            setLoading(true)
          }}
          disabled={!date}
        >
          Todas las fechas
        </button>
      </div>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <output>Cargando ventas…</output>
      ) : (
        data && (
          <>
            <div className="sale-history">
              {data.items.map((sale) => (
                <article key={sale.id}>
                  <h2>Venta #{sale.id}</h2>
                  <p>
                    {formatDate(new Date(sale.createdAt))} ·{' '}
                    {payments[sale.paymentMethod]}
                  </p>
                  <strong>{formatMoney(sale.total)}</strong>
                  <button
                    className="button button-secondary"
                    onClick={() => open(sale.id)}
                  >
                    Ver detalle de venta #{sale.id}
                  </button>
                </article>
              ))}
            </div>
            {!data.total && (
              <p className="products-empty">
                Todavía no hay ventas para mostrar.
              </p>
            )}
            <nav className="pagination" aria-label="Páginas de ventas">
              <button
                disabled={!page}
                onClick={() => {
                  setPage(page - 1)
                  setLoading(true)
                }}
              >
                Anterior
              </button>
              <span>Página {page + 1}</span>
              <button
                disabled={(page + 1) * data.size >= data.total}
                onClick={() => {
                  setPage(page + 1)
                  setLoading(true)
                }}
              >
                Siguiente
              </button>
            </nav>
          </>
        )
      )}
      {detail && (
        <Dialog
          title={'Detalle de venta #' + detail.id}
          onClose={() => setDetail(null)}
        >
          <SaleDetail sale={detail} />
        </Dialog>
      )}
    </>
  )
}

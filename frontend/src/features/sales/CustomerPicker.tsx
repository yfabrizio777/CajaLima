import { useEffect, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { CustomerForm } from '../customers/CustomerForm'
import { useCustomersApi } from '../customers/api'
import { customerDocument } from '../customers/types'
import type { Customer, CustomerPage } from '../customers/types'

export function CustomerPicker({
  selected,
  locked,
  onSelect,
}: {
  selected: Customer | null
  locked: boolean
  onSelect: (customer: Customer | null) => void
}) {
  const api = useCustomersApi()
  const [mode, setMode] = useState<'search' | 'create' | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<CustomerPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (mode !== 'search') return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api
        .active(search, page, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setData(result)
            setLoading(false)
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(
              e instanceof Error ? e.message : 'No pudimos buscar clientes.',
            )
            setLoading(false)
          }
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, mode, search, page, revision])
  function select(customer: Customer | null) {
    if (locked) return
    onSelect(customer)
    setMode(null)
  }
  return (
    <section className="pos-customer" aria-labelledby="pos-customer-title">
      <h2 id="pos-customer-title">
        Cliente <small>(opcional)</small>
      </h2>
      <div className="customer-picker-controls">
        <button
          className="button button-secondary"
          aria-label={`Seleccionar cliente: ${selected?.name ?? 'Público general'}`}
          aria-haspopup="dialog"
          disabled={locked}
          onClick={() => {
            setError('')
            setLoading(true)
            setMode('search')
          }}
        >
          {selected?.name ?? 'Público general'}{' '}
          <span aria-hidden="true">▾</span>
        </button>
        <button
          className="customer-quick-create"
          disabled={locked}
          onClick={() => setMode('create')}
        >
          + Nuevo cliente
        </button>
      </div>
      {mode === 'search' && (
        <Dialog title="Seleccionar cliente" onClose={() => setMode(null)}>
          <p className="dialog-intro">
            Puedes continuar como Público general o buscar a un cliente activo.
          </p>
          <div className="product-search">
            <label htmlFor="pos-customer-search">
              Buscar cliente por nombre o documento
            </label>
            <input
              id="pos-customer-search"
              type="search"
              maxLength={160}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
                setError('')
                setLoading(true)
              }}
            />
          </div>
          <button
            className="button button-secondary public-customer"
            onClick={() => select(null)}
          >
            Público general
          </button>
          {loading ? (
            <output className="products-loading">Buscando clientes…</output>
          ) : error ? (
            <div className="form-alert" role="alert">
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
            data && (
              <>
                {!data.items.length ? (
                  <p className="dialog-intro">
                    No encontramos clientes activos. Prueba otra búsqueda o
                    registra uno nuevo.
                  </p>
                ) : (
                  <ul className="customer-options">
                    {data.items.map((customer) => (
                      <li key={customer.id}>
                        <button onClick={() => select(customer)}>
                          <strong>{customer.name}</strong>
                          <span>{customerDocument(customer)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {data.total > data.size && (
                  <nav
                    className="pagination"
                    aria-label="Páginas de selección de cliente"
                  >
                    <button
                      disabled={page === 0}
                      onClick={() => {
                        setPage(page - 1)
                        setLoading(true)
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
                      }}
                    >
                      Siguiente
                    </button>
                  </nav>
                )}
              </>
            )
          )}
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              onClick={() => setMode('create')}
            >
              + Nuevo cliente
            </button>
          </div>
        </Dialog>
      )}
      {mode === 'create' && (
        <CustomerForm
          onClose={() => setMode(null)}
          onSaved={(customer) => {
            select(customer)
            setSearch('')
            setPage(0)
          }}
        />
      )}
    </section>
  )
}

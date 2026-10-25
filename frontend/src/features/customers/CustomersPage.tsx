import { useEffect, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { KusiNote } from '../../components/ui/KusiNote'
import { useAuth } from '../auth/AuthContext'
import { useCustomersApi } from './api'
import { CustomerForm } from './CustomerForm'
import { CustomerList } from './CustomerList'
import { CustomerDetail } from './CustomerDetail'
import type { Customer, CustomerPage } from './types'

type Panel =
  { type: 'edit'; customer?: Customer } | { type: 'view'; id: number } | null
export function CustomersPage() {
  const { user } = useAuth()
  const api = useCustomersApi()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<CustomerPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api
        .list(search, page, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setData(result)
            setError('')
            setLoading(false)
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(
              e instanceof Error
                ? e.message
                : 'No pudimos consultar los clientes.',
            )
            setLoading(false)
          }
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, search, page, revision])
  function reload() {
    setLoading(true)
    setRevision((value) => value + 1)
  }
  async function status(customer: Customer) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.status(customer.id, !customer.active)
      setNotice(
        customer.active
          ? 'Cliente desactivado. Su información se conserva.'
          : 'Cliente reactivado.',
      )
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cambiar el estado.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <section className="products-heading">
        <div>
          <span className="eyebrow">LAS PERSONAS DE TU NEGOCIO</span>
          <h1>Clientes</h1>
          <p>Ten a la mano a las personas que compran en tu negocio.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setPanel({ type: 'edit' })}
        >
          + Nuevo cliente
        </button>
      </section>
      <div className="products-toolbar">
        <div className="product-search">
          <label htmlFor="customer-search">Buscar clientes</label>
          <input
            id="customer-search"
            type="search"
            maxLength={160}
            placeholder="Buscar por nombre o documento..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
              setLoading(true)
            }}
          />
        </div>
      </div>
      {notice && <output className="notice">{notice}</output>}
      {error && (
        <div role="alert" className="form-alert">
          {error}
          <button className="button button-secondary" onClick={reload}>
            Volver a intentar
          </button>
        </div>
      )}
      {loading ? (
        <output className="products-loading">Cargando clientes…</output>
      ) : (
        !error &&
        data &&
        (data.items.length ? (
          <>
            <p className="products-count" aria-live="polite">
              {data.total} {data.total === 1 ? 'cliente' : 'clientes'}
            </p>
            <CustomerList
              customers={data.items}
              admin={user?.role === 'ADMIN'}
              busy={busy}
              onView={(c) => setPanel({ type: 'view', id: c.id })}
              onEdit={(c) => setPanel({ type: 'edit', customer: c })}
              onStatus={status}
            />
            <nav className="pagination" aria-label="Páginas de clientes">
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
                Página {page + 1} de{' '}
                {Math.max(1, Math.ceil(data.total / data.size))}
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
          </>
        ) : (
          <section className="products-empty">
            <Icon name="people" />
            <h2>
              {search ? 'No encontramos clientes' : 'Agrega tu primer cliente'}
            </h2>
            <p>
              {search
                ? 'Prueba con otro nombre, documento o teléfono.'
                : 'Puedes empezar por alguien que compra seguido en tu negocio.'}
            </p>
            {!search && (
              <button
                className="button button-primary"
                onClick={() => setPanel({ type: 'edit' })}
              >
                + Nuevo cliente
              </button>
            )}
            <KusiNote>
              Empieza con su nombre. Los demás datos pueden esperar.
            </KusiNote>
          </section>
        ))
      )}
      {panel?.type === 'edit' && (
        <CustomerForm
          customer={panel.customer}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null)
            setNotice('Cliente guardado correctamente.')
            reload()
          }}
        />
      )}
      {panel?.type === 'view' && (
        <CustomerDetail id={panel.id} onClose={() => setPanel(null)} />
      )}
    </>
  )
}

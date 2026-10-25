import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSpendingApi } from './api'
import type { Kind, SpendingPage, SpendingRow } from './types'
import { categories } from './types'
import { readIntent } from './intent'
import { SpendingForm } from './SpendingForm'
import { SpendingDetail } from './SpendingDetail'
import { formatAccountMoney } from '../accounts/money'
import { collectionMethods } from '../../lib/payments'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'

type Panel =
  { type: 'form'; record?: SpendingRow } | { type: 'detail'; id: number } | null
export function SpendingList({ kind }: { kind: Kind }) {
  const api = useSpendingApi(kind),
    actor = useAuth().user?.id ?? 0
  const [search, setSearch] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [category, setCategory] = useState('')
  const [page, setPage] = useState(0),
    [data, setData] = useState<SpendingPage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0),
    [panel, setPanel] = useState<Panel>(null)
  const [pending, setPending] = useState(() => Boolean(readIntent(actor, kind)))
  const expenses = kind === 'expenses'
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: search,
        page: String(page),
        size: '12',
      })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (category && expenses) params.set('category', category)
      api
        .list(params, controller.signal)
        .then((v) => {
          if (!controller.signal.aborted) {
            setData(v)
            setError('')
            setLoading(false)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError(
              'No pudimos consultar. Revisa las fechas e inténtalo nuevamente.',
            )
            setLoading(false)
          }
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, search, from, to, category, page, revision, expenses])
  function reload() {
    setLoading(true)
    setRevision(revision + 1)
  }
  function filter(setter: (s: string) => void, value: string) {
    setter(value)
    setPage(0)
    setLoading(true)
  }
  function close() {
    setPanel(null)
    setPending(Boolean(readIntent(actor, kind)))
  }
  return (
    <>
      <section className="products-heading">
        <div>
          <span className="eyebrow">EL DINERO DE TU NEGOCIO</span>
          <h1>{expenses ? 'Gastos' : 'Compras'}</h1>
          <p>
            {expenses
              ? 'Registra en qué se va el dinero de tu negocio.'
              : 'Registra mercadería que entra a tu negocio.'}
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setPanel({ type: 'form' })}
        >
          {pending
            ? 'Comprobar registro pendiente'
            : expenses
              ? '+ Registrar gasto'
              : '+ Registrar compra'}
        </button>
      </section>
      <div className="spending-filters">
        <Field
          id="spending-search"
          label={expenses ? 'Buscar gastos' : 'Buscar compras'}
          type="search"
          maxLength={160}
          placeholder={expenses ? 'Descripción…' : 'Descripción o proveedor…'}
          value={search}
          onChange={(e) => filter(setSearch, e.target.value)}
        />
        <Field
          id="spending-from"
          label="Desde"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          value={from}
          onChange={(e) => filter(setFrom, e.target.value)}
        />
        <Field
          id="spending-to"
          label="Hasta"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          value={to}
          onChange={(e) => filter(setTo, e.target.value)}
        />
        {expenses && (
          <div className="field">
            <label htmlFor="spending-category">Categoría</label>
            <select
              className="input"
              id="spending-category"
              value={category}
              onChange={(e) => filter(setCategory, e.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {notice && <output className="notice">{notice}</output>}
      {loading ? (
        <output className="products-loading">Consultando registros…</output>
      ) : error ? (
        <div role="alert" className="form-alert">
          {error}
          <button className="button button-secondary" onClick={reload}>
            Volver a intentar
          </button>
        </div>
      ) : data?.items.length ? (
        <>
          <p className="products-count" aria-live="polite">
            {data.total} {data.total === 1 ? 'registro' : 'registros'}
          </p>
          <div className="spending-cards">
            {data.items.map((row) => (
              <article className="product-card spending-card" key={row.id}>
                <header>
                  <span>
                    {row.date.split('-').reverse().join('/')} ·{' '}
                    {row.category
                      ? categories[row.category]
                      : row.supplierName || 'Sin proveedor'}
                  </span>
                  <h2>{row.description}</h2>
                </header>
                <div className="product-card-values">
                  <strong>{formatAccountMoney(row.amount)}</strong>
                  <span>{collectionMethods[row.paymentMethod]}</span>
                </div>
                <div className="product-actions">
                  <button
                    onClick={() => setPanel({ type: 'detail', id: row.id })}
                  >
                    Ver {expenses ? 'gasto' : 'compra'} #{row.id}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <nav
            className="pagination"
            aria-label={expenses ? 'Páginas de gastos' : 'Páginas de compras'}
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
          <Icon name={expenses ? 'receipt' : 'box'} />
          <h2>
            {search || from || to || category
              ? 'No encontramos registros'
              : expenses
                ? 'Todavía no hay gastos registrados'
                : 'Todavía no hay compras registradas'}
          </h2>
          <p>
            {search || from || to || category
              ? 'Prueba con otros filtros.'
              : expenses
                ? 'Empieza con un gasto de tu negocio.'
                : 'Registra una compra para actualizar tus existencias.'}
          </p>
        </section>
      )}
      {panel?.type === 'form' && (
        <SpendingForm
          kind={kind}
          record={panel.record}
          onClose={close}
          onSaved={() => {
            close()
            setPending(Boolean(readIntent(actor, kind)))
            setNotice(
              panel.record
                ? 'Datos actualizados. Los importes se conservaron.'
                : expenses
                  ? 'Gasto registrado correctamente.'
                  : 'Compra registrada. El stock quedó actualizado.',
            )
            setPage(0)
            reload()
          }}
        />
      )}
      {panel?.type === 'detail' && (
        <SpendingDetail
          kind={kind}
          id={panel.id}
          onClose={close}
          onEdit={(record) => setPanel({ type: 'form', record })}
        />
      )}
    </>
  )
}

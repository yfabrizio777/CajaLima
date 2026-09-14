import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../../components/ui/Icon'
import { KusiNote } from '../../components/ui/KusiNote'
import { useProductsApi } from './api'
import { ProductForm } from './ProductForm'
import { StockForm } from './StockForm'
import { ProductList } from './ProductList'
import type { Product, ProductPage } from './types'
type Editor =
  | { type: 'product'; product?: Product }
  | { type: 'stock'; product: Product }
  | null
export function ProductsPage() {
  const { user } = useAuth()
  const admin = user?.role === 'ADMIN'
  const api = useProductsApi()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<ProductPage | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<Editor>(null)
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api
        .list(search, filter, page, controller.signal)
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
                : 'No pudimos cargar los productos.',
            )
            setLoading(false)
          }
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, search, filter, page, revision])
  function reload() {
    setLoading(true)
    setRevision((value) => value + 1)
  }
  function saved() {
    setEditor(null)
    setNotice('Cambios guardados correctamente.')
    reload()
  }
  async function status(product: Product) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.status(product.id, !product.active)
      setNotice(
        product.active
          ? 'Producto desactivado. Puedes reactivarlo cuando quieras.'
          : 'Producto reactivado.',
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
          <span className="eyebrow">TU CATÁLOGO, EN ORDEN</span>
          <h1>Productos</h1>
          <p>Ten a la mano lo que vendes y cuánto te queda.</p>
        </div>
        {admin && (
          <button
            className="button button-primary"
            onClick={() => setEditor({ type: 'product' })}
          >
            + Nuevo producto
          </button>
        )}
      </section>
      <div className="products-toolbar">
        <div className="product-search">
          <label htmlFor="product-search">Buscar productos</label>
          <input
            id="product-search"
            type="search"
            maxLength={160}
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
              setLoading(true)
            }}
          />
        </div>
        <fieldset className="product-filters" aria-label="Filtrar productos">
          {[
            ['all', 'Todos'],
            ['low', 'Poco stock'],
            ['inactive', 'Inactivos'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value ?? 'all')
                setPage(0)
                setLoading(true)
              }}
            >
              {label}
            </button>
          ))}
        </fieldset>
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
        <output className="products-loading">Cargando productos…</output>
      ) : (
        !error &&
        data &&
        (data.items.length ? (
          <>
            <p className="products-count" aria-live="polite">
              {data.total} {data.total === 1 ? 'producto' : 'productos'}
            </p>
            <ProductList
              products={data.items}
              admin={admin}
              onEdit={(p) => setEditor({ type: 'product', product: p })}
              onAdjust={(p) => setEditor({ type: 'stock', product: p })}
              onStatus={status}
              busy={busy}
            />
            <nav className="pagination" aria-label="Páginas de productos">
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
            <Icon name="box" />
            <h2>
              {search || filter !== 'all'
                ? 'No encontramos productos'
                : 'Agrega tu primer producto'}
            </h2>
            <p>
              {search || filter !== 'all'
                ? 'Prueba otra búsqueda o revisa los filtros.'
                : admin
                  ? 'Empieza por algo que vendas todos los días.'
                  : 'Tu administrador puede agregar los productos del negocio.'}
            </p>
            {admin && !search && filter === 'all' && (
              <button
                className="button button-primary"
                onClick={() => setEditor({ type: 'product' })}
              >
                Agregar producto
              </button>
            )}
            <KusiNote>Un producto a la vez, tu negocio más claro.</KusiNote>
          </section>
        ))
      )}
      {admin && editor?.type === 'product' && (
        <ProductForm
          product={editor.product}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {admin && editor?.type === 'stock' && (
        <StockForm
          product={editor.product}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </>
  )
}

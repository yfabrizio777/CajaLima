import { formatMoney } from '../../lib/locale'
import type { ProductPage, Product } from '../products/types'
export function PosProducts({
  data,
  loading,
  search,
  page,
  locked,
  onSearch,
  onPage,
  onAdd,
}: {
  data: ProductPage | null
  loading: boolean
  search: string
  page: number
  locked: boolean
  onSearch: (v: string) => void
  onPage: (v: number) => void
  onAdd: (p: Product) => void
}) {
  return (
    <section className="pos-products" aria-label="Productos para vender">
      <label htmlFor="pos-search">Buscar producto</label>
      <input
        id="pos-search"
        type="search"
        placeholder="Nombre o código..."
        value={search}
        maxLength={160}
        onChange={(e) => onSearch(e.target.value)}
      />
      {loading ? (
        <output className="products-loading">Buscando productos…</output>
      ) : (
        data && (
          <>
            {!data.items.length && (
              <p className="products-empty">
                No encontramos productos activos. Prueba otra búsqueda o pide al
                administrador que agregue productos.
              </p>
            )}
            <div className="pos-product-grid">
              {data.items.map((p) => (
                <article key={p.id} className="pos-product">
                  <h2>{p.name}</h2>
                  <span>{p.sku || 'Sin código'}</span>
                  <strong>{formatMoney(p.salePrice)}</strong>
                  <p>
                    {p.stock ? 'Stock: ' + p.stock + ' unidades' : 'Sin stock'}
                  </p>
                  <button
                    className="button button-secondary"
                    disabled={locked || !p.stock}
                    aria-label={'Agregar ' + p.name}
                    onClick={() => onAdd(p)}
                  >
                    Agregar
                  </button>
                </article>
              ))}
            </div>
            <nav className="pagination" aria-label="Páginas de productos">
              <button disabled={!page} onClick={() => onPage(page - 1)}>
                Anterior
              </button>
              <span>Página {page + 1}</span>
              <button
                disabled={(page + 1) * data.size >= data.total}
                onClick={() => onPage(page + 1)}
              >
                Siguiente
              </button>
            </nav>
          </>
        )
      )}
    </section>
  )
}

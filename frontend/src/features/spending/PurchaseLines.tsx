import { useEffect, useState } from 'react'
import { useProductsApi } from '../products/api'
import type { ProductPage } from '../products/types'
import type { Line } from './types'
import { purchaseTotal } from './types'
import { formatAccountMoney } from '../accounts/money'
import { Field } from '../../components/ui/Field'
export function PurchaseLines({
  lines,
  onChange,
  disabled,
  error,
}: {
  lines: Line[]
  onChange: (lines: Line[]) => void
  disabled: boolean
  error?: string
}) {
  const api = useProductsApi()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<ProductPage | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (disabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api
        .list(search, 'all', page, controller.signal)
        .then((v) => {
          if (!controller.signal.aborted) {
            setData(v)
            setMessage('')
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setMessage(
              'No pudimos consultar los productos. Cambia la búsqueda para reintentar.',
            )
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, search, page, disabled])
  let total = '—'
  try {
    total = formatAccountMoney(purchaseTotal(lines))
  } catch {
    /* Invalid inputs get inline feedback on submit. */
  }
  return (
    <section className="purchase-lines" aria-labelledby="purchase-lines-title">
      <h3 id="purchase-lines-title">Productos</h3>
      {!disabled && (
        <>
          <Field
            id="purchase-search"
            label="Buscar productos"
            type="search"
            maxLength={160}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
          {message && <p role="alert">{message}</p>}
          <div className="purchase-options">
            {data?.items
              .filter((p) => p.active)
              .map((p) => (
                <button
                  type="button"
                  key={p.id}
                  disabled={
                    lines.some((i) => i.productId === p.id) ||
                    lines.length >= 100
                  }
                  onClick={() =>
                    onChange([
                      ...lines,
                      {
                        productId: p.id,
                        productName: p.name,
                        quantity: '1',
                        unitCost: p.costPrice?.toFixed(2) || '',
                      },
                    ])
                  }
                >
                  Agregar {p.name}
                </button>
              ))}
            {data && !data.items.some((p) => p.active) && (
              <p>
                No encontramos productos activos. Revisa Productos o prueba otra
                búsqueda.
              </p>
            )}
          </div>
          {data && data.total > data.size && (
            <nav
              className="pagination"
              aria-label="Páginas de productos para compra"
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Anteriores
              </button>
              <span>Página {page + 1}</span>
              <button
                type="button"
                disabled={(page + 1) * data.size >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Siguientes
              </button>
            </nav>
          )}
        </>
      )}
      {error && (
        <p id="items-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <div
        id="items"
        tabIndex={-1}
        aria-describedby={error ? 'items-error' : undefined}
      >
        {lines.map((line, index) => (
          <article className="purchase-line" key={line.productId}>
            <strong>{line.productName}</strong>
            <div className="form-columns">
              <Field
                id={`quantity-${line.productId}`}
                label={`Cantidad de ${line.productName}`}
                inputMode="numeric"
                value={line.quantity}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    lines.map((i, n) =>
                      n === index ? { ...i, quantity: e.target.value } : i,
                    ),
                  )
                }
              />
              <Field
                id={`cost-${line.productId}`}
                label={`Costo unitario de ${line.productName} (S/)`}
                inputMode="decimal"
                value={line.unitCost}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    lines.map((i, n) =>
                      n === index ? { ...i, unitCost: e.target.value } : i,
                    ),
                  )
                }
              />
            </div>
            {!disabled && (
              <button
                type="button"
                className="text-button"
                onClick={() => onChange(lines.filter((_, n) => n !== index))}
              >
                Quitar {line.productName}
              </button>
            )}
          </article>
        ))}
      </div>
      <dl className="purchase-total">
        <div>
          <dt>Subtotal</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{total}</dd>
        </div>
      </dl>
      <p className="field-hint">
        El stock aumenta al registrar. Los importes no incluyen impuestos ni
        cargos adicionales.
      </p>
    </section>
  )
}

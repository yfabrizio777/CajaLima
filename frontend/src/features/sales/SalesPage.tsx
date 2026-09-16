import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../lib/http'
import { useSalesApi } from './api'
import { Cart } from './Cart'
import { PosProducts } from './PosProducts'
import { SaleConfirmation } from './SaleConfirmation'
import { changeQuantity } from './cartState'
import type { CartLine } from './cartState'
import type { PaymentMethod, Sale } from './types'
import type { Product, ProductPage } from '../products/types'
export function SalesPage() {
  const api = useSalesApi()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<ProductPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [lines, setLines] = useState<CartLine[]>([])
  const [payment, setPayment] = useState<PaymentMethod>('CASH')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState<Sale | null>(null)
  const locked = busy || uncertain
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api
        .products(search, page, controller.signal)
        .then((v) => {
          if (!controller.signal.aborted) {
            setData(v)
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
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, search, page, revision])
  function quantity(p: Product, amount: number) {
    if (locked) return
    setLines((current) => changeQuantity(current, p, amount))
    setRequestId(crypto.randomUUID())
  }
  async function submit() {
    if (busy || !lines.length) return
    setBusy(true)
    setError('')
    try {
      const sale = await api.create({
        requestId,
        paymentMethod: payment,
        items: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
      })
      setConfirmed(sale)
      setLines([])
      setPayment('CASH')
      setRequestId(crypto.randomUUID())
      setUncertain(false)
    } catch (e) {
      const unknown =
        !(e instanceof ApiError) || e.status === 0 || e.status >= 500
      setUncertain(unknown)
      setError(
        unknown
          ? 'No pudimos confirmar la respuesta. Reintenta con este mismo carrito: la referencia evita registrar la venta dos veces.'
          : e.message,
      )
    } finally {
      setBusy(false)
      setLoading(true)
      setRevision((value) => value + 1)
    }
  }
  return (
    <>
      <section className="products-heading">
        <div>
          <span className="eyebrow">CADA VENTA, MÁS CLARA</span>
          <h1>Ventas</h1>
          <p>Agrega lo que vendiste y registra cómo te pagaron.</p>
        </div>
        <Link className="button button-secondary" to="/app/sales/history">
          Ver ventas
        </Link>
      </section>
      <a
        className="mobile-cart-link"
        href="#cart"
        onClick={() => document.getElementById('cart')?.focus()}
      >
        Ver tu venta · {lines.reduce((sum, line) => sum + line.quantity, 0)}{' '}
        unidades
      </a>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="pos-layout">
        <PosProducts
          data={data}
          loading={loading}
          search={search}
          page={page}
          locked={locked}
          onSearch={(v) => {
            setSearch(v)
            setPage(0)
            setLoading(true)
          }}
          onPage={(v) => {
            setPage(v)
            setLoading(true)
          }}
          onAdd={(p) =>
            quantity(
              p,
              (lines.find((line) => line.product.id === p.id)?.quantity ?? 0) +
                1,
            )
          }
        />
        <Cart
          lines={lines}
          payment={payment}
          locked={locked}
          busy={busy}
          uncertain={uncertain}
          onQuantity={quantity}
          onPayment={(v) => {
            setPayment(v)
            setRequestId(crypto.randomUUID())
          }}
          onClear={() => {
            setLines([])
            setRequestId(crypto.randomUUID())
          }}
          onSubmit={submit}
        />
      </div>
      {confirmed && (
        <SaleConfirmation sale={confirmed} onClose={() => setConfirmed(null)} />
      )}
    </>
  )
}
